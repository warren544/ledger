import { readEnv } from "../../../lib/env.js";

export async function GET() {
  try {
    const env = readEnv();
    return Response.json({ status: "ok", dependencies: { mongo: env.mongodbUri ? "configured" : "not_configured", openai: env.openaiApiKey ? "configured" : "not_configured" } });
  } catch { return Response.json({ status: "degraded", dependencies: { mongo: "unknown", openai: "unknown" } }, { status: 503 }); }
}
