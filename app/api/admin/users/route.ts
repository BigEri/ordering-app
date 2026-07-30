import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { requireAdminSession, type AdminSession } from "../../../../lib/server/adminGuard";
import { PASSWORD_MIN_LENGTH, isPasswordLongEnough } from "../../../../lib/server/passwordPolicy";
import { nowIso, type MembershipRole } from "../../../../lib/server/db";
import { prisma } from "../../../../lib/server/prisma";
import {
  activeRestaurantCookieName,
  userHasRestaurantAccess,
} from "../../../../lib/server/auth";
import { cookieValueFromHeader } from "../../../../lib/server/httpCookie";

export const dynamic = "force-dynamic";

/**
 * Prefer explicit restaurant from URL/body (superadmin viewing A while cookie may be B),
 * else active `oa_rid`. Non-super must have membership access.
 */
async function resolveRestaurantIdForUsers(
  session: AdminSession,
  cookieHeader: string | null,
  fromExplicit: string,
): Promise<string> {
  const fromCookie = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
  const rid = fromExplicit.trim() || fromCookie;
  if (!rid) throw new Error("NO_RESTAURANT");
  if (session.globalRole !== "SUPER_ADMIN") {
    const access = await userHasRestaurantAccess(session.userId, rid);
    if (!access.ok) throw new Error("FORBIDDEN");
  }
  return rid;
}

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);
    const url = new URL(req.url);
    const fromQuery = (url.searchParams.get("restaurantId") ?? "").trim();
    const restaurantId = await resolveRestaurantIdForUsers(session, cookieHeader, fromQuery);

    const rows = await prisma.membership.findMany({
      where: { restaurantId },
      select: { role: true, user: { select: { id: true, email: true, globalRole: true } } },
    });
    const users = rows
      .map((r) => ({
        id: r.user.id,
        email: r.user.email,
        globalRole: r.user.globalRole,
        role: r.role as MembershipRole,
      }))
      .sort(
        (a, b) =>
          a.role.localeCompare(b.role, "en") ||
          a.email.toLowerCase().localeCompare(b.email.toLowerCase(), "en"),
      );
    return NextResponse.json({
      ok: true,
      users,
      restaurantId,
      sessionUserId: session.userId,
      sessionGlobalRole: session.globalRole,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "NO_RESTAURANT") return NextResponse.json({ ok: false, error: "No restaurant selected" }, { status: 400 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const email = typeof o.email === "string" ? o.email.trim() : "";
    const password = typeof o.password === "string" ? o.password : "";
    const role = typeof o.role === "string" ? o.role : "";
    const fromBody = typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";
    if (!email || !password || (role !== "RESTAURANT_ADMIN" && role !== "STAFF")) {
      return NextResponse.json({ ok: false, error: "Missing email/password/role" }, { status: 400 });
    }
    if (!isPasswordLongEnough(password)) {
      return NextResponse.json(
        { ok: false, error: `Password too short (min. ${PASSWORD_MIN_LENGTH} characters)` },
        { status: 400 },
      );
    }

    const restaurantId = await resolveRestaurantIdForUsers(session, cookieHeader, fromBody);

    // Only restaurant admins (or super admin) can manage users.
    if (session.globalRole !== "SUPER_ADMIN") {
      const meRole = await prisma.membership.findUnique({
        where: { userId_restaurantId: { userId: session.userId, restaurantId } },
        select: { role: true },
      });
      if (meRole?.role !== "RESTAURANT_ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const createdAtIso = nowIso();

    const passwordHash = await bcrypt.hash(password, 12);
    const emailTrimmed = email.trim();
    const res = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: { equals: emailTrimmed, mode: "insensitive" } },
        select: { id: true },
      });
      const userId = existing?.id ?? crypto.randomUUID();
      if (!existing?.id) {
        await tx.user.create({
          data: { id: userId, email: emailTrimmed, passwordHash, globalRole: "USER", createdAtIso },
        });
      } else {
        await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      }
      await tx.membership.upsert({
        where: { userId_restaurantId: { userId, restaurantId } },
        update: { role, createdAtIso },
        create: { userId, restaurantId, role, createdAtIso },
      });
      return { userId };
    });

    return NextResponse.json({ ok: true, userId: res.userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "NO_RESTAURANT") return NextResponse.json({ ok: false, error: "No restaurant selected" }, { status: 400 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const userId = typeof o.userId === "string" ? o.userId.trim() : "";
    const fromBody = typeof o.restaurantId === "string" ? o.restaurantId.trim() : "";
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 });
    }

    const restaurantId = await resolveRestaurantIdForUsers(session, cookieHeader, fromBody);

    if (userId === session.userId) {
      return NextResponse.json({ ok: false, error: "Cannot remove yourself" }, { status: 400 });
    }

    const target = await prisma.membership.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      select: { role: true, user: { select: { globalRole: true } } },
    });
    if (!target?.role) {
      return NextResponse.json({ ok: false, error: "User not in restaurant" }, { status: 404 });
    }
    if (target.user.globalRole === "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Cannot remove superadmin" }, { status: 403 });
    }

    if (session.globalRole !== "SUPER_ADMIN") {
      const meRole = await prisma.membership.findUnique({
        where: { userId_restaurantId: { userId: session.userId, restaurantId } },
        select: { role: true },
      });
      if (meRole?.role !== "RESTAURANT_ADMIN") {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
      if (target.role === "RESTAURANT_ADMIN") {
        return NextResponse.json(
          { ok: false, error: "Only superadmin can remove restaurant admins" },
          { status: 403 },
        );
      }
    }

    const r = await prisma.membership.deleteMany({ where: { userId, restaurantId } });
    if (r.count === 0) {
      return NextResponse.json({ ok: false, error: "User not in restaurant" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "NO_RESTAURANT") return NextResponse.json({ ok: false, error: "No restaurant selected" }, { status: 400 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
