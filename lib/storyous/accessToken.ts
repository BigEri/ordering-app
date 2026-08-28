import crypto from "crypto";

import { fetchWithRetry } from "../dotykacka/fetchRetry";
import type { StoryousAppCredentials } from "./env";

type Cached = { token: string; expiresAtMs: number };

const tokenCache = new Map<string, Cached>();

function cacheKey(creds: StoryousAppCredentials): string {
  const h = crypto.createHash("sha256").update(creds.clientSecret).digest("hex").slice(0, 32);
  return `${creds.authUrl}|${creds.clientId}|${h}`;
}

export async function getStoryousAccessToken(creds: StoryousAppCredentials): Promise<string> {
  const now = Date.now();
  const skewMs = 60_000;
  const key = cacheKey(creds);
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAtMs > now + skewMs) return hit.token;

  const res = await fetchWithRetry(creds.authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Storyous authorize ${res.status}: ${text.slice(0, 400)}`);
  }
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Storyous authorize: neplatné JSON.");
  }
  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const token = typeof rec?.access_token === "string" ? rec.access_token.trim() : "";
  if (!token) throw new Error("Storyous authorize: chybí access_token.");

  const expiresAtRaw = typeof rec?.expires_at === "string" ? Date.parse(rec.expires_at) : NaN;
  const expiresAtMs = Number.isFinite(expiresAtRaw) ? expiresAtRaw : now + 50 * 60 * 1000;
  tokenCache.set(key, { token, expiresAtMs });
  return token;
}
