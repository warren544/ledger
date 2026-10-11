import { existsSync } from "node:fs";
import { join } from "node:path";

// Next bundles route modules, so keep the value passed to Node's env-file API a
// plain string rather than a URL-derived value. Scripts run from the repository
// root, and Next sets the same working directory for the app.
const defaultEnvPath = join(process.cwd(), ".env.local");

/** Load the repository-local env file without replacing process-provided values. */
export function loadLocalEnv(path = defaultEnvPath): void {
  if (!existsSync(path)) return;
  const existing = new Map(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  process.loadEnvFile(path);
  for (const [name, value] of existing) process.env[name] = value;
}

loadLocalEnv();
