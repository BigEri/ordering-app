import { NextResponse } from "next/server";

import { getDotykackaAccessTokenForCloud } from "../../../../lib/dotykacka/accessToken";
import { getDotykackaConfig } from "../../../../lib/dotykacka/config";
import { fetchTableOpenBillFromDotykacka } from "../../../../lib/dotykacka/tableOpenBill";
import { getRestaurantMenuSource } from "../../../../lib/menu/restaurantMenuSource";
import { resolvePosTrustFromPayload } from "../../../../lib/pos/resolvePosTrustFromPayload";

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
