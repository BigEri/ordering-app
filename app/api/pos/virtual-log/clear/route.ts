import { NextResponse } from "next/server";

import { clearVirtualPosEvents } from "../../../../../lib/pos/virtualPosLog";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";

export async function POST(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await clearVirtualPosEvents();
  return NextResponse.json({ ok: true });
}
