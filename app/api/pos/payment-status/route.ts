import { NextResponse } from "next/server";

import { getDotykackaAccessTokenForCloud } from "../../../../lib/dotykacka/accessToken";
import { getDotykackaConfig } from "../../../../lib/dotykacka/config";
import { resolvePosTrustFromPayload } from "../../../../lib/pos/resolvePosTrustFromPayload";
import { buildDotykackaTableSessionExternalId } from "../../../../lib/dotykacka/syncOrder";

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
  const restaurantId = posTrust.restaurantId;

  const cfgFull = await getDotykackaConfig(restaurantId);
  if (!cfgFull) {
    return NextResponse.json({ ok: true, configured: false, paid: false });
  }
  const cfg = {
    apiBase: cfgFull.apiBase,
    refreshToken: cfgFull.refreshToken,
    cloudId: cfgFull.cloudId,
    branchId: cfgFull.branchId,
  };

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

  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const sessionExternalId = buildDotykackaTableSessionExternalId(
    // buildDotykackaTableSessionExternalId uses only cloudId/branchId; productMap is irrelevant here.
    { ...cfg, productMap: {} } as any,
    { tableId: String(tableId), deviceId },
  );

  const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/branches/${cfg.branchId}/pos-actions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "order/list", "table-id": tableId }),
  });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Dotykačka order/list ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
  }
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "Dotykačka order/list: invalid JSON" }, { status: 502 });
  }

  const code = json && typeof json === "object" && "code" in json ? (json as { code?: unknown }).code : undefined;
  if (typeof code === "number" && code !== 0) {
    return NextResponse.json({ ok: false, error: `Dotykačka order/list: code ${code}` }, { status: 502 });
  }

  const orders = json && typeof json === "object" && "orders" in json ? (json as { orders?: unknown }).orders : null;
  const list = Array.isArray(orders) ? orders : [];

  for (const row of list) {
    const ord = row && typeof row === "object" && "order" in row ? (row as { order?: unknown }).order : null;
    if (!ord || typeof ord !== "object") continue;
    const ext = (ord as Record<string, unknown>)["external-id"];
    if (typeof ext !== "string" || ext.trim() !== sessionExternalId) continue;
    const rec = ord as Record<string, unknown>;
    const paid = rec.paid === true;
    const total = typeof rec["price-total"] === "number" ? rec["price-total"] : Number(rec["price-total"]);
    return NextResponse.json({
      ok: true,
      configured: true,
      paid,
      totalCzk: Number.isFinite(total) ? Math.round(total) : null,
      orderId: typeof rec.id === "number" ? rec.id : null,
    });
  }

  // `order/list` typicky vrací jen otevřené účty na stole. Po zaplacení může order zmizet ze seznamu.
  // Fallback: dohledat poslední order podle externalId v entitě `orders` a ověřit `paid=true`.
  const filter = encodeURIComponent(
    `_branchId|eq|${cfg.branchId};externalId|eq|${sessionExternalId};paid|eq|true;canceledDate|eq|null`,
  );
  const ordersUrl = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/orders?filter=${filter}&sort=-completed&page=1&limit=1`;
  const res2 = await fetch(ordersUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text2 = await res2.text();
  if (res2.ok) {
    try {
      const arr = text2 ? (JSON.parse(text2) as unknown) : null;
      const rows = Array.isArray(arr)
        ? arr
        : arr && typeof arr === "object" && "data" in arr
          ? (arr as { data?: unknown }).data
          : [];
      if (Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === "object") {
        const rec = rows[0] as Record<string, unknown>;
        const paid = rec.paid === true;
        const total = typeof rec["priceTotal"] === "number" ? rec["priceTotal"] : Number(rec["priceTotal"]);
        if (paid) {
          return NextResponse.json({
            ok: true,
            configured: true,
            paid: true,
            totalCzk: Number.isFinite(total) ? Math.round(total) : null,
            orderId: typeof rec.id === "number" ? rec.id : null,
          });
        }
      }
    } catch {
      // ignore parse errors, fall through to unpaid
    }
  }

  return NextResponse.json({ ok: true, configured: true, paid: false, totalCzk: null });
}

