import { NextResponse } from "next/server";

import { assertKioskPosRequest } from "../../../../../lib/xpay/assertKiosk";
import { createTableXpayPayment } from "../../../../../lib/xpay/payments";

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

  const o = trust.sanitized;
  const tableId =
    typeof o.tableId === "string"
      ? o.tableId.trim()
      : o.tableId != null
        ? String(o.tableId).trim()
        : "";
  const tableLabel = typeof o.tableLabel === "string" ? o.tableLabel.trim() : "";
  const ordersTotal = typeof o.ordersTotal === "number" ? o.ordersTotal : Number(o.ordersTotal);
  const tipPct = typeof o.tipPct === "number" ? o.tipPct : Number(o.tipPct);
  const tipAmount = typeof o.tipAmount === "number" ? o.tipAmount : Number(o.tipAmount);
  const locale = typeof o.locale === "string" ? o.locale : null;
  const splitItems = o.splitItems;

  const created = await createTableXpayPayment({
    restaurantId: trust.restaurantId,
    deviceId: trust.deviceId,
    tableId,
    tableLabel,
    ordersTotalCzk: Number.isFinite(ordersTotal) ? ordersTotal : 0,
    tipPct: Number.isFinite(tipPct) ? tipPct : 0,
    tipAmountCzk: Number.isFinite(tipAmount) ? tipAmount : 0,
    locale,
    splitItems,
  });

  if (!created.ok) {
    if ("notConfigured" in created) {
      return NextResponse.json({ ok: false, notConfigured: true }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: created.error }, { status: created.status ?? 502 });
  }

  return NextResponse.json({ ok: true, ...created.payment });
}
