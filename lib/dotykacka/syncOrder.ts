import { randomUUID } from "node:crypto";

import type { DotykackaConfig } from "./config";
import { getDotykackaAccessTokenForCloud } from "./accessToken";
import { dotykackaPosWebhookMaxWaitMs, getDotykackaPosWebhookPublicBaseUrl } from "./posWebhookBase";
import {
  parseDotykackaPosActionCode,
  parseDotykackaPosActionCodeFromText,
  pickTargetOpenOrdersForMerge,
  posActionConfirmed,
  shouldCreateOrderWhenListUnreadable,
  shouldRelistOrdersAfterCreateFailure,
  shouldTryNextOpenOrder,
} from "./syncOrderMerge";
import { cancelPosActionWebhook, waitForPosActionWebhook } from "../server/posActionWebhookRegistry";
import { formatRestaurantLocalHhmm } from "../restaurantLocalTime";
import {
  DOTYKACKA_BILL_REQUEST_PRINT_TAG,
  DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY,
  buildBillRequestItemNote,
  resolveBillRequestProductId,
} from "./billRequestProduct";
import { appendTipToSplitItems, groupSplitItemsByOrder, isTipBillLine, type XpaySplitItem } from "./splitBill";
import { parseTableOpenBillFromPosListData } from "./tableOpenBill";
import {
  findRecentPaidOrderId,
  orderIdFromPosPayData,
  posOrderTipBody,
  posPayWithTip,
  primeDotykackaOrderTip,
  resolveDotykackaTipProductId,
  tipLineItem,
  writeDotykackaPaidTip,
} from "./recordPaidTip";
import {
  DOTYKACKA_STAFF_CALL_PRINT_TAG,
  DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY,
  buildStaffCallItemNote,
  resolveStaffCallProductId,
} from "./staffCallProduct";

export type DotykackaSyncMeta = {
  action?: string;
  httpStatus?: number;
  /** Kód z těla odpovědi pos-actions (0 = OK) */
  posActionCode?: number;
  /** external-id relace u stolu (naše idempotence / merge key) */
  sessionExternalId?: string;
  /** table id v Dotyce */
  tableId?: number;
  /** Počet otevřených účtů na stole při posledním order/list (diagnostika merge). */
  openOrderCount?: number;
};

export type DotykackaSyncResult =
  | { ok: true; meta: DotykackaSyncMeta }
  | { ok: false; error: string; meta: DotykackaSyncMeta };

/** Jednoznačné id relace „účet u stolu“ v Dotyce (stejné pro všechny objednávky z jednoho zařízení ke stejnému stolu). */
export function buildDotykackaTableSessionExternalId(
  cfg: DotykackaConfig,
  payload: Record<string, unknown>,
): string {
  const tid =
    typeof payload.tableId === "string"
      ? payload.tableId.trim()
      : payload.tableId != null
        ? String(payload.tableId).trim()
        : "";
  const did = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "";
  if (did && tid) {
    return `ordering-app-${cfg.cloudId}-${cfg.branchId}-${did}-${tid}`;
  }
  if (tid) {
    return `ordering-app-${cfg.cloudId}-${cfg.branchId}-table-${tid}`;
  }
  return `ordering-app-${cfg.cloudId}-${cfg.branchId}-fallback`;
}

function posActionsUrl(cfg: DotykackaConfig): string {
  return `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/branches/${cfg.branchId}/pos-actions`;
}

/**
 * Dotypos často vrací HTTP 404 u `pos-actions`, když cílové zařízení pobočky neodpovědělo v limitu
 * (viz dokumentace k pos-actions / výchozí webhook), ne jen při špatné URL.
 */
function formatPosActionsHttpError(cfg: DotykackaConfig, status: number, text: string): string {
  const snippet = text.trim().slice(0, 400);
  const code = parseDotykackaPosActionCodeFromText(text);
  if (code === 2001) {
    return (
      "Dotykačka dočasně zamkla účet u stolu (právě ho někdo otevřel na pokladně). " +
      "Počkejte chvíli a zkuste objednávku znovu — aplikace ji přidá k otevřenému účtu. " +
      "Personál může účet v Dotypos zaparkovat (uložit), pak to obvykle projde hned."
    );
  }
  if (status === 404) {
    const webhookHint = getDotykackaPosWebhookPublicBaseUrl()
      ? ""
      : " Pro spolehlivější odpověď nastavte veřejné HTTPS v NEXT_PUBLIC_APP_URL (nebo DOTYKACKA_POS_WEBHOOK_PUBLIC_BASE_URL) — aplikace pak pošle vlastní webhook do pos-actions.";
    return (
      "Dotykačka vrátila HTTP 404 u pos-actions — nejčastěji pokladna na pobočce neběží, neodpověděla v limitu, nebo API použilo výchozí webhook bez odpovědi (prázdné {}). " +
      `Zkontrolujte zapnutý Dotypos pro cloud ${cfg.cloudId}, pobočku ${cfg.branchId}.` +
      webhookHint +
      " " +
      (snippet ? `Technický detail: ${snippet}` : "Technický detail: (prázdná odpověď)")
    );
  }
  return `Dotykačka pos-actions ${status}: ${snippet || "(prázdná odpověď)"}`;
}

/** Rychlá kontrola, že pobočka přijímá pos-actions (Dotypos 1.239.8+). */
async function preflightDotykackaPosActions(
  cfg: DotykackaConfig,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const posted = await postDotykackaPosAction(cfg, accessToken, { action: "order/hello" });
  if (!posted.ok) {
    return { ok: false, error: formatPosActionsHttpError(cfg, posted.status, posted.text) };
  }
  const data = posted.data;
  if (data && typeof data === "object") {
    const code = (data as { code?: unknown }).code;
    if (typeof code === "number") {
      // 1004 = UNKNOWN_ACTION — starší Dotypos bez `order/hello`; pokračujeme bez preflightu.
      if (code === 1004) return { ok: true };
      if (code !== 0) {
        return { ok: false, error: `Dotykačka order/hello selhal (code ${code})` };
      }
    }
  }
  return { ok: true };
}

function parsePosActionJsonBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isEmptyDotykackaPosActionSyncBody(text: string): boolean {
  const t = text.trim();
  return t === "" || t === "{}";
}

/** @deprecated use isEmptyDotykackaPosActionSyncBody */
function isEmptyDotykacka404Body(text: string): boolean {
  return isEmptyDotykackaPosActionSyncBody(text);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function shouldRetryDotykackaPosActions(body: Record<string, unknown>, status: number, text: string): boolean {
  if (status !== 400 && status !== 403) return false;
  const code = parseDotykackaPosActionCodeFromText(text);
  if (code === 2001) return true;
  if (status !== 400) return false;
  const t = text.toLowerCase();
  // Dotypos občas vrací 400 "message parsing error" při paralelních požadavcích – retry po krátké pauze často projde.
  if (!t.includes("message parsing error")) return false;
  const action = typeof body.action === "string" ? body.action : "";
  // Jen akce, které jsou pro nás bezpečné opakovat (idempotentní nebo cílené na konkrétní order).
  return [
    "order/list",
    "order/update",
    "order/issue",
    "order/add-item",
    "order/create",
    "order/hello",
    "order/pay",
    "order/issue-and-pay",
    "order/split",
    "order/split-issue-pay",
  ].includes(action);
}

/**
 * POST na pos-actions. Volitelně přidá `webhook` na naši veřejnou URL, aby Dotykačka nečekala
 * na výchozí webhook (často končí HTTP 404 a prázdným tělem i při správné pobočce).
 */
async function postDotykackaPosAction(
  cfg: DotykackaConfig,
  accessToken: string,
  body: Record<string, unknown>,
  webhookWaitMs?: number,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> {
  const webhookBase = getDotykackaPosWebhookPublicBaseUrl();
  const waitMs = webhookWaitMs ?? dotykackaPosWebhookMaxWaitMs();

  const attemptOnce = async (): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> => {
    let callbackId: string | null = null;
    let waitWebhook: Promise<string | null> | null = null;
    const outgoing: Record<string, unknown> = { ...body };
    if (webhookBase) {
      callbackId = randomUUID();
      waitWebhook = waitForPosActionWebhook(callbackId, waitMs);
      outgoing.webhook = `${webhookBase}/api/integrations/dotykacka/pos-webhook?cb=${encodeURIComponent(callbackId)}`;
    }

    try {
      const res = await fetch(posActionsUrl(cfg), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(outgoing),
      });
      const text = await res.text();
      if (res.ok) {
        // Dotypos často vrátí HTTP 200 s prázdným tělem a skutečnou odpověď pošle na webhook.
        if (waitWebhook && isEmptyDotykackaPosActionSyncBody(text)) {
          const whText = await waitWebhook;
          if (whText != null && whText.trim() !== "") {
            return { ok: true, data: parsePosActionJsonBody(whText) };
          }
        } else if (callbackId) {
          cancelPosActionWebhook(callbackId);
        }
        return { ok: true, data: parsePosActionJsonBody(text) };
      }

      if (waitWebhook && res.status === 404 && isEmptyDotykacka404Body(text)) {
        const whText = await waitWebhook;
        if (whText != null && whText.trim() !== "") {
          return { ok: true, data: parsePosActionJsonBody(whText) };
        }
      } else if (callbackId) {
        cancelPosActionWebhook(callbackId);
      }

      return { ok: false, status: res.status, text };
    } catch (e) {
      if (callbackId) cancelPosActionWebhook(callbackId);
      throw e;
    }
  };

  // Retry/backoff: parsing error nebo ORDER_LOCKED (2001) — pokladna krátce drží účet otevřený.
  const backoffMs = [700, 1400, 2800, 4500, 6500];
  let last = await attemptOnce();
  for (const d of backoffMs) {
    if (last.ok) return last;
    if (!shouldRetryDotykackaPosActions(body, last.status, last.text)) return last;
    await sleep(d);
    last = await attemptOnce();
  }
  return last;
}

function orderExternalIdFromPos(order: Record<string, unknown>): string | undefined {
  const v = order["external-id"] ?? order.externalId;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function isDotykackaOrderOpenForMerge(order: Record<string, unknown>): boolean {
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

type ListedOrder = { orderId: number; externalId?: string; note?: unknown };

function parseOpenOrdersFromPosListData(data: unknown): ListedOrder[] | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  if (typeof code === "number" && code !== 0) return null;

  const orders = (data as { orders?: unknown }).orders;
  if (!Array.isArray(orders)) return null;

  const out: ListedOrder[] = [];
  for (const row of orders) {
    if (!row || typeof row !== "object") continue;
    const wrap = row as { order?: unknown };
    const ord = wrap.order;
    if (!ord || typeof ord !== "object") continue;
    const o = ord as Record<string, unknown>;
    if (!isDotykackaOrderOpenForMerge(o)) continue;
    const id = orderIdFromPos(o);
    if (id === undefined) continue;
    out.push({ orderId: id, externalId: orderExternalIdFromPos(o), note: o.note });
  }
  return out;
}

type ListOpenOrdersResult =
  | { ok: true; orders: ListedOrder[] }
  | { ok: false; reason: "http" | "code" | "shape"; message: string; httpStatus?: number };

function buildBillRequestNoOpenAccountError(
  payload: Record<string, unknown>,
  tableId: number,
  listFailure: ListOpenOrdersResult & { ok: false } | null,
): string {
  const tableLabel =
    typeof payload.tableLabel === "string" && payload.tableLabel.trim() ? payload.tableLabel.trim() : null;
  const deviceId = typeof payload.deviceId === "string" && payload.deviceId.trim() ? payload.deviceId.trim() : null;

  const lines = [
    "Dotykačka nepotvrdila otevřený účet u stolu z tohoto tabletu.",
    "",
    "Co tablet poslal:",
    `• Název stolu: ${tableLabel ? `„${tableLabel}"` : "—"}`,
    `• ID stolu v Dotyce (číslo pro API): ${tableId}`,
  ];
  if (deviceId) {
    lines.push(`• ID tabletu (Admin → Zařízení, první sloupec): ${deviceId}`);
  }
  lines.push(
    "",
    "Co udělat:",
    "1. V Dotypos u otevřeného účtu ověřte ID stolu (v nastavení stolů) — musí sedět s číslem výše, ne jen podobný název.",
    "2. V administraci → Zařízení najděte tablet podle ID a u stolu musí být „z Dotykačky“. Jinak: Upravit stůl → vyberte stůl ze seznamu Dotykačky.",
    "3. Na pobočce musí běžet Dotypos; na serveru nastavte veřejnou HTTPS adresu (NEXT_PUBLIC_APP_URL).",
    "4. Po objednávce z menu musí být stejné položky vidět v Dotyce na tomto stole.",
  );

  if (listFailure) {
    lines.push("", "Technický důvod:", listFailure.message);
  } else {
    lines.push(
      "",
      "Dotykačka na tento stůl vrátila prázdný seznam účtů — účet v pokladně může být na jiném ID stolu než má tablet v párování.",
    );
  }

  return lines.join("\n");
}

/**
 * Najde otevřenou objednávku na stole se stejným external-id (Dotypos 1.235+ `order/list`).
 * @deprecated Prefer `listOpenDotykackaOrdersForTable` + `pickTargetOpenOrdersForMerge`.
 */
async function findOpenDotykackaOrderIdForSession(
  cfg: DotykackaConfig,
  accessToken: string,
  tableId: number,
  sessionExternalId: string,
): Promise<{ orderId: number; note?: unknown } | undefined> {
  const posted = await postDotykackaPosAction(cfg, accessToken, {
    action: "order/list",
    "table-id": tableId,
  });
  if (!posted.ok) return undefined;
  const data = posted.data;
  if (!data || typeof data !== "object") return undefined;
  const code = (data as { code?: unknown }).code;
  if (typeof code === "number" && code !== 0) return undefined;

  const parsed = parseOpenOrdersFromPosListData(data);
  if (!parsed) return undefined;

  for (const row of parsed) {
    if (row.externalId === sessionExternalId) {
      return { orderId: row.orderId, note: row.note };
    }
  }
  return undefined;
}

async function listOpenDotykackaOrdersForTable(
  cfg: DotykackaConfig,
  accessToken: string,
  tableId: number | null,
): Promise<ListOpenOrdersResult> {
  const posted = await postDotykackaPosAction(
    cfg,
    accessToken,
    {
      action: "order/list",
      "table-id": tableId,
    },
    12_000,
  );
  if (!posted.ok) {
    return {
      ok: false,
      reason: "http",
      httpStatus: posted.status,
      message: formatPosActionsHttpError(cfg, posted.status, posted.text),
    };
  }
  const data = posted.data;
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      reason: "shape",
      message: "Dotykačka order/list: prázdná nebo neplatná odpověď.",
    };
  }
  const code = (data as { code?: unknown }).code;
  if (typeof code === "number" && code !== 0) {
    return {
      ok: false,
      reason: "code",
      message: `Dotykačka order/list selhal (code ${code}).`,
    };
  }

  const parsed = parseOpenOrdersFromPosListData(data);
  if (!parsed) {
    return {
      ok: false,
      reason: "shape",
      message: "Dotykačka order/list: v odpovědi chybí seznam účtů (orders).",
    };
  }
  return { ok: true, orders: parsed };
}

