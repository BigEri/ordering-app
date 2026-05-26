import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Zrušeno — použijte GET /api/admin/devices/pairing-lookup (vyžaduje admin session). */
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use /api/admin/devices/pairing-lookup" },
    { status: 410 },
  );
}
