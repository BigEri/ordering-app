import { randomUUID } from "node:crypto";

import type { XpayEnvironment } from "./env";
import { xpayApiBaseFor } from "./env";
import {
  extractXpayLinkId,
  extractXpayPayUrl,
  extractXpaySecurityToken,
  classifyXpayOperation,
  formatXpayHttpError,
  isXpayCurrencyUnsupported,
  xpayLinkExpirationIso,
} from "./parse";

export type XpayCredentials = {
  apiKey: string;
  environment: XpayEnvironment;
};

export type CreatePayByLinkInput = {
  orderId: string;
  amountHalere: number;
  currency?: "CZK";
  description: string;
  language: "CES" | "ENG" | "KOR";
  resultUrl: string;
  cancelUrl: string;
  notificationUrl: string;
};

export type CreatePayByLinkResult =
  | {
      ok: true;
      payUrl: string;
      linkId: string | null;
      securityToken: string | null;
      raw: unknown;
    }
  | { ok: false; error: string; httpStatus?: number; raw?: unknown; currencyUnsupported?: boolean };

async function xpayFetch(
  creds: XpayCredentials,
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const url = `${xpayApiBaseFor(creds.environment)}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": creds.apiKey,
      "Correlation-Id": randomUUID(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  if (text.trim()) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function createXpayPayByLink(
  creds: XpayCredentials,
  input: CreatePayByLinkInput,
): Promise<CreatePayByLinkResult> {
  const amount = String(Math.round(input.amountHalere));
  const currency = input.currency ?? "CZK";
  const description = input.description.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim() || "Tableflow";
  const body = {
    order: {
      orderId: input.orderId,
      amount,
      currency,
      description,
    },
    paymentSession: {
      actionType: "PAY",
      amount,
      language: input.language,
      resultUrl: input.resultUrl,
      cancelUrl: input.cancelUrl,
      notificationUrl: input.notificationUrl,
    },
    expirationDate: xpayLinkExpirationIso(),
  };

  const posted = await xpayFetch(creds, "/orders/paybylink", { method: "POST", body });
  if (!posted.ok) {
    return {
      ok: false,
      httpStatus: posted.status,
      error: formatXpayHttpError(posted.status, posted.text, posted.json),
      raw: posted.json,
      currencyUnsupported: isXpayCurrencyUnsupported(posted.json, posted.text),
    };
  }

  const payUrl = extractXpayPayUrl(posted.json);
  if (!payUrl) {
    return { ok: false, error: "XPay nevrátila platební odkaz.", raw: posted.json };
  }
  return {
    ok: true,
    payUrl,
    linkId: extractXpayLinkId(posted.json),
    securityToken: extractXpaySecurityToken(posted.json),
    raw: posted.json,
  };
}

export async function fetchXpayOrderStatus(
  creds: XpayCredentials,
  orderId: string,
): Promise<{ ok: true; classification: "paid" | "failed" | "pending"; raw: unknown } | { ok: false; error: string }> {
  const posted = await xpayFetch(creds, `/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
  if (!posted.ok) {
    return { ok: false, error: `XPay order ${posted.status}: ${posted.text.trim().slice(0, 300)}` };
  }
  return { ok: true, classification: classifyXpayOperation(posted.json), raw: posted.json };
}

export async function cancelXpayPayByLink(
  creds: XpayCredentials,
  linkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const posted = await xpayFetch(creds, `/paybylink/${encodeURIComponent(linkId)}/cancels`, { method: "POST", body: {} });
  if (!posted.ok) {
    return { ok: false, error: `XPay cancel ${posted.status}: ${posted.text.trim().slice(0, 300)}` };
  }
  return { ok: true };
}
