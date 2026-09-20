import { NextResponse } from "next/server";

import { getDotykackaAccessTokenForCloud } from "../../../../lib/dotykacka/accessToken";
import { getDotykackaConfig } from "../../../../lib/dotykacka/config";
import { fetchTableOpenBillFromDotykacka } from "../../../../lib/dotykacka/tableOpenBill";
import { getRestaurantMenuSource } from "../../../../lib/menu/restaurantMenuSource";
import { resolvePosTrustFromPayload } from "../../../../lib/pos/resolvePosTrustFromPayload";
import { fetchStoryousBills } from "../../../../lib/storyous/client";
import { getStoryousConfig } from "../../../../lib/storyous/config";
import { latestPaidBillForDesk, parseStoryousPaidBills } from "../../../../lib/storyous/paidBill";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;

  const posTrust = await resolvePosTrustFromPayload(o);
  if (!posTrust.ok) {
    return NextResponse.json({ ok: false, error: posTrust.error }, { status: posTrust.status });
  }

  const source = await getRestaurantMenuSource(posTrust.restaurantId);
  if (source === "storyous") {
    const tableId = typeof o.tableId === "string" ? o.tableId.trim() : o.tableId != null ? String(o.tableId).trim() : "";
    if (!tableId) {
      return NextResponse.json({
        ok: true,
        configured: true,
        liveTill: false,
        source: "storyous",
        open: false,
        lines: [],
        totalCzk: 0,
        orderIds: [],
      });
    }
    try {
      const cfg = await getStoryousConfig(posTrust.restaurantId);
      if (!cfg) {
        return NextResponse.json({
          ok: true,
          configured: false,
          liveTill: false,
          source: "storyous",
          open: false,
          lines: [],
          totalCzk: 0,
          orderIds: [],
        });
      }
      const fromIso = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      const billsJson = await fetchStoryousBills(cfg, cfg.merchantId, cfg.placeId, fromIso);
      const paid = latestPaidBillForDesk(parseStoryousPaidBills(billsJson), tableId, Date.now() - 8 * 60 * 60 * 1000);
      return NextResponse.json({
        ok: true,
        configured: true,
        liveTill: false,
        source: "storyous",
        open: false,
        lines: [],
        totalCzk: paid?.totalCzk ?? 0,
        orderIds: [],
        paidBill: paid
          ? { billId: paid.billId, totalCzk: paid.totalCzk, paidAtMs: paid.paidAtMs }
          : null,
      });
    } catch {
      return NextResponse.json({
        ok: true,
        configured: true,
        liveTill: false,
        source: "storyous",
        open: false,
        lines: [],
        totalCzk: 0,
        orderIds: [],
        paidBill: null,
      });
    }
  }

  const cfgFull = await getDotykackaConfig(posTrust.restaurantId);
  if (!cfgFull) {
    return NextResponse.json({
      ok: true,
      configured: false,
      open: false,
      lines: [],
      totalCzk: 0,
      orderIds: [],
    });
  }

  const tableRaw = o.tableId;
  const tableId =
    typeof tableRaw === "string"
      ? Number.parseInt(tableRaw, 10)
      : typeof tableRaw === "number"
        ? tableRaw
        : NaN;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId.trim() : "";
  if (!Number.isFinite(tableId) || !deviceId) {
    return NextResponse.json({ ok: false, error: "Missing tableId/deviceId" }, { status: 400 });
  }

  const accessToken = await getDotykackaAccessTokenForCloud(cfgFull);
  const fetched = await fetchTableOpenBillFromDotykacka(cfgFull, accessToken, tableId);
  if (!fetched.ok) {
    return NextResponse.json({ ok: false, error: fetched.error }, { status: fetched.httpStatus === 404 ? 502 : 502 });
  }

  const { bill } = fetched;
  return NextResponse.json({
    ok: true,
    configured: fetched.configured,
    open: bill.open,
    lines: bill.lines,
    totalCzk: bill.totalCzk,
    orderIds: bill.orderIds,
  });
}
