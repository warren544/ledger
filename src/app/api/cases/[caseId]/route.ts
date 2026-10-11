import { withReconService } from "../../_lib/recon.js";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  return withReconService(request, async (service, actor) => service.get(actor, (await context.params).caseId));
}
