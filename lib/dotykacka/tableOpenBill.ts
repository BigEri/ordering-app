import type { DotykackaConfig } from "./config";
import { unitPriceCzkFromPosOrderItem } from "./posItemPrice";
import { parseDotykackaPosActionCode } from "./syncOrderMerge";
import { detailAfterTitle } from "../menu/billLineDisplay";

export type TableBillLine = {
  name: string;
  /** Přílohy / customizace (batáty, salátek…) — pod názvem jídla. */
  detail?: string;
  qty: number;
  unitPriceCzk: number;
  itemId?: number;
  orderId?: number;
};

export type TableOpenBillSnapshot = {
  /** Otevřený účet u stolu v Dotyce (order/list vrací jen neuzavřené). */
  open: boolean;
  lines: TableBillLine[];
  totalCzk: number;
  orderIds: number[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDotykackaOrderOpenOnTable(order: Record<string, unknown>): boolean {
  if (order.paid === true) return false;
  const canceled = order["canceled-date"] ?? order.canceledDate;
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

function positiveId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  return undefined;
}

function posItemId(item: Record<string, unknown>): number | undefined {
  return positiveId(item.id ?? item["item-id"] ?? item.itemId ?? item._orderItemId);
}

function relatedParentItemId(item: Record<string, unknown>): number | undefined {
  return positiveId(
    item._relatedOrderItemId ??
      item["related-order-item-id"] ??
      item.relatedOrderItemId ??
      item["parent-item-id"] ??
      item.parentItemId ??
      item["parent-id"],
  );
}

function itemQty(item: Record<string, unknown>): number | null {
  const qtyRaw = item.qty ?? item.quantity;
  const qty = typeof qtyRaw === "number" ? qtyRaw : Number(qtyRaw);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return qty;
}

function stringField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function isCanceledItem(row: Record<string, unknown>): boolean {
  const canceled = row["canceled-date"] ?? row.canceledDate;
  return canceled != null && canceled !== "";
}

function customizationNames(row: Record<string, unknown>): string[] {
  const buckets = [row.customizations, row.orderItemCustomizations, row["order-item-customizations"]];
  const names: string[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const c of bucket) {
      if (!isRecord(c) || isCanceledItem(c)) continue;
      const n = stringField(c, "name", "alternativeName", "alternative-name");
      if (n) names.push(n);
    }
  }
  return names;
}

type ParsedPosItem = {
  name: string;
  note: string;
  extras: string[];
  qty: number;
  unitPriceCzk: number;
  hasPrice: boolean;
  itemId?: number;
  orderId?: number;
  relatedParentId?: number;
};

function uniqueLabels(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function composeBillLineLabel(name: string, note: string, extras: string[]): { name: string; detail?: string } {
  const title = name.trim() || note.trim();
  const extraKeep = uniqueLabels(extras).filter((e) => {
    const hay = `${name} ${note}`.toLowerCase();
    return !hay.includes(e.toLowerCase());
  });
  const fromNote = note && note !== title ? detailAfterTitle(title, note) ?? (note === name ? undefined : note) : undefined;
  const detailParts = uniqueLabels([fromNote ?? "", ...extraKeep]);
  const detail = detailParts.join(" · ") || undefined;
  return detail ? { name: title || name, detail } : { name: title || name };
}

function parsePosItem(item: unknown, orderId: number | undefined): ParsedPosItem | null {
  if (!isRecord(item) || isCanceledItem(item)) return null;
  const name = stringField(item, "name", "alternativeName", "alternative-name");
  const qty = itemQty(item);
  if (!name || qty == null) return null;
  const priced = unitPriceCzkFromPosOrderItem(item);
  const relatedParentId = relatedParentItemId(item);
  if (priced === undefined && relatedParentId === undefined) return null;
  const itemId = posItemId(item);
  const extras = customizationNames(item);
  const subtitle = stringField(item, "subtitle");
  if (subtitle) extras.unshift(subtitle);
  return {
    name,
    note: stringField(item, "note"),
    extras,
    qty,
    unitPriceCzk: priced ?? 0,
    hasPrice: priced !== undefined,
    itemId,
    orderId,
    relatedParentId,
  };
}

function parsedToLine(row: ParsedPosItem, extraNames: string[], extraUnitPriceCzk: number): TableBillLine {
  const labeled = composeBillLineLabel(row.name, row.note, [...row.extras, ...extraNames]);
  const line: TableBillLine = {
    name: labeled.name,
    qty: row.qty,
    unitPriceCzk: Math.round(row.unitPriceCzk + extraUnitPriceCzk),
  };
  if (labeled.detail) line.detail = labeled.detail;
  if (row.orderId !== undefined) line.orderId = row.orderId;
  if (row.itemId !== undefined) line.itemId = row.itemId;
  return line;
}

function foldRelatedItems(parsed: ParsedPosItem[]): TableBillLine[] {
  const parentIds = new Set(parsed.filter((p) => !p.relatedParentId && p.itemId).map((p) => p.itemId as number));
  const childrenByParent = new Map<number, ParsedPosItem[]>();
  const standalone: ParsedPosItem[] = [];

  for (const row of parsed) {
    if (row.relatedParentId && parentIds.has(row.relatedParentId)) {
      const list = childrenByParent.get(row.relatedParentId) ?? [];
      list.push(row);
      childrenByParent.set(row.relatedParentId, list);
      continue;
    }
    standalone.push(row);
  }

  const lines: TableBillLine[] = [];
  for (const row of standalone) {
    if (!row.hasPrice && row.relatedParentId) {
      /* osiřelá příloha bez rodiče na účtu — ukázat aspoň název */
    } else if (!row.hasPrice) {
      continue;
    }
    const kids = row.itemId ? childrenByParent.get(row.itemId) ?? [] : [];
    const extraNames = kids.map((k) => k.name);
    const extraUnit =
      row.qty > 0
        ? kids.reduce((sum, k) => sum + k.unitPriceCzk * k.qty, 0) / row.qty
        : 0;
    lines.push(parsedToLine(row, extraNames, extraUnit));
  }
  return lines;
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
    const parsed: ParsedPosItem[] = [];
    for (const item of items) {
      const p = parsePosItem(item, orderId);
      if (p) parsed.push(p);
    }
    lines.push(...foldRelatedItems(parsed));
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
