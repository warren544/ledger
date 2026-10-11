import { z } from "zod";
import { withConnectedRuleService } from "../../../server/recon/runtime.js";
import { actorFromRequest } from "../../../server/recon/auth.js";
import { errorResponse, readJsonBody } from "../_lib/recon.js";
import { readFrozenRuleSet } from "../../../server/recon/holdout.js";

const inputSchema = z.object({ pack: z.enum(["transport", "billing"]), beforeRuleId: z.string().uuid().optional(), beforeVersion: z.number().int().positive().optional(), afterRuleId: z.string().uuid().optional(), afterVersion: z.number().int().positive().optional() }).strict();

export async function POST(request: Request) {
  try {
    const actor = actorFromRequest(request);
    const input = inputSchema.parse(await readJsonBody(request));
    const set = await readFrozenRuleSet(input.pack);
    return Response.json(await withConnectedRuleService((service) => service.replay(actor, { ...set, beforeRuleId: input.beforeRuleId, beforeVersion: input.beforeVersion, afterRuleId: input.afterRuleId, afterVersion: input.afterVersion })));
  } catch (error) { return errorResponse(error); }
}
