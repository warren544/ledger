import { z } from "zod";
import { withConnectedRuleService } from "../../../../../server/recon/runtime";
import { actorFromRequest } from "../../../../../server/recon/auth";
import { errorResponse, readJsonBody } from "../../../_lib/recon";
import { readFrozenRuleSet } from "../../../../../server/recon/holdout";

const inputSchema = z.object({ pack: z.enum(["transport", "billing"]) }).strict();

function parseEvaluateInput(value: unknown): z.infer<typeof inputSchema> {
  return inputSchema.parse(value);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = (await context.params).id;
    const actor = actorFromRequest(request);
    let input: z.infer<typeof inputSchema>;
    try {
      input = parseEvaluateInput(await readJsonBody(request));
    } catch (error) {
      if (error instanceof z.ZodError) return Response.json({ error: "request failed", details: error.issues }, { status: 400 });
      throw error;
    }
    const set = await readFrozenRuleSet(input.pack);
    return Response.json(await withConnectedRuleService((service) => service.evaluate(actor, id, set)));
  } catch (error) { return errorResponse(error); }
}
