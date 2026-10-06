export interface Env {
  nodeEnv: "development" | "test" | "production";
  workspaceId: string;
  mongodbUri?: string;
  openaiApiKey?: string;
}

export function readEnv(input: Readonly<Record<string, string | undefined>> = process.env): Env {
  const nodeEnv = input.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const workspaceId = input.LEDGER_WORKSPACE_ID ?? "demo";
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    throw new Error("LEDGER_WORKSPACE_ID contains unsupported characters");
  }
  return {
    nodeEnv: nodeEnv as Env["nodeEnv"],
    workspaceId,
    mongodbUri: input.MONGODB_URI || undefined,
    openaiApiKey: input.OPENAI_API_KEY || undefined
  };
}
