import test from "node:test";
import assert from "node:assert/strict";
import { billingInvoiceSchema, billingMatchKey } from "../packs/billing.js";
import { transportBankCreditSchema, transportMatchKey } from "../packs/transport.js";

const ids = { record: "550e8400-e29b-41d4-a716-446655440001", invoice: "550e8400-e29b-41d4-a716-446655440002", customer: "550e8400-e29b-41d4-a716-446655440003" };
const common = { recordId: ids.record, workspaceId: "demo", schemaVersion: 1 as const, sourceSystem: "synthetic", recordedAt: "2026-10-11T09:00:00.000Z", contentHash: "a".repeat(64) };

test("billing invoice schema validates integer-cent lines and has a stable key", () => {
  const invoice = billingInvoiceSchema.parse({ ...common, recordType: "invoice", invoiceId: ids.invoice, customerId: ids.customer, lines: [{ kind: "service", qty: 2, unitCents: 1250, totalCents: 2500 }], totalCents: 2500, periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-10-31T23:59:59.000Z" });
  assert.match(billingMatchKey(invoice), /customer:/);
  assert.throws(() => billingInvoiceSchema.parse({ ...invoice, totalCents: 12.5 }), /expected int/);
});

test("transport bank credits reject unknown fields and expose a manifest key", () => {
  const credit = transportBankCreditSchema.parse({ ...common, recordType: "bank_credit", creditId: ids.invoice, manifestId: ids.customer, creditedCents: 5000, valueDate: "2026-10-11", achTraceId: "trace-1" });
  assert.equal(transportMatchKey(credit), `manifest:${ids.customer}`);
  assert.throws(() => transportBankCreditSchema.parse({ ...credit, labels: ["not-runtime-data"] }), /Unrecognized key/);
});
