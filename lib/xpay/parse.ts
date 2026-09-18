import { randomUUID } from "node:crypto";

const PAID_RESULTS = new Set([
  "AUTHORIZED",
  "EXECUTED",
  "CAPTURED",
  "PAID",
  "OK",
  "SUCCESS",
  "APPROVED",
]);

const FAILED_RESULTS = new Set(["DECLINED", "DENIED", "FAILED", "KO", "ERROR", "CANCELED", "CANCELLED", "VOIDED"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function collectStrings(root: unknown, keys: string[], out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out;
  const rec = asRecord(root);
  if (!rec) return out;
  for (const [k, v] of Object.entries(rec)) {
    if (keys.includes(k)) {
      const s = readString(v);
      if (s) out.push(s);
    }
    if (v && typeof v === "object") collectStrings(v, keys, out, depth + 1);
  }
  return out;
}

export function extractXpayOrderId(payload: unknown): string | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const direct =
    readString(rec.orderId) ||
    readString(rec.merchantOrderId) ||
    readString(rec.order_id);
  if (direct) return direct;
  const order = asRecord(rec.order);
  const nested = order ? readString(order.orderId) || readString(order.id) : null;
  if (nested) return nested;
  const found = collectStrings(payload, ["orderId", "merchantOrderId"]);
  return found[0] ?? null;
}

export function extractXpayLinkId(payload: unknown): string | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const link = asRecord(rec.paymentLink);
  const links = Array.isArray(rec.paymentLinks) ? rec.paymentLinks : [];
  const firstLink = links.length > 0 ? asRecord(links[0]) : null;
  return (
    readString(rec.linkId) ||
    (link ? readString(link.linkId) : null) ||
    (firstLink ? readString(firstLink.linkId) : null) ||
    collectStrings(payload, ["linkId"])[0] ||
    null
  );
}

export function extractXpayPayUrl(payload: unknown): string | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const link = asRecord(rec.paymentLink);
  const links = Array.isArray(rec.paymentLinks) ? rec.paymentLinks : [];
  const firstLink = links.length > 0 ? asRecord(links[0]) : null;
  return (
    (link ? readString(link.link) : null) ||
    (firstLink ? readString(firstLink.link) : null) ||
    readString(rec.link) ||
    readString(rec.hostedPage) ||
    readString(rec.payByLink) ||
    null
  );
}

export function isXpayCurrencyUnsupported(json: unknown, errorText?: string): boolean {
  const rec = asRecord(json);
  const errors = rec && Array.isArray(rec.errors) ? rec.errors : null;
  const first = errors && errors.length > 0 ? asRecord(errors[0]) : null;
  const desc = first ? readString(first.description) : null;
  const blob = `${desc ?? ""} ${errorText ?? ""}`;
  return /currency from request is not supported/i.test(blob);
}

export function formatXpayHttpError(status: number, text: string, json: unknown): string {
  const rec = asRecord(json);
  const errors = rec && Array.isArray(rec.errors) ? rec.errors : null;
  const first = errors && errors.length > 0 ? asRecord(errors[0]) : null;
  const desc = first ? readString(first.description) : null;
  if (desc && /currency from request is not supported/i.test(desc)) {
    return "Tento XPay účet nepřijímá CZK. Veřejný sandbox klíč z Nexi dokumentace je jen pro EUR — na CZK potřebujete klíč z Dotypay back office.";
  }
  if (desc) return `XPay ${status}: ${desc.slice(0, 400)}`;
  const snippet = text.trim().slice(0, 400);
  return `XPay pay-by-link ${status}: ${snippet || "(prázdná odpověď)"}`;
}

/** Pay-by-Link expirace (Nexi vyžaduje expirationDate, max 90 dní). */
export function xpayLinkExpirationIso(fromMs = Date.now(), hours = 2): string {
  return new Date(fromMs + hours * 60 * 60 * 1000).toISOString();
}

export function extractXpaySecurityToken(payload: unknown): string | null {
  const rec = asRecord(payload);
  return rec ? readString(rec.securityToken) : null;
}

export function classifyXpayOperation(payload: unknown): "paid" | "failed" | "pending" {
  const values = collectStrings(payload, [
    "operationResult",
    "operationStatus",
    "orderStatus",
    "orderState",
    "status",
    "state",
    "result",
  ]).map((s) => s.toUpperCase());
  if (values.some((v) => PAID_RESULTS.has(v))) return "paid";
  if (values.some((v) => FAILED_RESULTS.has(v))) return "failed";
  return "pending";
}

export function czkToHalere(czk: number): number {
  return Math.round(czk * 100);
}

export function halereToCzk(halere: number): number {
  return Math.round(halere) / 100;
}

/** XPay orderId max 27 znaků, jen alfanumerika a pár symbolů. */
export function buildXpayOrderId(): string {
  const hex = randomUUID().replace(/-/g, "");
  return `tf${hex.slice(0, 22)}`;
}

export function xpayLanguageFromLocale(locale: string | null | undefined): "CES" | "ENG" | "KOR" {
  const v = (locale ?? "cs").trim().toLowerCase();
  if (v === "en") return "ENG";
  if (v === "ko") return "KOR";
  return "CES";
}
