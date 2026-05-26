/**
 * Jednoduchý in-memory rate limit (per proces / instance).
 * Na serverless není globální — stále brání běžnému zneužití z jedné IP v rámci instance.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const k = key.trim();
  if (!k || max <= 0 || windowMs <= 0) return { ok: true };

  const now = Date.now();
  let b = buckets.get(k);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(k, b);
  }
  b.count += 1;
  if (b.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 120);
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 120);
  return "unknown";
}
