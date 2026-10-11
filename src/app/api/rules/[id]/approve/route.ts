import { withConnectedRuleService } from "../../../../../server/recon/runtime";
import { actorFromRequest } from "../../../../../server/recon/auth";
import { errorResponse, readJsonBody } from "../../../_lib/recon";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const actor = actorFromRequest(request);
    const body = await readJsonBody(request);
    return Response.json(await withConnectedRuleService((service) => service.approve(actor, id, body)));
  } catch (error) { return errorResponse(error); }
}
