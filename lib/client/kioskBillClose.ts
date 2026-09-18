const KEY = "tableflow.billClose";

export function markKioskBillPaidByXpay(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ reason: "xpay", at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function peekKioskBillPaidByXpay(maxAgeMs = 120_000): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { reason?: string; at?: number };
    if (o.reason !== "xpay") return false;
    const at = typeof o.at === "number" ? o.at : 0;
    return Date.now() - at < maxAgeMs;
  } catch {
    return false;
  }
}

export function clearKioskBillPaidByXpay(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
