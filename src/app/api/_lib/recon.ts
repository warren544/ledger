import { z } from "zod";
import { actorFromRequest } from "../../../server/recon/auth";
import { withConnectedReconService } from "../../../server/recon/runtime";
import type { createReconService } from "../../../server/recon/service";

export const MAX_RECON_BODY_BYTES = 256 * 1024;

export async function readJsonBody(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_RECON_BODY_BYTES)) throw new Error("request body too large");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RECON_BODY_BYTES) throw new Error("request body too large");
  try { return JSON.parse(body) as unknown; } catch { throw new Error("request body must be valid JSON"); }
}

export const errorResponse = (error: unknown): Response => {
  const message = error instanceof Error ? error.message : "request failed";
  const status = message === "authentication required" || message === "invalid demo session" ? 401 : message === "capability denied" ? 403 : message === "case not found" ? 404 : message.includes("Mongo") ? 503 : 400;
  return Response.json({ error: status === 401 ? "unauthenticated" : status === 403 ? "capability denied" : status === 404 ? "not found" : "request failed" }, { status });
};

export async function withReconService<T>(request: Request, work: (service: ReturnType<typeof createReconService>, actor: ReturnType<typeof actorFromRequest>) => Promise<T>): Promise<Response> {
  try {
    const actor = actorFromRequest(request);
    return Response.json(await withConnectedReconService((service) => work(service, actor)));
  } catch (error) { return errorResponse(error); }
}

export function parsePack(value: unknown): string {
  return z.enum(["transport", "billing"]).parse(value);
}
