import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  const v = hit.slice(`${name}=`.length);
  return v || null;
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = requireAdminSession(cookieHeader);
    const rid = cookieValue(cookieHeader, "oa_rid");
    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      orderBy: { createdAtIso: "asc" },
      select: { restaurantId: true, role: true },
    });
    let activeRestaurantName: string | null = null;
    if (rid) {
      const rn = await prisma.restaurant.findUnique({ where: { id: rid }, select: { name: true } });
      activeRestaurantName = rn?.name?.trim() ? rn.name.trim() : null;
    }
    return NextResponse.json({
      ok: true,
      session: { userId: session.userId, email: session.email, globalRole: session.globalRole },
      activeRestaurantId: rid,
      activeRestaurantName,
      memberships,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

