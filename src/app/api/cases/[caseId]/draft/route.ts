import { actorFromRequest } from "../../../../../server/recon/auth";
import { createReconDraftDependencies, withConnectedReconService } from "../../../../../server/recon/runtime";
import { errorResponse, readJsonBody } from "../../../_lib/recon";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const caseId = (await context.params).caseId;
    const actor = actorFromRequest(request);
    const body = await readJsonBody(request);
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("request body must be an object");
    const exceptionId = (body as { exceptionId?: unknown }).exceptionId;
    if (typeof exceptionId !== "string") throw new Error("exceptionId is required");
    return Response.json(await withConnectedReconService((service) => service.draft(actor, caseId, exceptionId, createReconDraftDependencies())));
  } catch (error) { return errorResponse(error); }
}
