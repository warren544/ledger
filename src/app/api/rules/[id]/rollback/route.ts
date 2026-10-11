import { withConnectedRuleService } from "../../../../../server/recon/runtime";
import { actorFromRequest } from "../../../../../server/recon/auth";
import { errorResponse } from "../../../_lib/recon";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const actor = actorFromRequest(request);
    return Response.json(await withConnectedRuleService((service) => service.rollback(actor, id)));
  } catch (error) { return errorResponse(error); }
}
