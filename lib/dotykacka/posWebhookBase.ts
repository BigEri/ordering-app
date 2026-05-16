/**
 * Veřejná HTTPS adresa aplikace, na kterou Dotykačka zavolá po dokončení POS akce.
 * Bez toho používá API „výchozí webhook“ a často vrací HTTP 404 s {} do ~21 s, i když je branch správně.
 */

export function getDotykackaPosWebhookPublicBaseUrl(): string | null {
  if (process.env.DOTYKACKA_POS_WEBHOOK === "0") return null;
  const raw =
    process.env.DOTYKACKA_POS_WEBHOOK_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!raw) return null;
  const base = raw.replace(/\/$/, "");
  if (base.startsWith("http://localhost") || base.startsWith("http://127.0.0.1")) return null;
  if (!base.startsWith("https://")) return null;
  return base;
}

/** Jak dlouho čekáme na tělo z webhooku po prázdném HTTP 404 (ms). */
export function dotykackaPosWebhookMaxWaitMs(): number {
  const n = Number.parseInt(process.env.DOTYKACKA_POS_WEBHOOK_MAX_MS?.trim() ?? "", 10);
  if (Number.isFinite(n) && n >= 8000 && n <= 120_000) return n;
  return 45_000;
}
