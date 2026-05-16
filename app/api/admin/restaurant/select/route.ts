import { NextResponse } from "next/server";

import { activeRestaurantCookieName, userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    const body = (await req.json()) as { restaurantId?: unknown };
    const restaurantId = typeof body?.restaurantId === "string" ? body.restaurantId.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing restaurantId" }, { status: 400 });
    }

    if (session.globalRole !== "SUPER_ADMIN") {
      const access = await userHasRestaurantAccess(session.userId, restaurantId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(activeRestaurantCookieName(), restaurantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

