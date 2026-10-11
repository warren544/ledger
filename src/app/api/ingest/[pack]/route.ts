import { readJsonBody, withReconService, parsePack } from "../../_lib/recon.js";

export async function POST(request: Request, context: { params: Promise<{ pack: string }> }) {
  return withReconService(request, async (service, actor) => service.ingest(actor, parsePack((await context.params).pack), await readJsonBody(request)));
}
