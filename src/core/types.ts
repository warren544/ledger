export type ISODate = string;

export interface BaseDocument {
  id: string;
  workspaceId: string;
  schemaVersion: 1;
  createdAt: ISODate;
}

export interface SyntheticRecord extends BaseDocument {
  kind: "invoice" | "rate_sheet" | "service_log" | "email";
  customerId: string;
  source: "synthetic";
  payload: Record<string, unknown>;
}

export interface FixtureManifest {
  datasetId: string;
  datasetHash: string;
  generatedAt: ISODate;
  records: number;
  labelsWithheld: true;
}
