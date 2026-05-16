import { forwardToPos } from "../../../../lib/pos/forwardPos";

/** Host potvrdil úmysl zaplatit (částka včetně zvoleného spropitného v modalu účtu). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return forwardToPos({
    eventType: "BILL_PAY_CONFIRMED",
    payload: body,
    userAgent: req.headers.get("user-agent"),
  });
}
