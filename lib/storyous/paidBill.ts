function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type StoryousPaidBill = {
  billId: string;
  deskId: string;
  totalCzk: number;
  paidAtMs: number;
};

function billRows(json: unknown): Record<string, unknown>[] {
  const rec = asRecord(json);
  const data = rec?.data ?? rec?.bills;
  if (Array.isArray(json)) {
    return json.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x));
  }
  if (Array.isArray(data)) {
    return data.map(asRecord).filter((x): x is Record<string, unknown> => Boolean(x));
  }
  return [];
}

function isPaidStatus(raw: unknown): boolean {
  const s = str(raw).toLowerCase();
  if (!s) return true;
  if (s === "deleted" || s === "refunded" || s === "cancelled" || s === "canceled") return false;
  return s === "paid" || s === "closed" || s === "fiscalized";
}

function paidAtMs(row: Record<string, unknown>): number {
  for (const key of ["paidAt", "createdAt", "fiscalizedAt", "_lastModifiedAt", "sessionCreated", "sessionCreatedAt"]) {
    const n = Date.parse(str(row[key]));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function totalCzk(row: Record<string, unknown>): number {
  const fromString = str(row.finalPrice) || str(row.totalPrice);
  if (fromString.includes(".")) {
    const n = Number(fromString.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  const n = num(row.totalAmount) ?? num(row.finalPrice) ?? num(row.totalPrice) ?? 0;
  return n;
}

export function parseStoryousPaidBills(json: unknown): StoryousPaidBill[] {
  const out: StoryousPaidBill[] = [];
  for (const row of billRows(json)) {
    if (row.deleted === true || row.refunded === true) continue;
    if (!isPaidStatus(row.status ?? row.paymentStatus)) continue;
    const deskId = str(row.deskId);
    if (!deskId) continue;
    const billId = str(row.billId) || str(row.id) || str(row.billNumber);
    if (!billId) continue;
    out.push({
      billId,
      deskId,
      totalCzk: totalCzk(row),
      paidAtMs: paidAtMs(row),
    });
  }
  out.sort((a, b) => b.paidAtMs - a.paidAtMs);
  return out;
}

export function latestPaidBillForDesk(
  bills: StoryousPaidBill[],
  deskId: string,
  sinceMs: number,
): StoryousPaidBill | null {
  const id = deskId.trim();
  if (!id) return null;
  return bills.find((b) => b.deskId === id && b.paidAtMs >= sinceMs) ?? null;
}
