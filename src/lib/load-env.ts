import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const defaultEnvPath = fileURLToPath(new URL("../../.env.local", import.meta.url));

/** Load the repository-local env file without replacing process-provided values. */
export function loadLocalEnv(path = defaultEnvPath): void {
  if (!existsSync(path)) return;
  const existing = new Map(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  process.loadEnvFile(path);
  for (const [name, value] of existing) process.env[name] = value;
}

loadLocalEnv();
