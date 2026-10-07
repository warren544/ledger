import "../src/lib/load-env.js";
import { runAdaptersSmoke } from "../src/server/adapters.js";

const args = new Set(process.argv.slice(2));
try {
  const result = await runAdaptersSmoke(process.env, args.has("--live"), args.has("--confirm-api-cost"));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "adapter smoke failed");
  process.exitCode = 1;
}
