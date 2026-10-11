import { withReconService } from "../_lib/recon";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return withReconService(request, (service, actor) => service.list(actor, query.get("pack") ?? undefined, query.get("status") ?? undefined));
}
