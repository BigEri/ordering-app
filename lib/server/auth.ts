import crypto from "crypto";
import type { NextRequest } from "next/server";

import { prisma } from "./prisma";
import type { DbUser, GlobalRole, MembershipRole } from "./db";

const SESSION_COOKIE = "oa_session";
const ACTIVE_RESTAURANT_COOKIE = "oa_rid";

type SessionPayload = {
  v: 1;
  userId: string;
  email: string;
  globalRole: GlobalRole;
  exp: number;
};

function secret(): string {
  const s = process.env.APP_AUTH_SECRET;
  if (!s) {
    throw new Error("Missing APP_AUTH_SECRET env var.");
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlJson(obj: unknown): string {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

function b64urlToBuf(input: string): Buffer {
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}

export function createSessionToken(input: Omit<SessionPayload, "v" | "exp">, ttlSeconds = 60 * 60 * 24 * 14) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SessionPayload = { v: 1, exp, ...input };
  const body = b64urlJson(payload);
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlToBuf(body).toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1) return null;
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.userId !== "string" || !payload.userId) return null;
  if (typeof payload.email !== "string" || !payload.email) return null;
  if (payload.globalRole !== "SUPER_ADMIN" && payload.globalRole !== "USER") return null;
  return payload;
}

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

