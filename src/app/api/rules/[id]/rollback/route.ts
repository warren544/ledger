import { withConnectedRuleService } from "../../../../../server/recon/runtime.js";
import { actorFromRequest } from "../../../../../server/recon/auth.js";
import { errorResponse } from "../../../_lib/recon.js";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const actor = actorFromRequest(request);
    return Response.json(await withConnectedRuleService((service) => service.rollback(actor, id)));
  } catch (error) { return errorResponse(error); }
}
