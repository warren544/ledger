import { withReconService } from "../../../_lib/recon.js";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  return withReconService(request, async (service, actor) => service.run(actor, (await context.params).caseId));
}
