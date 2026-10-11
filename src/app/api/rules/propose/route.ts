import { withConnectedRuleService, createReconRuleProposalGenerator } from "../../../../server/recon/runtime";
import { actorFromRequest } from "../../../../server/recon/auth";
import { errorResponse, readJsonBody } from "../../_lib/recon";

export async function POST(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const body = await readJsonBody(request);
    return Response.json(await withConnectedRuleService((service) => service.propose(actor, body, createReconRuleProposalGenerator())));
  } catch (error) { return errorResponse(error); }
}
