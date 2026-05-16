import { NextResponse } from "next/server";

import { getUnusedPairingCodeForDeviceAsync } from "../../../../lib/server/devicePairingCodes";

export const dynamic = "force-dynamic";

/** Veřejné: aktivní párovací kód pro deviceId (read-only, negeneruje nový kód). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId")?.trim() ?? "";
  if (!deviceId || deviceId.length > 200) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }
  const row = await getUnusedPairingCodeForDeviceAsync(deviceId);
  if (!row) {
    return NextResponse.json({ ok: true, code: null as string | null, expiresAtIso: null as string | null });
  }
  return NextResponse.json({ ok: true, code: row.code, expiresAtIso: row.expiresAtIso });
}
