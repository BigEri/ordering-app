import { NextResponse } from "next/server";

import { getStoryousConfig } from "../../../../lib/storyous/config";
import { fetchStoryousDeliveryOrderStatus } from "../../../../lib/storyous/client";
import { getRestaurantMenuSource } from "../../../../lib/menu/restaurantMenuSource";
import { resolvePosTrustFromPayload } from "../../../../lib/pos/resolvePosTrustFromPayload";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const orderId = typeof o.orderId === "string" ? o.orderId.trim() : "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
  }

  const posTrust = await resolvePosTrustFromPayload(o);
  if (!posTrust.ok) {
    return NextResponse.json({ ok: false, error: posTrust.error }, { status: posTrust.status });
  }

  const source = await getRestaurantMenuSource(posTrust.restaurantId);
  if (source !== "storyous") {
    return NextResponse.json({ ok: true, source, state: null });
  }
  const cfg = await getStoryousConfig(posTrust.restaurantId);
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "Storyous není napojený." }, { status: 400 });
  }
  try {
    const status = await fetchStoryousDeliveryOrderStatus(cfg, cfg.merchantId, cfg.placeId, orderId);
    return NextResponse.json({ ok: true, source: "storyous", ...(status ?? { state: null, orderId }) });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Stav objednávky se nepodařilo načíst.";
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
}
