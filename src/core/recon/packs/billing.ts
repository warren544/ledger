import { z } from "zod";
import { reconRecordSchema, reconMoneySchema, reconTimestampSchema, reconUuidSchema } from "../record-types.js";

const billingBase = reconRecordSchema;
const nonempty = z.string().min(1).max(100);
const billingLineSchema = z.object({ kind: nonempty, qty: z.number().int().nonnegative(), unitCents: reconMoneySchema, totalCents: reconMoneySchema }).strict();

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
