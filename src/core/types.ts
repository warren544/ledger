import { z } from "zod";

export const recordKinds = ["invoice", "rate_sheet", "service_log", "email"] as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().refine(Number.isFinite, "must be finite"),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const uuidSchema = z.string().uuid();
const workspaceIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
const timestampSchema = z.string().refine((value) => value.endsWith("Z") && !Number.isNaN(Date.parse(value)), "must be an ISO UTC timestamp");

export const baseDocumentSchema = z.object({
  id: uuidSchema,
  workspaceId: workspaceIdSchema,
  schemaVersion: z.literal(1),
  createdAt: timestampSchema
}).strict();

export const syntheticRecordSchema = baseDocumentSchema.extend({
  kind: z.enum(recordKinds),
  customerId: uuidSchema,
  source: z.literal("synthetic"),
  payload: z.record(z.string(), jsonValueSchema)
}).strict();

export type ISODate = z.infer<typeof timestampSchema>;
export type BaseDocument = z.infer<typeof baseDocumentSchema>;
export type SyntheticRecord = z.infer<typeof syntheticRecordSchema>;

export function parseSyntheticRecords(input: unknown): SyntheticRecord[] {
  const records = z.array(syntheticRecordSchema).parse(input);
  const ids = new Set<string>();
  records.forEach((record, index) => {
    if (ids.has(record.id)) throw new Error(`duplicate record id at index ${index}`);
    ids.add(record.id);
  });
  return records;
}

export interface FixtureManifest {
  datasetId: string;
  generatorVersion: string;
  seed: string;
  schemaVersion: 1;
  generatedAt: ISODate;
  records: number;
  datasetHash: string;
  labelsWithheld: true;
}

export const fixtureManifestSchema = z.object({
  datasetId: z.string().min(1),
  generatorVersion: z.string().min(1),
  seed: z.string().min(1),
  schemaVersion: z.literal(1),
  generatedAt: timestampSchema,
  records: z.number().int().nonnegative(),
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
  labelsWithheld: z.literal(true)
}).strict();
