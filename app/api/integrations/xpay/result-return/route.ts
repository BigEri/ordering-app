import { NextResponse } from "next/server";

import { checkRateLimit, clientIpFromRequest } from "../../../../../lib/server/rateLimit";
import { confirmXpayReturn } from "../../../../../lib/xpay/payments";

export const dynamic = "force-dynamic";

/**
 * Host se vrací z Nexi HPP. Ověříme platbu u brány a uzavřeme účet v Dotykačce
 * i když webhook ještě nedorazil.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`xpay-return:${ip}`, 30, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });

  const url = new URL(req.url);
  const body = (await req.json().catch(() => null)) as { paymentId?: unknown } | null;
  const paymentId = (
    (typeof body?.paymentId === "string" ? body.paymentId : url.searchParams.get("pid") ?? "")
  ).trim();
  if (!paymentId) return NextResponse.json({ ok: false, error: "Missing pid" }, { status: 400 });

  const view = await confirmXpayReturn(paymentId);
  if (!view) return NextResponse.json({ ok: false, error: "Platba nenalezena." }, { status: 404 });
  return NextResponse.json({ ok: true, status: view.status, tillSettled: view.tillSettled });
}
