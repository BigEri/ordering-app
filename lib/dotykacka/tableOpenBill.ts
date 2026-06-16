import type { DotykackaConfig } from "./config";
import { unitPriceCzkFromPosOrderItem } from "./posItemPrice";
import { parseDotykackaPosActionCode } from "./syncOrderMerge";

export type TableBillLine = {
  name: string;
  qty: number;
  unitPriceCzk: number;
};

export type TableOpenBillSnapshot = {
  /** Otevřený účet u stolu v Dotyce (order/list vrací jen neuzavřené). */
  open: boolean;
  lines: TableBillLine[];
  totalCzk: number;
  orderIds: number[];
};

function isDotykackaOrderOpenOnTable(order: Record<string, unknown>): boolean {
  if (order.paid === true) return false;
  const canceled = order["canceled-date"];
  if (canceled != null && canceled !== "") return false;
  return true;
}

function orderIdFromPos(order: Record<string, unknown>): number | undefined {
  const id = order.id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    const n = Number.parseInt(id.trim(), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parsePosOrderItemLine(item: unknown): TableBillLine | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const qtyRaw = row.qty;
  const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw);
  if (!name || !Number.isFinite(qty) || qty <= 0) return null;
  const unitPriceCzk = unitPriceCzkFromPosOrderItem(row);
  if (unitPriceCzk === undefined) return null;
  return { name, qty, unitPriceCzk };
}

function orderTotalCzkFromPos(order: Record<string, unknown>): number | undefined {
  const raw = order["price-total"];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

/**
 * Parsuje odpověď `order/list` — agreguje všechny otevřené účty u stolu (stejný stav jako v Dotypos).
 */
export function parseTableOpenBillFromPosListData(data: unknown): TableOpenBillSnapshot {
  const empty: TableOpenBillSnapshot = { open: false, lines: [], totalCzk: 0, orderIds: [] };
  if (!data || typeof data !== "object" || Array.isArray(data)) return empty;

  const code = parseDotykackaPosActionCode(data);
  if (code !== undefined && code !== 0) return empty;

  const ordersRaw = (data as { orders?: unknown }).orders;
  if (!Array.isArray(ordersRaw)) return empty;

  const lines: TableBillLine[] = [];
  const orderIds: number[] = [];
  let totalFromOrders = 0;
  let hasOrderTotal = false;

  for (const row of ordersRaw) {
    if (!row || typeof row !== "object") continue;
    const wrap = row as { order?: unknown; items?: unknown };
    const ord = wrap.order;
    if (!ord || typeof ord !== "object") continue;
    const o = ord as Record<string, unknown>;
    if (!isDotykackaOrderOpenOnTable(o)) continue;

    const orderId = orderIdFromPos(o);
    if (orderId !== undefined) orderIds.push(orderId);

    const orderTotal = orderTotalCzkFromPos(o);
    if (orderTotal !== undefined) {
      totalFromOrders += orderTotal;
      hasOrderTotal = true;
    }

    const items = wrap.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const line = parsePosOrderItemLine(item);
      if (line) lines.push(line);
    }
  }

  const totalCzk = hasOrderTotal
    ? totalFromOrders
    : lines.reduce((sum, l) => sum + l.qty * l.unitPriceCzk, 0);

  return {
    open: orderIds.length > 0,
    lines,
    totalCzk,
    orderIds,
  };
}

export type FetchTableOpenBillResult =
  | { ok: true; configured: true; bill: TableOpenBillSnapshot }
  | { ok: true; configured: false; bill: TableOpenBillSnapshot }
  | { ok: false; error: string; httpStatus?: number };

/** Načte otevřený účet u stolu přes pos-actions `order/list`. */
export async function fetchTableOpenBillFromDotykacka(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId" | "branchId">,
  accessToken: string,
  tableId: number,
): Promise<FetchTableOpenBillResult> {
  const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/branches/${cfg.branchId}/pos-actions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ action: "order/list", "table-id": tableId }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      error: `Dotykačka order/list ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return { ok: false, error: "Dotykačka order/list: invalid JSON" };
  }

  const code = parseDotykackaPosActionCode(json);
  if (code !== undefined && code !== 0) {
    return { ok: false, error: `Dotykačka order/list: code ${code}` };
  }

  return {
    ok: true,
    configured: true,
    bill: parseTableOpenBillFromPosListData(json),
  };
}
