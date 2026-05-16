import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true },
    });
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const rows = await prisma.membership.findMany({
      where: { restaurantId },
      select: { role: true, user: { select: { id: true, email: true, globalRole: true } } },
    });
    const users = rows
      .map((r) => ({
        id: r.user.id,
        email: r.user.email,
        globalRole: r.user.globalRole,
        role: r.role,
      }))
      .sort(
        (a, b) =>
          a.role.localeCompare(b.role, "en") ||
          a.email.toLowerCase().localeCompare(b.email.toLowerCase(), "en"),
      );

    return NextResponse.json({ ok: true, restaurant, users });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

