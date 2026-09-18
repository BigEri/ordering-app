import { NextResponse } from "next/server";

import { checkRateLimit, clientIpFromRequest } from "../../../../../lib/server/rateLimit";
import { completeSandboxDemoPayment, peekSandboxDemoPayment } from "../../../../../lib/xpay/payments";

export const dynamic = "force-dynamic";

function idsFrom(req: Request, body: { paymentId?: unknown; token?: unknown } | null) {
  const url = new URL(req.url);
  const paymentId =
    (typeof body?.paymentId === "string" ? body.paymentId : url.searchParams.get("pid") ?? "").trim();
  const token = (typeof body?.token === "string" ? body.token : url.searchParams.get("t") ?? "").trim();
  return { paymentId, token };
}

export async function GET(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`xpay-demo:${ip}`, 40, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  const { paymentId, token } = idsFrom(req, null);
  if (!paymentId || !token) return NextResponse.json({ ok: false, error: "Missing pid" }, { status: 400 });
  const peeked = await peekSandboxDemoPayment({ paymentId, token });
  if (!peeked.ok) return NextResponse.json({ ok: false, error: peeked.error }, { status: peeked.status });
  return NextResponse.json(peeked);
}

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`xpay-demo:${ip}`, 40, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as {
    paymentId?: unknown;
    token?: unknown;
    action?: unknown;
  } | null;
  const { paymentId, token } = idsFrom(req, body);
  const action = body?.action === "fail" ? "fail" : body?.action === "pay" ? "pay" : null;
  if (!paymentId || !token || !action) {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }
  const done = await completeSandboxDemoPayment({ paymentId, token, action });
  if (!done.ok) return NextResponse.json({ ok: false, error: done.error }, { status: done.status });
  return NextResponse.json(done);
}
