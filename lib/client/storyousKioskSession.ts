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

/** Id souhrnu „účet z pokladny“ v Objednávkách — nikdy to není jedno kolo z tabletu. */
export const TILL_BILL_ORDER_ID = "dotykacka-table-bill";

/** Odmítnutá Storyous objednávka — pryč z tabletu, dřívější přijaté kola nechat. */
export function dropDeclinedStoryousOrders<T extends { id?: string; storyousOrderId?: string }>(
  orders: T[],
  declinedOrderId: string,
): T[] {
  const id = declinedOrderId.trim();
  if (!id || orders.length === 0) return orders;
  if (orders.some((o) => o.storyousOrderId === id)) {
    return orders.filter((o) => o.storyousOrderId !== id);
  }
  const untracked = orders.findIndex((o) => !o.storyousOrderId && o.id !== TILL_BILL_ORDER_ID);
  if (untracked < 0) return orders;
  return orders.filter((_, i) => i !== untracked);
}

/** Rezerva na rozdíl hodin tabletu a pokladny. */
const PAID_CLOCK_SKEW_MS = 60_000;

/**
 * Patří zaplacený účet ze Storyous k této relaci tabletu?
 * Kotva = začátek relace (první objednávka) nebo první chvíle, kdy tablet viděl otevřený účet.
 */
export function isStoryousPaidBillForSession(
  paid: { billId: string; paidAtMs: number } | null | undefined,
  input: { sessionSinceMs: number; firstOpenSeenAtMs: number; lastPaidBillId: string },
): boolean {
  if (!paid || !paid.billId.trim()) return false;
  if (paid.billId === input.lastPaidBillId) return false;
  const anchors = [input.sessionSinceMs, input.firstOpenSeenAtMs].filter((n) => Number.isFinite(n) && n > 0);
  if (anchors.length === 0) return false;
  return paid.paidAtMs >= Math.min(...anchors) - PAID_CLOCK_SKEW_MS;
}
