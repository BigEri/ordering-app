/** Veřejný Nexi sandbox terminál je jen EUR. */
export const XPAY_SANDBOX_CZK_PER_EUR = 25;

/**
 * Částka z pokladny (price-total) na EUR centy pro Nexi sandbox.
 * Běžný CZK účet (>= 50) se přepočte ~25 Kč = 1 €, ať na bráně vypadá jako jídlo.
 * Malé částky (< 50) bereme 1:1 — typicky už eurové ceny na testovacím cloudu.
 */
export function tillMajorToSandboxEurCents(tillMajor: number): number {
  const major = Math.max(0, tillMajor);
  const cents =
    major >= 50 ? Math.round((major / XPAY_SANDBOX_CZK_PER_EUR) * 100) : Math.round(major * 100);
  return Math.max(100, cents);
}

export function formatSandboxEurFromTillMajor(tillMajor: number): string {
  const eur = tillMajorToSandboxEurCents(tillMajor) / 100;
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "EUR" }).format(eur);
}

export function isNexiSandboxPayUrl(payUrl: string): boolean {
  try {
    return new URL(payUrl).hostname.toLowerCase().includes("xpaysandbox.nexigroup.com");
  } catch {
    return /xpaysandbox\.nexigroup\.com/i.test(payUrl);
  }
}
