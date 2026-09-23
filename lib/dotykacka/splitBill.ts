import { unitPriceCzkFromPosOrderItem } from "./posItemPrice";

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

/** Řádek Spropitné / Dýško nepatří do výběru jídla. Na účet ho přidá platba sama. */
export function isTipBillLine(name: string, detail?: string | null): boolean {
  const label = `${name} ${detail ?? ""}`.toLowerCase();
  return label.includes("spropitn") || label.includes("dýško") || label.includes("dysko") || label.includes("dýsko");
}

/** Spropitné tohoto hosta odchází s jeho položkami, nezůstane na účtu dalšímu. */
export function appendTipToSplitItems(
  items: Array<{ id: number; qty: number }>,
  tipItemId: number | null,
): Array<{ id: number; qty: number }> {
  if (tipItemId == null || tipItemId <= 0) return items;
  if (items.some((item) => item.id === tipItemId)) return items;
  return [...items, { id: tipItemId, qty: 1 }];
}

export type OpenTipOrderItem = {
  itemId: number;
  orderId: number;
  unitPriceCzk: number | null;
};

function asRawId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function itemText(item: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function itemTagList(item: Record<string, unknown>): string[] {
  const raw = item.tags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.toLowerCase());
}

function isRawTipItem(item: Record<string, unknown>): boolean {
  if (itemTagList(item).includes("oa-tip")) return true;
  return isTipBillLine(itemText(item, "name", "alternativeName", "alternative-name"), itemText(item, "note"));
}

/** Řádky Spropitné z odpovědi order/list, i když pokladna ještě nevrátí cenu. */
export function listOpenTipOrderItems(data: unknown): OpenTipOrderItem[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const root = data as Record<string, unknown>;
  if (root.code != null && root.code !== 0 && root.code !== "0") return [];
  const orders = root.orders;
  if (!Array.isArray(orders)) return [];
  const out: OpenTipOrderItem[] = [];
  for (const row of orders) {
    if (!row || typeof row !== "object") continue;
    const wrap = row as { order?: unknown; items?: unknown };
    const order = wrap.order;
    if (!order || typeof order !== "object") continue;
    const orderRec = order as Record<string, unknown>;
    if (orderRec.paid === true) continue;
    const orderId = asRawId(orderRec.id);
    if (orderId == null || !Array.isArray(wrap.items)) continue;
    for (const item of wrap.items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const canceled = rec["canceled-date"] ?? rec.canceledDate;
      if (canceled != null && canceled !== "") continue;
      if (!isRawTipItem(rec)) continue;
      const itemId = asRawId(rec.id ?? rec["item-id"] ?? rec.itemId ?? rec._orderItemId);
      if (itemId == null) continue;
      const price = unitPriceCzkFromPosOrderItem(rec);
      out.push({ itemId, orderId, unitPriceCzk: price ?? null });
    }
  }
  return out;
}

/**
 * Id řádku, který patří k tomuto spropitnému.
 * Nový řádek má přednost. Starší řádek se použije jen když sedí částka (opakovaný zápis).
 */
export function pickTipOrderItemId(
  before: OpenTipOrderItem[],
  after: OpenTipOrderItem[],
  orderId: number,
  tipAmount: number,
): number | null {
  const onOrder = (row: OpenTipOrderItem) => row.orderId === orderId;
  const beforeIds = new Set(before.filter(onOrder).map((row) => row.itemId));
  const fresh = after.filter((row) => onOrder(row) && !beforeIds.has(row.itemId));
  const priced = (rows: OpenTipOrderItem[]) =>
    rows.find((row) => row.unitPriceCzk != null && Math.round(row.unitPriceCzk) === tipAmount);
  const newest = (rows: OpenTipOrderItem[]) =>
    rows.reduce((best, row) => (row.itemId > best.itemId ? row : best));
  const pricedFresh = priced(fresh);
  if (pricedFresh) return pricedFresh.itemId;
  if (fresh.length > 0) return newest(fresh).itemId;
  const pricedExisting = priced(after.filter(onOrder));
  if (pricedExisting) return pricedExisting.itemId;
  const onThisOrder = after.filter(onOrder);
  if (onThisOrder.length === 1 && onThisOrder[0]?.unitPriceCzk == null) return onThisOrder[0].itemId;
  return null;
}

export type OpenTableOrder = {
  orderId: number;
  note: string;
  itemIds: number[];
};

/** Otevřené účty stolu z order/list, včetně poznámky a id položek. */
export function listOpenTableOrders(data: unknown): OpenTableOrder[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const root = data as Record<string, unknown>;
  if (root.code != null && root.code !== 0 && root.code !== "0") return [];
  const orders = root.orders;
  if (!Array.isArray(orders)) return [];
  const out: OpenTableOrder[] = [];
  for (const row of orders) {
    if (!row || typeof row !== "object") continue;
    const wrap = row as { order?: unknown; items?: unknown };
    const order = wrap.order;
    if (!order || typeof order !== "object") continue;
    const orderRec = order as Record<string, unknown>;
    if (orderRec.paid === true) continue;
    const orderId = asRawId(orderRec.id);
    if (orderId == null) continue;
    const note = typeof orderRec.note === "string" ? orderRec.note : "";
    const itemIds: number[] = [];
    if (Array.isArray(wrap.items)) {
      for (const item of wrap.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const rec = item as Record<string, unknown>;
        const canceled = rec["canceled-date"] ?? rec.canceledDate;
        if (canceled != null && canceled !== "") continue;
        const itemId = asRawId(rec.id ?? rec["item-id"] ?? rec.itemId ?? rec._orderItemId);
        if (itemId != null) itemIds.push(itemId);
      }
    }
    out.push({ orderId, note, itemIds });
  }
  return out;
}

/** Stejná poznámka při opakování platby, aby se spropitné nepřipsalo znovu na společný účet. */
export function guestSplitNote(sourceOrderId: number, itemIds: number[]): string {
  const ids = [...new Set(itemIds.filter((id) => id > 0))].sort((a, b) => a - b);
  return `tf-split-${sourceOrderId}-${ids.join("-")}`.slice(0, 160);
}

export function orderIdFromPosActionData(data: unknown): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const order = (data as { order?: unknown }).order;
  if (!order || typeof order !== "object" || Array.isArray(order)) return null;
  return asRawId((order as Record<string, unknown>).id);
}

/** Účet, na který se přesunulo jídlo platícího hosta. */
export function findGuestSplitOrder(
  orders: OpenTableOrder[],
  sourceOrderId: number,
  note: string,
  orderIdsBefore: number[],
): number | null {
  const marked = orders.find((order) => order.note === note && order.orderId !== sourceOrderId);
  if (marked) return marked.orderId;
  const before = new Set(orderIdsBefore);
  const created = orders.filter((order) => order.orderId !== sourceOrderId && !before.has(order.orderId));
  if (created.length === 1) return created[0]!.orderId;
  return null;
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
    if (isTipBillLine(line.name)) continue;
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
