export type XpayEnvironment = "sandbox" | "production";

export const XPAY_SANDBOX_API_BASE = "https://xpaysandbox.nexigroup.com/api/phoenix-0.0/psp/api/v1";
export const XPAY_PRODUCTION_API_BASE = "https://xpay.nexigroup.com/api/phoenix-0.0/psp/api/v1";

/** Implicit accounting — oficiální testovací klíč z dokumentace Nexi XPay CEE. */
export const XPAY_SANDBOX_IMPLICIT_API_KEY = "bcf67740-9013-4dd9-bbfb-02debdf7206f";

export function parseXpayEnvironment(raw: string | null | undefined): XpayEnvironment {
  return raw?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function xpayApiBaseFor(environment: XpayEnvironment): string {
  const override = process.env.XPAY_API_BASE?.trim().replace(/\/$/, "");
  if (override) return override;
  return environment === "production" ? XPAY_PRODUCTION_API_BASE : XPAY_SANDBOX_API_BASE;
}

export function xpayEnvApiKey(): string | null {
  const key = process.env.XPAY_API_KEY?.trim();
  return key || null;
}

export function xpayEnvEnvironment(): XpayEnvironment {
  return parseXpayEnvironment(process.env.XPAY_ENVIRONMENT);
}
