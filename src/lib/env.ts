import "./load-env.js";
import { isIP } from "node:net";

export interface Env {
  nodeEnv: "development" | "test" | "production";
  workspaceId: string;
  mongodbUri?: string;
  openaiApiKey?: string;
}

const NODE_ENV_VALUES = new Set<Env["nodeEnv"]>(["development", "test", "production"]);
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*$/;

function invalid(name: string, detail: string): never {
  throw new Error(`${name} ${detail}`);
}

function readOptionalValue(name: string, value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (value !== value.trim()) invalid(name, "must not have surrounding whitespace");
  return value;
}

function validatePort(name: string, value: string): void {
  if (!/^\d+$/.test(value)) invalid(name, "contains an invalid port");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid(name, "contains an invalid port");
}

function validateHost(name: string, value: string, allowPort: boolean): { hostname: string; hasPort: boolean } {
  if (value === "") invalid(name, "must contain a host");

  let hostname = value;
  let hasPort = false;
  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    if (closingBracket < 0 || isIP(value.slice(1, closingBracket)) !== 6) invalid(name, "contains an invalid IPv6 host");
    hostname = value.slice(1, closingBracket);
    const suffix = value.slice(closingBracket + 1);
    if (suffix !== "") {
      if (!allowPort || !suffix.startsWith(":")) invalid(name, "contains an invalid host");
      validatePort(name, suffix.slice(1));
      hasPort = true;
    }
    return { hostname, hasPort };
  }

  const colon = value.indexOf(":");
  if (colon >= 0) {
    if (value.indexOf(":", colon + 1) >= 0) invalid(name, "contains an unbracketed IPv6 host");
    if (!allowPort) invalid(name, "SRV hosts must not include a port");
    hostname = value.slice(0, colon);
    validatePort(name, value.slice(colon + 1));
    hasPort = true;
  }

  if (isIP(hostname) !== 4 && !HOSTNAME_PATTERN.test(hostname)) invalid(name, "contains an invalid host");
  return { hostname, hasPort };
}

function validateMongoUri(value: string): string {
  const standardPrefix = "mongodb://";
  const srvPrefix = "mongodb+srv://";
  const isSrv = value.startsWith(srvPrefix);
  const prefix = isSrv ? srvPrefix : value.startsWith(standardPrefix) ? standardPrefix : "";
  if (prefix === "") invalid("MONGODB_URI", "must use mongodb:// or mongodb+srv://");
  if (/\s|#/.test(value)) invalid("MONGODB_URI", "contains invalid characters");

  const remainder = value.slice(prefix.length);
  const queryIndex = remainder.indexOf("?");
  const pathIndex = remainder.indexOf("/");
  if (queryIndex >= 0 && (pathIndex < 0 || queryIndex < pathIndex)) invalid("MONGODB_URI", "must include / before query options");
  const authorityEnd = [pathIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? remainder.length;
  const authority = remainder.slice(0, authorityEnd);
  if (authority === "") invalid("MONGODB_URI", "must contain a host");

  const at = authority.lastIndexOf("@");
  const hostList = at >= 0 ? authority.slice(at + 1) : authority;
  if (at >= 0) {
    const userInfo = authority.slice(0, at);
    const separator = userInfo.indexOf(":");
    const username = separator >= 0 ? userInfo.slice(0, separator) : userInfo;
    const password = separator >= 0 ? userInfo.slice(separator + 1) : undefined;
    if (username === "") invalid("MONGODB_URI", "contains an invalid username");
    try {
      decodeURIComponent(username);
      if (password !== undefined) decodeURIComponent(password);
    } catch {
      invalid("MONGODB_URI", "contains invalid percent encoding");
    }
  }

  const hosts = hostList.split(",");
  if (isSrv && hosts.length !== 1) invalid("MONGODB_URI", "SRV format requires exactly one host");
  const parsedHosts = hosts.map((host) => validateHost("MONGODB_URI", host, !isSrv));
  if (isSrv) {
    const hostname = parsedHosts[0].hostname;
    if (parsedHosts[0].hasPort || isIP(hostname) !== 0 || hostname.toLowerCase() === "localhost" || hostname.split(".").length < 3) {
      invalid("MONGODB_URI", "SRV format requires a DNS hostname with at least three labels and no port");
    }
  }
  return value;
}

export function readEnv(input: Readonly<Record<string, string | undefined>> = process.env): Env {
  const nodeEnv = input.NODE_ENV ?? "development";
  if (!NODE_ENV_VALUES.has(nodeEnv as Env["nodeEnv"])) invalid("NODE_ENV", "must be development, test, or production");
  const workspaceId = input.LEDGER_WORKSPACE_ID ?? "demo";
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) invalid("LEDGER_WORKSPACE_ID", "must be a nonempty identifier using letters, numbers, _ or -");
  const mongodbUri = readOptionalValue("MONGODB_URI", input.MONGODB_URI);
  const openaiApiKey = readOptionalValue("OPENAI_API_KEY", input.OPENAI_API_KEY);
  return {
    nodeEnv: nodeEnv as Env["nodeEnv"],
    workspaceId,
    mongodbUri: mongodbUri === undefined ? undefined : validateMongoUri(mongodbUri),
    openaiApiKey
  };
}
