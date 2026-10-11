import { z } from "zod";
import { reconRecordSchema, reconMoneySchema, reconTimestampSchema, reconUuidSchema } from "../record-types.js";
import { createFinding, type ReconFinding } from "../finding.js";
import type { MoneyCents } from "../../money.js";
import { computeVariance, sumCents } from "../variance.js";

const transportBase = reconRecordSchema.extend({ notes: z.string().max(2000).optional() });
const nonempty = z.string().min(1).max(100);

export const transportManifestSchema = transportBase.extend({
  recordType: z.literal("manifest"), manifestId: reconUuidSchema, routeId: nonempty, stopId: nonempty, customerId: reconUuidSchema,
  declaredCents: reconMoneySchema, bagCount: z.number().int().nonnegative(), scheduledAt: reconTimestampSchema
}).strict();
export type TransportManifest = z.infer<typeof transportManifestSchema>;

export const transportBagSealSchema = transportBase.extend({
  recordType: z.literal("bag_seal"), sealId: reconUuidSchema, bagId: nonempty, manifestId: reconUuidSchema, stopId: nonempty,
  sealStatus: z.enum(["intact", "broken", "missing"]), scannedAt: reconTimestampSchema
}).strict();
export type TransportBagSeal = z.infer<typeof transportBagSealSchema>;

export const transportTruckCountSchema = transportBase.extend({
  recordType: z.literal("truck_count"), countId: reconUuidSchema, manifestId: reconUuidSchema, countedCents: reconMoneySchema,
  countedBy: nonempty, countedAt: reconTimestampSchema
}).strict();
export type TransportTruckCount = z.infer<typeof transportTruckCountSchema>;

export const transportCustomerReceiptSchema = transportBase.extend({
  recordType: z.literal("customer_receipt"), receiptId: reconUuidSchema, stopId: nonempty, signedCents: reconMoneySchema,
  signedAt: reconTimestampSchema, signerRole: nonempty
}).strict();
export type TransportCustomerReceipt = z.infer<typeof transportCustomerReceiptSchema>;

export const transportBankCreditSchema = transportBase.extend({
  recordType: z.literal("bank_credit"), creditId: reconUuidSchema, manifestId: reconUuidSchema, creditedCents: reconMoneySchema,
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), achTraceId: nonempty
}).strict();
export type TransportBankCredit = z.infer<typeof transportBankCreditSchema>;

export const transportRecordSchema = z.discriminatedUnion("recordType", [transportManifestSchema, transportBagSealSchema, transportTruckCountSchema, transportCustomerReceiptSchema, transportBankCreditSchema]);
export type TransportRecord = z.infer<typeof transportRecordSchema>;

/** Stable join keys for the transport pack; each key remains workspace-scoped by the caller. */
export function transportMatchKey(record: TransportRecord): string {
  switch (record.recordType) {
    case "manifest": return `stop:${record.routeId}:${record.stopId}:${record.customerId}`;
    case "bag_seal": return `manifest:${record.manifestId}:stop:${record.stopId}`;
    case "truck_count": return `manifest:${record.manifestId}`;
    case "customer_receipt": return `stop:${record.stopId}`;
    case "bank_credit": return `manifest:${record.manifestId}`;
  }
}

const TRANSPORT_TOLERANCE_CENTS = 100 as MoneyCents;

function evidence(record: TransportRecord, kind: string, field: string, value: unknown) {
  return [{ recordId: record.recordId, kind, field, value }];
}

/** Deterministic P1 checks; the result never consults labels or an LLM. */
export function transportDefaultChecks(input: readonly unknown[]): ReconFinding[] {
  const records = transportRecordSchema.array().parse(input);
  const manifests = records.filter((record) => record.recordType === "manifest");
  if (manifests.length !== 1) throw new Error("transport case requires exactly one manifest");
  const manifest = manifests[0];
  const findings: ReconFinding[] = [];
  const trucks = records.filter((record) => record.recordType === "truck_count");
  const counted = sumCents(trucks.map((record) => record.countedCents));
  const countVariance = computeVariance(manifest.declaredCents, counted, TRANSPORT_TOLERANCE_CENTS);
  if (!countVariance.withinTolerance) {
    const code = countVariance.varianceCents > 0 ? "SHORT_COUNT" : "OVER_COUNT";
    findings.push(createFinding(code, evidence(manifest, "manifest", "declaredCents", manifest.declaredCents), countVariance, `${manifest.recordId}:count`));
  }
  const seals = records.filter((record) => record.recordType === "bag_seal");
  for (const seal of seals.filter((record) => record.sealStatus !== "intact")) {
    findings.push(createFinding("BROKEN_SEAL", evidence(seal, "bag_seal", "sealStatus", seal.sealStatus), null, seal.recordId));
  }
  const receipts = records.filter((record) => record.recordType === "customer_receipt");
  if (receipts.length === 0) findings.push(createFinding("MISSING_RECEIPT", evidence(manifest, "manifest", "stopId", manifest.stopId), null, `${manifest.recordId}:receipt`));
  const credits = records.filter((record) => record.recordType === "bank_credit");
  const uniqueCredits = [...new Map(credits.map((credit) => [credit.achTraceId, credit])).values()];
  const credited = sumCents(uniqueCredits.map((record) => record.creditedCents));
  const creditVariance = computeVariance(manifest.declaredCents, credited, TRANSPORT_TOLERANCE_CENTS);
  if (!creditVariance.withinTolerance) findings.push(createFinding("BANK_CREDIT_MISMATCH", evidence(manifest, "manifest", "declaredCents", manifest.declaredCents), creditVariance, `${manifest.recordId}:credit`));
  const traces = new Set<string>();
  for (const credit of credits) {
    if (traces.has(credit.achTraceId)) findings.push(createFinding("DUPLICATE_TRACE", evidence(credit, "bank_credit", "achTraceId", credit.achTraceId), null, `${manifest.recordId}:${credit.achTraceId}`));
    traces.add(credit.achTraceId);
    if (credit.valueDate > manifest.scheduledAt.slice(0, 10)) findings.push(createFinding("LATE_CREDIT", evidence(credit, "bank_credit", "valueDate", credit.valueDate), null, credit.recordId));
  }
  return findings;
}
