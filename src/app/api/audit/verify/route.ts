import { withReconService } from "../../_lib/recon";

export async function GET(request: Request) {
  return withReconService(request, (service, actor) => service.verify(actor));
}
