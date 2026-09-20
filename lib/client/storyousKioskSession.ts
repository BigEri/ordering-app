const SESSION_SINCE_KEY = "kiosk.storyous.sessionSinceMs";
const PENDING_ORDERS_KEY = "kiosk.storyous.pendingOrderIds";
const LAST_PAID_BILL_KEY = "kiosk.storyous.lastPaidBillId";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function markStoryousSessionOrder(): void {
  if (typeof window === "undefined") return;
  if (!sessionStorage.getItem(SESSION_SINCE_KEY)) {
    sessionStorage.setItem(SESSION_SINCE_KEY, String(Date.now()));
  }
}

export function storyousSessionSinceMs(): number {
  const raw = typeof window === "undefined" ? "" : sessionStorage.getItem(SESSION_SINCE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function rememberStoryousOrderId(orderId: string): void {
  const id = orderId.trim();
  if (!id || typeof window === "undefined") return;
  const cur = readJson<string[]>(PENDING_ORDERS_KEY, []);
  if (cur.includes(id)) return;
  sessionStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify([...cur, id].slice(-12)));
}

export function listStoryousPendingOrderIds(): string[] {
  return readJson<string[]>(PENDING_ORDERS_KEY, []).filter((id) => typeof id === "string" && id.trim());
}

export function dropStoryousPendingOrderId(orderId: string): void {
  if (typeof window === "undefined") return;
  const next = listStoryousPendingOrderIds().filter((id) => id !== orderId);
  sessionStorage.setItem(PENDING_ORDERS_KEY, JSON.stringify(next));
}

export function storyousLastPaidBillId(): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem(LAST_PAID_BILL_KEY) ?? "").trim();
}

export function setStoryousLastPaidBillId(billId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LAST_PAID_BILL_KEY, billId.trim());
}

export function clearStoryousKioskSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_SINCE_KEY);
  sessionStorage.removeItem(PENDING_ORDERS_KEY);
}
