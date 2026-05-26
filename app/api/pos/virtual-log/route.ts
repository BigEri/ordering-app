import { NextResponse } from "next/server";

import { readVirtualPosEvents } from "../../../../lib/pos/virtualPosLog";
import { requireAdminSession } from "../../../../lib/server/adminGuard";

export async function GET(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(500, Math.max(1, Number(limitRaw) || 200));

  const events = await readVirtualPosEvents(limit);
  return NextResponse.json({
    ok: true,
    count: events.length,
    events,
  });
}
