import { forwardToPos } from "../../../../lib/pos/forwardPos";
import { posForwardOptionsFromRequest } from "../../../../lib/pos/posForwardFromRequest";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return forwardToPos(posForwardOptionsFromRequest(req, "STAFF_CALL", body));
}

