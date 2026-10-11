import { z } from "zod";
import { reconRecordSchema, reconMoneySchema, reconTimestampSchema, reconUuidSchema } from "../record-types.js";
import { createFinding, type ReconFinding } from "../finding.js";
import { computeVariance } from "../variance.js";
import type { MoneyCents } from "../../money.js";

const billingBase = reconRecordSchema.extend({ notes: z.string().max(2000).optional() });
const nonempty = z.string().min(1).max(100);
const billingLineSchema = z.object({ kind: nonempty, qty: z.number().int().nonnegative(), unitCents: reconMoneySchema, totalCents: reconMoneySchema, stopId: nonempty.optional() }).strict();

export const billingInvoiceSchema = billingBase.extend({
  recordType: z.literal("invoice"), invoiceId: reconUuidSchema, customerId: reconUuidSchema, lines: z.array(billingLineSchema), totalCents: reconMoneySchema,
  periodStart: reconTimestampSchema, periodEnd: reconTimestampSchema
}).strict();
export type BillingInvoice = z.infer<typeof billingInvoiceSchema>;

export const billingContractRateSchema = billingBase.extend({
  recordType: z.literal("contract_rate"), customerId: reconUuidSchema, kind: nonempty, unitCents: reconMoneySchema,
  effectiveFrom: reconTimestampSchema, effectiveTo: reconTimestampSchema
}).strict();
export type BillingContractRate = z.infer<typeof billingContractRateSchema>;

export const billingServiceEventSchema = billingBase.extend({
  recordType: z.literal("service_event"), eventId: reconUuidSchema, customerId: reconUuidSchema, kind: nonempty,
  stopId: nonempty, performedAt: reconTimestampSchema
}).strict();
export type BillingServiceEvent = z.infer<typeof billingServiceEventSchema>;

export const billingRecordSchema = z.discriminatedUnion("recordType", [billingInvoiceSchema, billingContractRateSchema, billingServiceEventSchema]);
export type BillingRecord = z.infer<typeof billingRecordSchema>;

/** Stable customer/period/service keys for joining billing records. */
export function billingMatchKey(record: BillingRecord): string {
  switch (record.recordType) {
    case "invoice": return `customer:${record.customerId}:period:${record.periodStart}/${record.periodEnd}`;
    case "contract_rate": return `customer:${record.customerId}:kind:${record.kind}:effective:${record.effectiveFrom}/${record.effectiveTo}`;
    case "service_event": return `customer:${record.customerId}:kind:${record.kind}:stop:${record.stopId}`;
  }
}

const BILLING_TOLERANCE_CENTS = 1 as MoneyCents;

function evidence(record: BillingRecord, kind: string, field: string, value: unknown) {
  return [{ recordId: record.recordId, kind, field, value }];
}

/** Deterministic P5 checks for rates, service coverage, duplicate stops, and surcharge bounds. */
export function billingDefaultChecks(input: readonly unknown[]): ReconFinding[] {
  const records = billingRecordSchema.array().parse(input);
  const invoices = records.filter((record) => record.recordType === "invoice");
  if (invoices.length !== 1) throw new Error("billing case requires exactly one invoice");
  const invoice = invoices[0];
  const rates = records.filter((record) => record.recordType === "contract_rate");
  const events = records.filter((record) => record.recordType === "service_event");
  const findings: ReconFinding[] = [];
  for (const line of invoice.lines) {
    const rate = rates.find((candidate) => candidate.kind === line.kind);
    if (rate && !computeVariance(line.unitCents, rate.unitCents, BILLING_TOLERANCE_CENTS).withinTolerance) {
      findings.push(createFinding("RATE_MISMATCH", evidence(invoice, "invoice", "lines", line), computeVariance(line.unitCents, rate.unitCents, BILLING_TOLERANCE_CENTS), `${invoice.invoiceId}:${line.kind}:${line.stopId ?? "none"}`));
    }
  }
  const billedStops = new Set(invoice.lines.map((line) => line.stopId).filter((stopId): stopId is string => stopId !== undefined));
  for (const event of events) if (!billedStops.has(event.stopId)) findings.push(createFinding("UNBILLED_STOP", evidence(event, "service_event", "stopId", event.stopId), null, event.recordId));
  const stopCounts = new Map<string, number>();
  for (const line of invoice.lines) {
    if (line.stopId === undefined) continue;
    stopCounts.set(line.stopId, (stopCounts.get(line.stopId) ?? 0) + 1);
  }
  for (const [stopId, count] of stopCounts) if (count > 1) findings.push(createFinding("DOUBLE_BILLED_STOP", evidence(invoice, "invoice", "lines.stopId", stopId), null, `${invoice.invoiceId}:${stopId}`));
  const baseTotal = invoice.lines.filter((line) => line.kind !== "fuel_surcharge").reduce((sum, line) => sum + line.totalCents, 0);
  const fuelTotal = invoice.lines.filter((line) => line.kind === "fuel_surcharge").reduce((sum, line) => sum + line.totalCents, 0);
  if (fuelTotal * 100 > baseTotal * 10) findings.push(createFinding("FUEL_SURCHARGE_OVER", evidence(invoice, "invoice", "lines", fuelTotal), null, `${invoice.invoiceId}:fuel`));
  return findings;
}
