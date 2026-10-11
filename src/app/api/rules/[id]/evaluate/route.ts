import { z } from "zod";
import { withConnectedRuleService } from "../../../../../server/recon/runtime.js";
import { actorFromRequest } from "../../../../../server/recon/auth.js";
import { errorResponse, readJsonBody } from "../../../_lib/recon.js";
import { readFrozenRuleSet } from "../../../../../server/recon/holdout.js";

const inputSchema = z.object({ pack: z.enum(["transport", "billing"]) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const actor = actorFromRequest(request);
    const input = inputSchema.parse(await readJsonBody(request));
    const set = await readFrozenRuleSet(input.pack);
    return Response.json(await withConnectedRuleService((service) => service.evaluate(actor, id, set)));
  } catch (error) { return errorResponse(error); }
}
