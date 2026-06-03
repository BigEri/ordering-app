/**
 * Edge-friendly session token verification for Next.js middleware.
 * Uses WebCrypto (crypto.subtle) and avoids Node built-ins (crypto, Buffer imports).
 */

import type { SessionPayload } from "./sessionToken";

function authSecret(): string | null {
  const s = process.env.APP_AUTH_SECRET?.trim();
  return s || null;
}

let cachedHmacKeySecret: string | null = null;
let cachedHmacKeyPromise: Promise<CryptoKey> | null = null;

async function getHmacSha256Key(secret: string): Promise<CryptoKey> {
  // Cache the imported CryptoKey across requests (Edge middleware can call this many times).
  // If the secret ever changes (rare), refresh the cache.
  if (cachedHmacKeyPromise && cachedHmacKeySecret === secret) return cachedHmacKeyPromise;
  cachedHmacKeySecret = secret;
  cachedHmacKeyPromise = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedHmacKeyPromise;
}

function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);

  const g: any = globalThis as any;
  if (typeof g.atob === "function") {
    const bin = g.atob(padded) as string;
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Node (tests) fallback without importing Buffer
  if (g.Buffer) {
    const buf = g.Buffer.from(padded, "base64") as Uint8Array;
    return new Uint8Array(buf);
  }

  throw new Error("No base64 decoder available");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const g: any = globalThis as any;
  if (typeof g.btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    return g
      .btoa(bin)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }
  if (g.Buffer) {
    return g.Buffer.from(bytes)
      .toString("base64")
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }
  throw new Error("No base64 encoder available");
}

function bytesEqualConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function signHmacSha256(data: string, secret: string): Promise<string> {
  const key = await getHmacSha256Key(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(sigBuf));
}

function parsePayloadJson(bodyB64Url: string): SessionPayload | null {
  try {
    const bytes = base64UrlToBytes(bodyB64Url);
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload || payload.v !== 1) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.userId !== "string" || !payload.userId) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    if (payload.globalRole !== "SUPER_ADMIN" && payload.globalRole !== "USER") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify signature and expiry; if APP_AUTH_SECRET missing returns null (middleware-safe).
 */
export async function verifySessionTokenEdge(token: string): Promise<SessionPayload | null> {
  const secret = authSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = await signHmacSha256(body, secret);
  const a = base64UrlToBytes(sig);
  const b = base64UrlToBytes(expected);
  if (!bytesEqualConstantTime(a, b)) return null;

  return parsePayloadJson(body);
}

