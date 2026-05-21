import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  activeRestaurantCookieName,
  createSessionToken,
  getUserByEmail,
  listMembershipsForUser,
  sessionCookieName,
} from "../../../../lib/server/auth";
import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Missing email or password" }, { status: 400 });
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };

  if (user.globalRole !== "SUPER_ADMIN") {
    const memberships = await listMembershipsForUser(user.id);
    if (memberships.length === 1) {
      res.cookies.set(activeRestaurantCookieName(), memberships[0].restaurantId, cookieOpts);
    }
  } else {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAtIso: "desc" },
      select: { id: true },
      take: 2,
    });
    if (restaurants.length === 1) {
      res.cookies.set(activeRestaurantCookieName(), restaurants[0].id, cookieOpts);
    }
  }

  return res;
}

