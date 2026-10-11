import { z } from "zod";
import { issueDemoSession, type ReconActorRole } from "../../../../server/recon/auth";
import { errorResponse, readJsonBody } from "../../_lib/recon";

const inputSchema = z.object({
  role: z.enum(["agent", "demo_operator", "human_approver"]),
  workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
}).strict();

/** Demo-only session minting. Production authentication remains deferred. */
export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await readJsonBody(request));
    const secret = process.env.LEDGER_DEMO_SESSION_SECRET;
    if (!secret) throw new Error("authentication required");
    const token = issueDemoSession(input.role as ReconActorRole, input.workspaceId, secret);
    return Response.json({ token, actor: { role: input.role, workspaceId: input.workspaceId } });
  } catch (error) {
    return errorResponse(error);
  }
}
