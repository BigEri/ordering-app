import { NextResponse } from "next/server";

import { assertKioskPosRequest } from "../../../../../lib/xpay/assertKiosk";
import { cancelXpayPayment } from "../../../../../lib/xpay/payments";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const trust = await assertKioskPosRequest(req, body);
  if (!trust.ok) {
    return NextResponse.json({ ok: false, error: trust.error }, { status: trust.status });
  }

  const paymentId =
    typeof trust.sanitized.paymentId === "string" ? trust.sanitized.paymentId.trim() : "";
  if (!paymentId) {
    return NextResponse.json({ ok: false, error: "Missing paymentId" }, { status: 400 });
  }

  const cancelled = await cancelXpayPayment({
    restaurantId: trust.restaurantId,
    deviceId: trust.deviceId,
    paymentId,
  });
  if (!cancelled.ok) {
    return NextResponse.json({ ok: false, error: cancelled.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