/**
 * Zápis "žádost o účet" do Dotykačky.
 * Položka 0 Kč na otevřený účet stolu hosta (viditelné v pokladně). Štítek `oa-volani` může tisknout bon.
 */
export async function syncBillRequestToDotykacka(payload: unknown, cfg: DotykackaConfig): Promise<DotykackaSyncResult> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Neplatné tělo žádosti o účet", meta: {} };
  }
  const o = payload as Record<string, unknown>;

  const tableRaw = o.tableId;
  const tableId =
    typeof tableRaw === "string"
      ? Number.parseInt(tableRaw, 10)
      : typeof tableRaw === "number"
        ? tableRaw
        : NaN;
  if (!Number.isFinite(tableId)) {
    return { ok: false, error: "Chybí nebo neplatné tableId (očekává se ID stolu v Dotyce)", meta: {} };
  }

  const productId = resolveBillRequestProductId(cfg.productMap);
  if (productId === undefined) {
    return {
      ok: false,
      error:
        `Chybí produkt pro žádost o účet — v mapě produktů nastavte klíč "${DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY}" ` +
        `(nebo DOTYKACKA_BILL_REQUEST_PRODUCT_ID v .env) na ID skryté 0 Kč položky v Dotykačce.`,
      meta: { tableId, action: "bill_request_missing_product" },
    };
  }

  const sessionExternalId = buildDotykackaTableSessionExternalId(cfg, o);
  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const pre = await preflightDotykackaPosActions(cfg, accessToken);
  if (!pre.ok) return { ok: false, error: pre.error, meta: { tableId, sessionExternalId, action: "order/hello" } };

  const listResult = await listOpenDotykackaOrdersForTable(cfg, accessToken, tableId);
  const listUnreadable = !listResult.ok && shouldCreateOrderWhenListUnreadable(listResult.message);
  if (!listResult.ok && !listUnreadable) {
    return {
      ok: false,
      error: buildBillRequestNoOpenAccountError(o, tableId, listResult),
      meta: {
        tableId,
        sessionExternalId,
        action: "order/list",
        httpStatus: listResult.httpStatus,
      },
    };
  }
  if (listResult.ok && listResult.orders.length === 0) {
    return {
      ok: false,
      error: buildBillRequestNoOpenAccountError(o, tableId, null),
      meta: { tableId, sessionExternalId, action: "order/list" },
    };
  }

  const ordersTotal = typeof o.ordersTotal === "number" ? o.ordersTotal : Number(o.ordersTotal);
  const tipPct = typeof o.tipPct === "number" ? o.tipPct : Number(o.tipPct);
  const tipAmount = typeof o.tipAmount === "number" ? o.tipAmount : Number(o.tipAmount);
  const billTotal = typeof o.billTotal === "number" ? o.billTotal : Number(o.billTotal);
  const paymentMethodRaw = typeof o.paymentMethod === "string" ? o.paymentMethod.trim() : "";
  const rawLabel = typeof o.tableLabel === "string" ? o.tableLabel.trim() : "";
  const billLine = buildBillRequestItemNote({
    tableLabelOrId: rawLabel || String(tableId),
    paymentMethodRaw,
    ordersTotal,
    tipPct,
    tipAmount,
    billTotal,
    timeLabel: formatRestaurantLocalHhmm(),
  });

  const items: OrderPosItem[] = [
    {
      id: productId,
      qty: 1,
      note: billLine,
      tags: [DOTYKACKA_BILL_REQUEST_PRINT_TAG],
    },
  ];
  const result = await submitOrderItemsToDotykackaTable(
    cfg,
    accessToken,
    tableId,
    sessionExternalId,
    items,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    meta: {
      ...result.meta,
      tableId,
      action: result.meta.action ?? "bill_request_add_item",
    },
  };
}

