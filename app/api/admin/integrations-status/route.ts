import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { buildIntegrationsStatus } from "../../../../lib/server/integrationsStatus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get("restaurantId")?.trim() || null;
    const payload = await buildIntegrationsStatus(restaurantId);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
