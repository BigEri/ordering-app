import { NextResponse } from "next/server";

import { upsertDevicePairingCodeAsync } from "../../../../lib/server/devicePairingCodes";
import { getKioskDeviceBinding } from "../../../../lib/server/kioskDeviceBindings";
import { checkRateLimit, clientIpFromRequest } from "../../../../lib/server/rateLimit";

export const dynamic = "force-dynamic";

const MAX_PAIRING_CODE_PER_IP = 30;
const PAIRING_CODE_WINDOW_MS = 60 * 60 * 1000;

/** Tablet zaregistruje kód pro párování v administraci (bez přihlášení). Opakovaný POST vrací stejný platný kód; `rotate: true` vynutí nový. */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const rl = checkRateLimit(`pair-code:${ip}`, MAX_PAIRING_CODE_PER_IP, PAIRING_CODE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
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
  const rotate = o.rotate === true;
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
    const { code, expiresAtIso } = await upsertDevicePairingCodeAsync(deviceId, { rotate });
    return NextResponse.json({ ok: true, code, expiresAtIso });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
