import crypto from "crypto";

import type { GlobalRole } from "./db";

export type SessionPayload = {
  v: 1;
  userId: string;
  email: string;
  globalRole: GlobalRole;
  exp: number;
  /** Musí sedět s User.sessionVersion (invalidace po změně hesla). */
  sv?: number;
};

function authSecret(): string | null {
  const s = process.env.APP_AUTH_SECRET?.trim();
  return s || null;
}

function requireAuthSecret(): string {
  const s = authSecret();
  if (!s) throw new Error("Missing APP_AUTH_SECRET env var.");
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

function sign(data: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest());
}

function b64urlToBuf(input: string): Buffer {
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}

export function createSessionToken(
  input: Omit<SessionPayload, "v" | "exp"> & { sv: number },
  ttlSeconds = 60 * 60 * 24 * 14,
) {
  const secret = requireAuthSecret();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: SessionPayload = { v: 1, exp, ...input };
  const body = b64urlJson(payload);
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

/** Ověří podpis a expiraci; bez APP_AUTH_SECRET vrátí null (bez výjimky — vhodné pro middleware). */
export function verifySessionToken(token: string): SessionPayload | null {
  const secret = authSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = sign(body, secret);
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
