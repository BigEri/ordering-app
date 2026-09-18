import { randomUUID } from "node:crypto";

export function isXpaySandboxDemoPayUrl(payUrl: string): boolean {
  try {
    const u = new URL(payUrl);
    return u.pathname === "/pay/xpay/demo" || u.pathname.startsWith("/pay/xpay/demo/");
  } catch {
    return payUrl.includes("/pay/xpay/demo");
  }
}

export function buildXpaySandboxCzkDemo(input: { appBase: string; paymentId: string }): {
  payUrl: string;
  securityToken: string;
  linkId: null;
} {
  const securityToken = randomUUID();
  const base = input.appBase.replace(/\/$/, "");
  const payUrl = `${base}/pay/xpay/demo?pid=${encodeURIComponent(input.paymentId)}&t=${encodeURIComponent(securityToken)}`;
  return { payUrl, securityToken, linkId: null };
}
