import { z } from "zod";
import { reconRecordSchema, reconMoneySchema, reconTimestampSchema, reconUuidSchema } from "../record-types.js";

const transportBase = reconRecordSchema;
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
