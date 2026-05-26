import { forwardToPos } from "../../../../lib/pos/forwardPos";
import { posForwardOptionsFromRequest } from "../../../../lib/pos/posForwardFromRequest";

/** Host potvrdil úmysl zaplatit (částka včetně zvoleného spropitného v modalu účtu). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return forwardToPos(posForwardOptionsFromRequest(req, "BILL_PAY_CONFIRMED", body));
}
