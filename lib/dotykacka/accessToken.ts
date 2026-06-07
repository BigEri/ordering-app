import crypto from "crypto";
import { Buffer } from "node:buffer";

import type { DotykackaConfig } from "./config";
import { fetchWithRetry } from "./fetchRetry";

/** Minimální údaje pro signin (používá se jen apiBase, refreshToken, cloudId). */
export type DotykackaSignInParams = Pick<DotykackaConfig, "apiBase" | "refreshToken" | "cloudId">;

type Cached = { token: string; expiresAtMs: number };

const tokenCache = new Map<string, Cached>();

function cacheKey(cfg: DotykackaSignInParams): string {
  const h = crypto.createHash("sha256").update(cfg.refreshToken).digest("hex").slice(0, 32);
  return `${cfg.apiBase}|${cfg.cloudId}|${h}`;
}

function decodeJwtExpMs(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = Buffer.from(b64 + pad, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Access token pro konkrétní cloud (včetně _cloudId v těle signin).
 * Jednoduchá cache v paměti procesu (Next.js server).
 */
export async function getDotykackaAccessTokenForCloud(cfg: DotykackaSignInParams): Promise<string> {
  const now = Date.now();
  const skewMs = 60_000;
  const key = cacheKey(cfg);
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAtMs > now + skewMs) {
    return hit.token;
  }

  const url = `${cfg.apiBase}/v2/signin/token`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `User ${cfg.refreshToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ _cloudId: cfg.cloudId }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dotykačka signin/token ${res.status}: ${text.slice(0, 500)}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Dotykačka signin/token: neplatné JSON tělo odpovědi");
  }

  const accessToken =
    data && typeof data === "object" && "accessToken" in data
      ? (data as { accessToken?: string }).accessToken
      : undefined;
  if (!accessToken) {
    throw new Error("Dotykačka signin/token: chybí accessToken");
  }

  const exp = decodeJwtExpMs(accessToken);
  tokenCache.set(key, {
    token: accessToken,
    expiresAtMs: exp ?? now + 50 * 60 * 1000,
  });
  return accessToken;
}

/** Pro testy / po změně refresh tokenu */
export function clearDotykackaAccessTokenCache() {
  tokenCache.clear();
}
