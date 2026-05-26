import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { getUnusedPairingCodeForDeviceAsync } from "../../../../../lib/server/devicePairingCodes";

export const dynamic = "force-dynamic";

/** Jen pro přihlášené adminy — aktivní párovací kód tabletu (read-only). */
export async function GET(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
