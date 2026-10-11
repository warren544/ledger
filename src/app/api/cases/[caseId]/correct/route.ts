import { withReconService, readJsonBody } from "../../../_lib/recon.js";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  return withReconService(request, async (service, actor) => service.correct(actor, (await context.params).caseId, await readJsonBody(request)));
}
