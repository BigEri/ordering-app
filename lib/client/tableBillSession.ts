export type TableBillSessionScope = {
  deviceId: string;
  tableId: string;
};

export type TableBillSessionSnapshot = {
  lines: Array<{ name: string; qty: number; unitPriceCzk: number }>;
  totalCzk: number;
};

type TableBillSessionPayload = {
  v: 1;
  scope: TableBillSessionScope;
  bill: TableBillSessionSnapshot;
};

export const TABLE_BILL_SESSION_STORAGE_KEY = "ordering.tableBill.v1";

function scopesMatch(a: TableBillSessionScope, b: TableBillSessionScope): boolean {
  return a.deviceId === b.deviceId && a.tableId === b.tableId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLine(raw: unknown): TableBillSessionSnapshot["lines"][number] | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const qty = typeof raw.qty === "number" ? raw.qty : Number(raw.qty);
  const unitPriceCzk =
    typeof raw.unitPriceCzk === "number" ? raw.unitPriceCzk : Number(raw.unitPriceCzk);
  if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPriceCzk)) return null;
  return { name, qty, unitPriceCzk };
}

export function parseTableBillSessionPayload(raw: string): TableBillSessionPayload | null {
  try {
    const j = JSON.parse(raw) as unknown;
    if (!isRecord(j) || j.v !== 1 || !isRecord(j.scope) || !isRecord(j.bill)) return null;
    const deviceId = typeof j.scope.deviceId === "string" ? j.scope.deviceId.trim() : "";
    const tableId = typeof j.scope.tableId === "string" ? j.scope.tableId.trim() : "";
    if (!deviceId || !tableId) return null;

    const linesRaw = j.bill.lines;
    if (!Array.isArray(linesRaw)) return null;
    const lines: TableBillSessionSnapshot["lines"] = [];
    for (const row of linesRaw) {
      const line = parseLine(row);
      if (line) lines.push(line);
    }
    if (lines.length === 0) return null;

    const totalCzk =
      typeof j.bill.totalCzk === "number" ? j.bill.totalCzk : Number(j.bill.totalCzk);
    if (!Number.isFinite(totalCzk)) return null;

    return {
      v: 1,
      scope: { deviceId, tableId },
      bill: { lines, totalCzk },
    };
  } catch {
    return null;
  }
}

export function loadTableBillSession(scope: TableBillSessionScope): TableBillSessionSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TABLE_BILL_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseTableBillSessionPayload(raw);
    if (!parsed || !scopesMatch(parsed.scope, scope)) return null;
    return parsed.bill;
  } catch {
    return null;
  }
}

export function saveTableBillSession(scope: TableBillSessionScope, bill: TableBillSessionSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  if (bill.lines.length === 0) return;
  try {
    const payload: TableBillSessionPayload = { v: 1, scope, bill };
    sessionStorage.setItem(TABLE_BILL_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearTableBillSession(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(TABLE_BILL_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