/**
 * Přivolání personálu: položka 0 Kč na účet stolu hosta (`order/add-item` / `order/create`).
 * Štítek `oa-volani` může tisknout bon.
 */
export async function syncStaffCallToDotykacka(payload: unknown, cfg: DotykackaConfig): Promise<DotykackaSyncResult> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Neplatné tělo přivolání personálu", meta: {} };
  }
  const o = payload as Record<string, unknown>;

  const tableRaw = o.tableId;
  const guestTableId =
    typeof tableRaw === "string"
      ? Number.parseInt(tableRaw, 10)
      : typeof tableRaw === "number"
        ? tableRaw
        : NaN;
  if (!Number.isFinite(guestTableId)) {
    return { ok: false, error: "Chybí nebo neplatné tableId (očekává se ID stolu v Dotyce)", meta: {} };
  }

  const productId = resolveStaffCallProductId(cfg.productMap);
  if (productId === undefined) {
    return {
      ok: false,
      error:
        `Chybí produkt pro přivolání obsluhy — v mapě produktů nastavte klíč "${DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY}" ` +
        `(nebo DOTYKACKA_STAFF_CALL_PRODUCT_ID v .env) na ID skryté 0 Kč položky v Dotykačce.`,
      meta: { tableId: guestTableId, action: "staff_call_missing_product" },
    };
  }

  const sessionExternalId = buildDotykackaTableSessionExternalId(cfg, o);
  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const pre = await preflightDotykackaPosActions(cfg, accessToken);
  if (!pre.ok) {
    return {
      ok: false,
      error: pre.error,
      meta: {
        tableId: guestTableId,
        sessionExternalId,
        action: "order/hello",
      },
    };
  }

  const rawLabel = typeof o.tableLabel === "string" ? o.tableLabel.trim() : "";
  const note = buildStaffCallItemNote(rawLabel || String(guestTableId));
  const items: OrderPosItem[] = [
    {
      id: productId,
      qty: 1,
      note,
      tags: [DOTYKACKA_STAFF_CALL_PRINT_TAG],
    },
  ];

  const result = await submitOrderItemsToDotykackaTable(
    cfg,
    accessToken,
    guestTableId,
    sessionExternalId,
    items,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    meta: {
      ...result.meta,
      tableId: guestTableId,
      action: result.meta.action ?? "staff_call_add_item",
    },
  };
}

/**
 * Vrátí product id pro POS: nejdřív mapa z .env, jinak číslo z řetězce (kladné i záporné, jak vrací API).
 */
