import { forwardToPos } from "../../../../lib/pos/forwardPos";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return forwardToPos({
    eventType: "STAFF_CALL",
    payload: body,
    userAgent: req.headers.get("user-agent"),
  });
}

