/**
 * Veřejná URL aplikace (webhooky, visit URL z telefonu hosta).
 */
export function getPublicAppBaseUrl(opts?: { allowLocalhost?: boolean }): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.DOTYKACKA_POS_WEBHOOK_PUBLIC_BASE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!raw) return null;
  const base = raw.replace(/\/$/, "");
  const allowLocal = opts?.allowLocalhost === true;
  if (!allowLocal && (base.startsWith("http://localhost") || base.startsWith("http://127.0.0.1"))) {
    return null;
  }
  if (!base.startsWith("http://") && !base.startsWith("https://")) return null;
  return base;
}