export function resolveDotykackaProductId(
  menuKey: string,
  productMap: Record<string, number>,
): number | undefined {
  const mapped = productMap[menuKey];
  if (mapped !== undefined && Number.isFinite(mapped)) {
    return mapped;
  }
  if (/^-?\d+$/.test(menuKey)) {
    const n = Number.parseInt(menuKey, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

type DotykackaLineCustomization = {
  productCustomizationId: number;
  productId: number;
  qty: number;
};

type OrderLineInput = {
  name: string;
  qty: number;
  unitPriceCzk: number;
  menuItemId?: string;
  dotykackaCustomizations?: DotykackaLineCustomization[];
};

type OrderPosItem = {
  id: number;
  qty: number;
  note?: string;
  /** Štítky řádku (filtry tisku v Dotykačce). */
  tags?: string[];
  customizations?: Array<{
    "product-customization-id": number;
    "product-id": number;
    qty: number;
  }>;
};

function posActionResponseCode(
  posted: { ok: true; data: unknown } | { ok: false; status: number; text: string },
): number | undefined {
  if (!posted.ok) return parseDotykackaPosActionCodeFromText(posted.text);
  return parseDotykackaPosActionCode(posted.data);
}

function dotykackaActionErrorMessage(
  cfg: DotykackaConfig,
  action: string,
  code: number,
  httpStatus?: number,
  rawText?: string,
): string {
  if (code === 2001) {
    return (
      "Dotykačka dočasně zamkla účet u stolu (právě ho někdo otevřel na pokladně). " +
      "Zkuste objednávku znovu za chvíli."
    );
  }
  if (code === 2009) {
    return "Na stole už je otevřený účet — objednávka se přidá k němu při dalším pokusu.";
  }
  if (httpStatus !== undefined && rawText !== undefined) {
    return formatPosActionsHttpError(cfg, httpStatus, rawText);
  }
  return `Dotykačka ${action} selhal (code ${code})`;
}

function interpretPosActionPost(
  cfg: DotykackaConfig,
  posted: { ok: true; data: unknown } | { ok: false; status: number; text: string },
  action: string,
  meta: DotykackaSyncMeta,
): DotykackaSyncResult | { ok: true; meta: DotykackaSyncMeta } {
  if (!posted.ok) {
    const code = parseDotykackaPosActionCodeFromText(posted.text);
    return {
      ok: false,
      error: dotykackaActionErrorMessage(cfg, action, code ?? -1, posted.status, posted.text),
      meta: { ...meta, action, httpStatus: posted.status, posActionCode: code },
    };
  }
  if (!posActionConfirmed(posted.data)) {
    return {
      ok: false,
      error: `Dotykačka ${action}: pokladna nevrátila výsledek. Zkuste objednávku znovu.`,
      meta: { ...meta, action },
    };
  }
  const code = parseDotykackaPosActionCode(posted.data);
  if (code !== undefined && code !== 0) {
    return {
      ok: false,
      error: dotykackaActionErrorMessage(cfg, action, code),
      meta: { ...meta, action, posActionCode: code },
    };
  }
  return { ok: true, meta: { ...meta, action, posActionCode: 0 } };
}

type TryAddItemsResult =
  | { ok: true; meta: DotykackaSyncMeta }
  | { ok: false; error: string; meta: DotykackaSyncMeta }
  | null;

async function tryAddItemsToOpenOrders(
  cfg: DotykackaConfig,
  accessToken: string,
  tableId: number | null,
  sessionExternalId: string,
  items: OrderPosItem[],
): Promise<TryAddItemsResult> {
  const listResult = await listOpenDotykackaOrdersForTable(cfg, accessToken, tableId);
  if (!listResult.ok) {
    return {
      ok: false,
      error: listResult.message,
      meta: {
        tableId: tableId ?? undefined,
        sessionExternalId,
        action: "order/list",
        httpStatus: listResult.httpStatus,
      },
    };
  }

  const openCount = listResult.orders.length;
  let candidates = pickTargetOpenOrdersForMerge(listResult.orders, sessionExternalId);
  if (sessionExternalId.endsWith("-oa-signals")) {
    candidates = candidates.filter((c) => c.externalId === sessionExternalId);
  }
  if (candidates.length === 0) return null;

  let lastErr: DotykackaSyncResult | null = null;
  for (const cand of candidates) {
    const posted = await postDotykackaPosAction(cfg, accessToken, {
      action: "order/add-item",
      "order-id": cand.orderId,
      items,
    });
    const outcome = interpretPosActionPost(cfg, posted, "order/add-item", {
      tableId: tableId ?? undefined,
      sessionExternalId,
    });
    if (outcome.ok) return outcome;

    lastErr = outcome;
    const code = posActionResponseCode(posted);
    if (shouldTryNextOpenOrder(code)) continue;
    return { ...outcome, meta: { ...outcome.meta, openOrderCount: openCount } };
  }

  if (lastErr) {
    return { ...lastErr, meta: { ...lastErr.meta, openOrderCount: openCount } };
  }
  return null;
}

async function tryCreateOrderOnTable(
  cfg: DotykackaConfig,
  accessToken: string,
  tableId: number | null,
  sessionExternalId: string,
  items: OrderPosItem[],
  tableNote?: string,
): Promise<DotykackaSyncResult | { ok: true; meta: DotykackaSyncMeta }> {
  const posted = await postDotykackaPosAction(cfg, accessToken, {
    action: "order/create",
    ...(tableId != null ? { "table-id": tableId } : {}),
    "external-id": sessionExternalId,
    items,
    ...(tableNote ? { note: tableNote } : {}),
  });
  return interpretPosActionPost(cfg, posted, "order/create", {
    tableId: tableId ?? undefined,
    sessionExternalId,
  });
}

/** Jen při ORDER_LOCKED (2001) — prázdný stůl jde hned na create (bez opakovaného listu). */
const ADD_ITEM_LOCK_RETRY_MS = [0, 700, 1400];

/**
 * Odeslání položek na stůl: add-item k otevřenému účtu, create hned když list nic nevrátí.
 */
async function submitOrderItemsToDotykackaTable(
  cfg: DotykackaConfig,
  accessToken: string,
  tableId: number | null,
  sessionExternalId: string,
  items: OrderPosItem[],
  tableNote?: string,
): Promise<DotykackaSyncResult> {
  let lastAdd: TryAddItemsResult = null;

  for (let i = 0; i < ADD_ITEM_LOCK_RETRY_MS.length; i++) {
    const delay = ADD_ITEM_LOCK_RETRY_MS[i]!;
    if (delay > 0) await sleep(delay);

    const addResult = await tryAddItemsToOpenOrders(cfg, accessToken, tableId, sessionExternalId, items);
    lastAdd = addResult;

    if (addResult?.ok === true) return addResult;

    // Prázdný stůl → create (neopakovat list se sleepem).
    if (addResult === null) break;

    if (addResult.meta.action === "order/list") {
      if (shouldCreateOrderWhenListUnreadable(addResult.error)) break;
      return addResult;
    }

    if ((addResult.meta.openOrderCount ?? 0) > 0) {
      const code = addResult.meta.posActionCode;
      if (code === 2001 && i < ADD_ITEM_LOCK_RETRY_MS.length - 1) continue;
      return addResult;
    }

    break;
  }

  const listUnreadable =
    lastAdd != null &&
    lastAdd.ok === false &&
    lastAdd.meta.action === "order/list" &&
    shouldCreateOrderWhenListUnreadable(lastAdd.error);
  if (lastAdd && !lastAdd.ok && !listUnreadable) return lastAdd;

  const createResult = await tryCreateOrderOnTable(
    cfg,
    accessToken,
    tableId,
    sessionExternalId,
    items,
    tableNote,
  );
  if (createResult.ok) return createResult;

  if (
    typeof createResult.meta.posActionCode === "number" &&
    shouldRelistOrdersAfterCreateFailure(createResult.meta.posActionCode)
  ) {
    const addAfter = await tryAddItemsToOpenOrders(cfg, accessToken, tableId, sessionExternalId, items);
    if (addAfter?.ok) return addAfter;
    if (addAfter && !addAfter.ok) return addAfter;
  }

  return createResult;
}

/**
 * Odeslání potvrzené objednávky do pokladny.
 * Stejný stůl + zařízení = jeden `external-id` relace; druhá a další objednávka jdou přes
 * `order/add-item` na otevřený účet (`order/list` + shoda external-id), ne nový `order/create`.
 * Vyžaduje zapnutou pokladnu (Dotypos 1.235+ pro `order/list`).
 *
 * Dokumentace: https://docs.api.dotypos.com/pos-actions/pos-actions/
 */
export async function syncOrderConfirmedToDotykacka(
  payload: unknown,
  cfg: DotykackaConfig,
): Promise<DotykackaSyncResult> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Neplatné tělo objednávky", meta: {} };
  }

  const o = payload as Record<string, unknown>;
  const tableRaw = o.tableId;
  const tableId =
    typeof tableRaw === "string"
      ? Number.parseInt(tableRaw, 10)
      : typeof tableRaw === "number"
        ? tableRaw
        : NaN;
  if (!Number.isFinite(tableId)) {
    return { ok: false, error: "Chybí nebo neplatné tableId (očekává se ID stolu v Dotyce)", meta: {} };
  }

  const linesRaw = o.lines;
  if (!Array.isArray(linesRaw) || linesRaw.length === 0) {
    return { ok: false, error: "Objednávka nemá žádné položky", meta: { tableId } };
  }

  // Model otevřeného účtu: jedna relace = jeden otevřený účet v Dotyce (parkovaný na stole).
  // Další objednávky přidáváme přes `order/add-item`, aby účet zůstal otevřený (nepřesouval se do uzavřených/zaplacených).
  const sessionExternalId = buildDotykackaTableSessionExternalId(cfg, o);

  const items: Array<{
    id: number;
    qty: number;
    note?: string;
    customizations?: Array<{
      "product-customization-id": number;
      "product-id": number;
      qty: number;
    }>;
  }> = [];

  for (const row of linesRaw) {
    if (!row || typeof row !== "object") continue;
    const line = row as OrderLineInput;
    const qty = typeof line.qty === "number" && line.qty > 0 ? line.qty : 0;
    if (qty <= 0) continue;

    const menuKey = typeof line.menuItemId === "string" ? line.menuItemId.trim() : "";
    if (!menuKey) {
      return {
        ok: false,
        error:
          "Chybí menuItemId u položky — dopňte mapování v menu nebo DOTYKACKA_PRODUCT_MAP_JSON.",
        meta: { tableId, sessionExternalId },
      };
    }

    const productId = resolveDotykackaProductId(menuKey, cfg.productMap);
    if (productId === undefined) {
      return {
        ok: false,
        error: `Pro položku "${menuKey}" chybí mapování v DOTYKACKA_PRODUCT_MAP_JSON nebo platné číselné product id (jako v API Dotykačky, včetně záporných).`,
        meta: { tableId, sessionExternalId },
      };
    }

    const dk = line.dotykackaCustomizations;
    const customizations =
      Array.isArray(dk) && dk.length > 0
        ? dk
            .map((c) => {
              const pc = c.productCustomizationId;
              const pid = c.productId;
              const q = typeof c.qty === "number" && c.qty > 0 ? c.qty : 1;
              if (!Number.isFinite(pc) || !Number.isFinite(pid)) return null;
              return {
                "product-customization-id": pc,
                "product-id": pid,
                qty: q,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
        : undefined;

    items.push({
      id: productId,
      qty,
      note: typeof line.name === "string" && line.name.trim() ? line.name.trim() : undefined,
      ...(customizations && customizations.length > 0 ? { customizations } : {}),
    });
  }

  if (items.length === 0) {
    return { ok: false, error: "Nepodařilo se sestavit položky pro Dotykačku", meta: { tableId, sessionExternalId } };
  }

  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  // Bez order/hello — šetří jedno webhook čekání; list/add-item/create samy odhalí výpadek POS.

  const tableNote =
    typeof o.tableLabel === "string" && o.tableLabel.trim()
      ? `Stůl: ${o.tableLabel.trim()}`
      : undefined;

  return submitOrderItemsToDotykackaTable(
    cfg,
    accessToken,
    tableId,
    sessionExternalId,
    items,
    tableNote,
  );
}

/** Skrytá metoda „Online“ v Dotypos — platba mimo pokladní terminál (XPay). */
export const DOTYKACKA_PAYMENT_METHOD_ONLINE = 900000019;
/** Karta na pokladně — záloha, když metoda Online na cloudu není zapnutá. */
export const DOTYKACKA_PAYMENT_METHOD_CARD = 900000002;

function posActionSucceeded(data: unknown): boolean {
  const code = parseDotykackaPosActionCode(data);
  return code === undefined || code === 0;
}

/**
 * Uzavře otevřené účty u stolu po úspěšné platbě XPay.
 * Zkouší několik tvarů `order/pay` (API se liší podle verze Dotypos).
 */
export async function syncXpayPaidToDotykacka(input: {
  cfg: DotykackaConfig;
  tableId: number;
  tipAmountCzk?: number;
  splitItems?: XpaySplitItem[] | null;
}): Promise<DotykackaSyncResult> {
  const accessToken = await getDotykackaAccessTokenForCloud(input.cfg);
  const listed = await listOpenDotykackaOrdersForTable(input.cfg, accessToken, input.tableId);
  if (!listed.ok) {
    return { ok: false, error: listed.message, meta: { tableId: input.tableId, action: "xpay_pay_list" } };
  }

  const tip = typeof input.tipAmountCzk === "number" && input.tipAmountCzk > 0 ? Math.round(input.tipAmountCzk) : 0;
  const split = input.splitItems && input.splitItems.length > 0 ? input.splitItems : null;

  const persistTip = async (orderId: number, tipAmount: number): Promise<string | null> => {
    if (tipAmount < 1) return null;
    return writeDotykackaPaidTip({
      cfg: input.cfg,
      accessToken,
      orderId,
      tipAmountCzk: tipAmount,
    });
  };

  const rememberManualTip = async (orderId: number, tipAmount: number) => {
    if (tipAmount < 1) return;
    await postDotykackaPosAction(input.cfg, accessToken, posOrderTipBody(orderId, tipAmount));
    await primeDotykackaOrderTip({
      cfg: input.cfg,
      accessToken,
      orderId,
      tipAmountCzk: tipAmount,
    });
  };

  const findOpenTipItemId = async (orderId: number, tipAmount: number): Promise<number | null> => {
    const listedAgain = await postDotykackaPosAction(
      input.cfg,
      accessToken,
      { action: "order/list", "table-id": input.tableId },
      12_000,
    );
    if (!listedAgain.ok) return null;
    const bill = parseTableOpenBillFromPosListData(listedAgain.data);
    const line = bill.lines.find(
      (row) =>
        (row.orderId == null || row.orderId === orderId) &&
        isTipBillLine(row.name, row.detail) &&
        Math.round(row.unitPriceCzk) === tipAmount &&
        row.itemId != null,
    );
    return line?.itemId ?? null;
  };

  /** Dokud účet není vystavený, přičte spropitné do součtu. Úspěch jen když je řádek na účtu. */
  const addTipToOpenBill = async (
    orderId: number,
    tipAmount: number,
  ): Promise<{ ok: boolean; error: string | null; itemId: number | null }> => {
    if (tipAmount < 1) return { ok: true, error: null, itemId: null };
    const product = await resolveDotykackaTipProductId(input.cfg, accessToken);
    if (product.id == null) {
      return { ok: false, error: product.error ?? "Položku Spropitné se v Dotykačce nepodařilo založit.", itemId: null };
    }
    const existing = await findOpenTipItemId(orderId, tipAmount);
    if (existing != null) return { ok: true, error: null, itemId: existing };
    const item = tipLineItem(product.id, tipAmount);
    let lastErr = "Pokladna řádek Spropitné na účet nepřidala.";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const posted = await postDotykackaPosAction(
        input.cfg,
        accessToken,
        { action: "order/add-item", "order-id": orderId, items: [item] },
        12_000,
      );
      if (!posted.ok) {
        lastErr = formatPosActionsHttpError(input.cfg, posted.status, posted.text);
      } else {
        const code = parseDotykackaPosActionCode(posted.data);
        if (code !== undefined && code !== 0) lastErr = `Dotykačka order/add-item code ${code}`;
      }
      const found = await findOpenTipItemId(orderId, tipAmount);
      if (found != null) return { ok: true, error: null, itemId: found };
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    return { ok: false, error: lastErr, itemId: null };
  };

  if (listed.orders.length === 0) {
    if (tip > 0) {
      const found = await findRecentPaidOrderId({
        cfg: input.cfg,
        accessToken,
        tableId: input.tableId,
      });
      if (found.orderId == null) {
        return {
          ok: false,
          error: `Účet v Dotykačce je už zavřený, ale spropitné se nepodařilo dohledat k zápisu${found.error ? `: ${found.error}` : "."}`,
          meta: { tableId: input.tableId, action: "xpay_tip" },
        };
      }
      await rememberManualTip(found.orderId, tip);
      const tipErr = await persistTip(found.orderId, tip);
      if (tipErr) {
        return {
          ok: false,
          error: `Platba prošla, ale spropitné se do Dotykačky nezapsalo: ${tipErr}`,
          meta: { tableId: input.tableId, action: "xpay_tip" },
        };
      }
    }
    return { ok: true, meta: { tableId: input.tableId, action: "xpay_pay_already_closed" } };
  }

  if (split) {
    const grouped = groupSplitItemsByOrder(split);
    const errors: string[] = [];
    let groupIndex = 0;
    for (const [orderId, splitItems] of grouped) {
      const tipForThis = groupIndex === 0 ? tip : 0;
      groupIndex += 1;
      const tipLine = await addTipToOpenBill(orderId, tipForThis);
      if (tipForThis > 0 && tipLine.ok && tipLine.itemId == null) {
        errors.push(`účet ${orderId}: spropitné: řádek je na účtu, ale nejde ho odříznout s platbou`);
        continue;
      }
      if (!tipLine.ok) await rememberManualTip(orderId, tipForThis);
      const splitItemsToPay = appendTipToSplitItems(splitItems, tipLine.itemId);
      const methods = [DOTYKACKA_PAYMENT_METHOD_ONLINE, DOTYKACKA_PAYMENT_METHOD_CARD];
      let paid = false;
      let paidData: unknown = null;
      let lastErr = "";
      for (const methodId of methods) {
        const posted = await postDotykackaPosAction(
          input.cfg,
          accessToken,
          posPayWithTip(
            {
              action: "order/split-issue-pay",
              "order-id": orderId,
              "table-id": input.tableId,
              "split-items": splitItemsToPay,
              "payment-method-id": methodId,
            },
            tipLine.ok ? 0 : tipForThis,
          ),
        );
        if (!posted.ok) {
          lastErr = formatPosActionsHttpError(input.cfg, posted.status, posted.text);
          continue;
        }
        if (!posActionSucceeded(posted.data)) {
          const code = parseDotykackaPosActionCode(posted.data);
          lastErr = `Dotykačka order/split-issue-pay code ${code ?? "?"}`;
          continue;
        }
        paid = true;
        paidData = posted.data;
        break;
      }
      if (!paid) errors.push(`účet ${orderId}: ${lastErr || "split-pay selhal"}`);
      else if (!tipLine.ok && tipForThis > 0) {
        errors.push(`účet ${orderId}: spropitné: ${tipLine.error ?? "řádek se na účet nezapsal"}`);
      }
    }
    if (errors.length > 0) {
      const onlyTip = errors.every((e) => e.includes("spropitné"));
      return {
        ok: false,
        error: onlyTip
          ? `Platba prošla, ale spropitné se do Dotykačky nezapsalo: ${errors.join("; ")}`
          : `Platba v XPay prošla, ale Dotykačka neodřízla položky: ${errors.join("; ")}`,
        meta: { tableId: input.tableId, action: onlyTip ? "xpay_tip" : "xpay_split_pay" },
      };
    }
    return { ok: true, meta: { tableId: input.tableId, action: "xpay_split_pay" } };
  }

  const errors: string[] = [];

  for (let i = 0; i < listed.orders.length; i++) {
    const orderId = listed.orders[i]!.orderId;
    const tipForThis = i === 0 ? tip : 0;
    const tipLine = await addTipToOpenBill(orderId, tipForThis);
    if (!tipLine.ok) await rememberManualTip(orderId, tipForThis);
    const methods = [DOTYKACKA_PAYMENT_METHOD_ONLINE, DOTYKACKA_PAYMENT_METHOD_CARD];
    const variants: Record<string, unknown>[] = [];
    for (const methodId of methods) {
      variants.push(
        posPayWithTip(
          {
            action: "order/pay",
            "order-id": orderId,
            "payment-method-id": methodId,
          },
          tipLine.ok ? 0 : tipForThis,
        ),
      );
      variants.push(
        posPayWithTip(
          {
            action: "order/issue-and-pay",
            "order-id": orderId,
            "payment-method-id": methodId,
          },
          tipLine.ok ? 0 : tipForThis,
        ),
      );
    }

    let paid = false;
    let paidData: unknown = null;
    let lastErr = "";
    for (const body of variants) {
      const posted = await postDotykackaPosAction(input.cfg, accessToken, body);
      if (!posted.ok) {
        lastErr = formatPosActionsHttpError(input.cfg, posted.status, posted.text);
        continue;
      }
      if (!posActionSucceeded(posted.data)) {
        const code = parseDotykackaPosActionCode(posted.data);
        lastErr = `Dotykačka ${String(body.action)} code ${code ?? "?"}`;
        continue;
      }
      paid = true;
      paidData = posted.data;
      break;
    }
    if (!paid) errors.push(`účet ${orderId}: ${lastErr || "pay selhal"}`);
    else if (!tipLine.ok && tipForThis > 0) {
      errors.push(`účet ${orderId}: spropitné: ${tipLine.error ?? "řádek se na účet nezapsal"}`);
    }
  }

  const verify = await listOpenDotykackaOrdersForTable(input.cfg, accessToken, input.tableId);
  if (verify.ok && verify.orders.length > 0) {
    const ids = verify.orders.map((o) => o.orderId).join(", ");
    return {
      ok: false,
      error: `Platba v XPay prošla, ale v Dotykačce zůstává otevřený účet (${ids}). Pokladna musí běžet a mít metodu Online nebo Karta.`,
      meta: { tableId: input.tableId, action: "xpay_pay_still_open" },
    };
  }
  if (!verify.ok) {
    return {
      ok: false,
      error: `Platba v XPay prošla, ale uzavření účtu v Dotykačce nešlo ověřit: ${verify.message}`,
      meta: { tableId: input.tableId, action: "xpay_pay_verify" },
    };
  }

  if (errors.length > 0) {
    const onlyTip = errors.every((e) => e.includes("spropitné"));
    return {
      ok: false,
      error: onlyTip
        ? `Platba prošla a účet se uzavřel, ale spropitné se do Dotykačky nezapsalo: ${errors.join("; ")}`
        : `Platba v XPay prošla, ale Dotykačka účet neuzavřela: ${errors.join("; ")}`,
      meta: { tableId: input.tableId, action: onlyTip ? "xpay_tip" : "xpay_pay" },
    };
  }
  return { ok: true, meta: { tableId: input.tableId, action: "xpay_pay" } };
}
