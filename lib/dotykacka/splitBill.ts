export type XpaySplitItem = {
  orderId: number;
  itemId: number;
  qty: number;
};

export type BillLineForSplit = {
  name: string;
  qty: number;
  unitPriceCzk: number;
  itemId?: number;
  orderId?: number;
};

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || Math.round(n) !== n) return null;
  return n;
}

export function parseXpaySplitItems(raw: unknown): XpaySplitItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: XpaySplitItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const o = row as Record<string, unknown>;
    const orderId = asPositiveInt(o.orderId);
    const itemId = asPositiveInt(o.itemId);
    const qty = asPositiveInt(o.qty);
    if (orderId == null || itemId == null || qty == null) return null;
    out.push({ orderId, itemId, qty });
  }
  return out;
}

export function groupSplitItemsByOrder(items: XpaySplitItem[]): Map<number, Array<{ id: number; qty: number }>> {
  const map = new Map<number, Array<{ id: number; qty: number }>>();
  for (const it of items) {
    const list = map.get(it.orderId) ?? [];
    list.push({ id: it.itemId, qty: it.qty });
    map.set(it.orderId, list);
  }
  return map;
}

export function resolveSplitAgainstBill(
  lines: BillLineForSplit[],
  split: XpaySplitItem[],
): { ok: true; items: XpaySplitItem[]; totalCzk: number; coversFullBill: boolean } | { ok: false; error: string } {
  const live = new Map<string, BillLineForSplit>();
  for (const line of lines) {
    if (line.itemId == null || line.orderId == null) continue;
    live.set(`${line.orderId}:${line.itemId}`, line);
  }
  if (live.size === 0) {
    return { ok: false, error: "Účet v pokladně nemá položky s ID — rozdělení teď nejde, zvolte celý účet." };
  }

  const merged = new Map<string, XpaySplitItem>();
  for (const row of split) {
    const key = `${row.orderId}:${row.itemId}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...row, qty: prev.qty + row.qty } : row);
  }

  let totalCzk = 0;
  const items: XpaySplitItem[] = [];
  for (const row of merged.values()) {
    const line = live.get(`${row.orderId}:${row.itemId}`);
    if (!line) {
      return { ok: false, error: "Vybrané položky už na účtu nejsou. Vyberte znovu." };
    }
    if (row.qty > line.qty) {
      return { ok: false, error: "Vybrané množství je větší než na účtu. Vyberte znovu." };
    }
    items.push(row);
    totalCzk += row.qty * line.unitPriceCzk;
  }
  totalCzk = Math.round(totalCzk);
  if (totalCzk < 1 || items.length === 0) {
    return { ok: false, error: "Vyberte aspoň jednu položku k platbě." };
  }

  let coversFullBill = true;
  for (const line of live.values()) {
    const picked = merged.get(`${line.orderId}:${line.itemId}`);
    if (!picked || picked.qty < line.qty) {
      coversFullBill = false;
      break;
    }
  }
  return { ok: true, items, totalCzk, coversFullBill };
}
