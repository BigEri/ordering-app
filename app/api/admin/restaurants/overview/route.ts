import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { buildRestaurantsOverview } from "../../../../../lib/server/restaurantOverview";

export const dynamic = "force-dynamic";

/** SUPER_ADMIN: souhrn provozoven pro dashboard (Dotykačka, tablety, onboarding). */
export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const payload = await buildRestaurantsOverview();
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
