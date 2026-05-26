import type { NextRequest } from "next/server";

import { prisma } from "./prisma";
import type { DbUser, MembershipRole } from "./db";
import { createSessionToken, verifySessionToken, type SessionPayload } from "./sessionToken";

export type { SessionPayload };

const SESSION_COOKIE = "oa_session";
const ACTIVE_RESTAURANT_COOKIE = "oa_rid";

export { createSessionToken, verifySessionToken };

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return verifySessionToken(raw);
}

export function getSessionFromCookieHeader(cookieHeader: string | null | undefined): SessionPayload | null {
  const raw = typeof cookieHeader === "string" ? cookieHeader : "";
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  const hit = parts.find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!hit) return null;
  const val = hit.slice(`${SESSION_COOKIE}=`.length);
  if (!val) return null;
  return verifySessionToken(val);
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function activeRestaurantCookieName() {
  return ACTIVE_RESTAURANT_COOKIE;
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const row = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, passwordHash: true, globalRole: true, createdAtIso: true },
  });
  if (!row) return null;
  if (row.globalRole !== "SUPER_ADMIN" && row.globalRole !== "USER") return null;
  return row as DbUser;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const row = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, passwordHash: true, globalRole: true, createdAtIso: true },
  });
  if (!row) return null;
  if (row.globalRole !== "SUPER_ADMIN" && row.globalRole !== "USER") return null;
  return row as DbUser;
}

export async function listMembershipsForUser(
  userId: string,
): Promise<Array<{ restaurantId: string; role: MembershipRole }>> {
  const rows = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAtIso: "asc" },
    select: { restaurantId: true, role: true },
  });
  return rows as Array<{ restaurantId: string; role: MembershipRole }>;
}

export async function userHasRestaurantAccess(
  userId: string,
  restaurantId: string,
): Promise<{ ok: true; role: MembershipRole } | { ok: false }> {
  const row = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
    select: { role: true },
  });
  const role = row?.role;
  if (role === "RESTAURANT_ADMIN" || role === "STAFF") return { ok: true, role };
  return { ok: false };
}
