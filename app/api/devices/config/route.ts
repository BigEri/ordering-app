import { NextRequest, NextResponse } from "next/server";

import { getDeviceReloadNonce, getEffectiveTable } from "../../../../lib/server/deviceRegistry";

/** Konfigurace stolu se mění; bez toho tablety agresivně cachují GET a nevidí změny z adminu. */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, no-cache, must-revalidate" };

export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get("deviceId")?.trim() ?? "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400, headers: NO_STORE });
  }

  // Strict mode: binding exists only if it's stored in DB (kiosk_device_bindings).
  // Presence fallback would make "removed device" still look paired.
  const t = await getEffectiveTable(deviceId, { allowFallback: false });
  const reloadNonce = getDeviceReloadNonce(deviceId);
  if (!t) {
    return NextResponse.json({ ok: true, binding: null, reloadNonce }, { headers: NO_STORE });
  }

  return NextResponse.json(
    {
      ok: true,
      binding: {
        tableId: t.tableId,
        tableLabel: t.tableLabel,
        restaurantId: t.restaurantId || null,
      },
      reloadNonce,
    },
    { headers: NO_STORE },
  );
}
