import { NextResponse } from "next/server";

import { upsertDevicePairingCodeAsync } from "../../../../lib/server/devicePairingCodes";
import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";

export const dynamic = "force-dynamic";

/** Tablet zaregistruje kód pro párování v administraci (bez přihlášení). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId.trim() : "";
  if (!deviceId || deviceId.length > 200) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }
  try {
    const binding = await getKioskDeviceBinding(deviceId);
    if (binding && (binding.pairingLocked ?? 0) === 1) {
      return NextResponse.json(
        { ok: false, error: "Párování je pro toto zařízení zakázané." },
        { status: 403 },
      );
    }
    const { code, expiresAtIso } = await upsertDevicePairingCodeAsync(deviceId);
    return NextResponse.json({ ok: true, code, expiresAtIso });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
