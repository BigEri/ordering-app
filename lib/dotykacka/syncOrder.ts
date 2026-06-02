import { randomUUID } from "node:crypto";

import type { DotykackaConfig } from "./config";
import { getDotykackaAccessTokenForCloud } from "./accessToken";
import { dotykackaPosWebhookMaxWaitMs, getDotykackaPosWebhookPublicBaseUrl } from "./posWebhookBase";
import { cancelPosActionWebhook, waitForPosActionWebhook } from "../server/posActionWebhookRegistry";

export type DotykackaSyncMeta = {
  action?: string;
  httpStatus?: number;
  /** external-id relace u stolu (naše idempotence / merge key) */
  sessionExternalId?: string;
  /** table id v Dotyce */
  tableId?: number;
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

function fmtCzk(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `${v} Kč`;
}

function hhmmLocalNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mergeOrderNoteWithOaBillLine(existingNote: unknown, billLine: string): string {
  const raw = typeof existingNote === "string" ? existingNote : "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l !== "");

  const prefixes = ["CHCE ZAPLATIT:", "OA_BILL:"];
  const next: string[] = [];
  let replaced = false;
  for (const l of lines) {
    if (prefixes.some((p) => l.startsWith(p))) {
      if (!replaced) {
        next.push(billLine);
        replaced = true;
      }
      continue;
    }
    next.push(l);
  }
  if (!replaced) {
    // nahoře kvůli viditelnosti v Dotyce
    next.unshift(billLine);
  }
  return next.join("\n");
}

function mergeOrderNoteWithOaStaffLine(existingNote: unknown, staffLine: string): string {
  const raw = typeof existingNote === "string" ? existingNote : "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l !== "");

  const prefix = "VOLÁ OBSLUHU:";
  const next: string[] = [];
  let replaced = false;
  for (const l of lines) {
    if (l.startsWith(prefix)) {
      if (!replaced) {
        next.push(staffLine);
        replaced = true;
      }
      continue;
    }
    next.push(l);
  }
  if (!replaced) {
    // nahoře kvůli viditelnosti v Dotyce
    next.unshift(staffLine);
  }
  return next.join("\n");
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

function isEmptyDotykacka404Body(text: string): boolean {
  const t = text.trim();
  return t === "" || t === "{}";
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function shouldRetryDotykackaPosActions(body: Record<string, unknown>, status: number, text: string): boolean {
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
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> {
  const webhookBase = getDotykackaPosWebhookPublicBaseUrl();

  const attemptOnce = async (): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> => {
    let callbackId: string | null = null;
    let waitWebhook: Promise<string | null> | null = null;
    const outgoing: Record<string, unknown> = { ...body };
    if (webhookBase) {
      callbackId = randomUUID();
      waitWebhook = waitForPosActionWebhook(callbackId, dotykackaPosWebhookMaxWaitMs());
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
        if (callbackId) cancelPosActionWebhook(callbackId);
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

  // Retry/backoff: když Dotypos vrátí 400 "message parsing error", často jde o transient při paralelních akcích.
  const backoffMs = [700, 1500, 2800];
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
  const v = order["external-id"];
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
  tableId: number,
): Promise<ListOpenOrdersResult> {
  const posted = await postDotykackaPosAction(cfg, accessToken, {
    action: "order/list",
    "table-id": tableId,
  });
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
 * Zápis "žádost o účet" do Dotykačky: aktualizuje poznámku u otevřeného účtu.
 *
 * Pozn.: dříve se posílalo i `order/issue` jako notifikační ping. To ale může změnit stav účtu
 * a omezit některé funkce obsluhy v Dotypos (např. rozdělení). Proto držíme jen poznámku.
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

  const sessionExternalId = buildDotykackaTableSessionExternalId(cfg, o);
  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const pre = await preflightDotykackaPosActions(cfg, accessToken);
  if (!pre.ok) return { ok: false, error: pre.error, meta: { tableId, sessionExternalId, action: "order/hello" } };

  const listResult = await listOpenDotykackaOrdersForTable(cfg, accessToken, tableId);
  if (!listResult.ok) {
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
  if (listResult.orders.length === 0) {
    return {
      ok: false,
      error: buildBillRequestNoOpenAccountError(o, tableId, null),
      meta: { tableId, sessionExternalId, action: "order/list" },
    };
  }
  const openOrders = listResult.orders;

  const ordersTotal = typeof o.ordersTotal === "number" ? o.ordersTotal : Number(o.ordersTotal);
  const tipPct = typeof o.tipPct === "number" ? o.tipPct : Number(o.tipPct);
  const tipAmount = typeof o.tipAmount === "number" ? o.tipAmount : Number(o.tipAmount);
  const billTotal = typeof o.billTotal === "number" ? o.billTotal : Number(o.billTotal);

  const paymentMethodRaw = typeof o.paymentMethod === "string" ? o.paymentMethod.trim() : "";
  const paymentMethodLabel =
    paymentMethodRaw === "CARD"
      ? "Karta"
      : paymentMethodRaw === "CASH"
        ? "Hotovost"
        : paymentMethodRaw === "MIX"
          ? "Mix"
          : null;

  const rawLabel = typeof o.tableLabel === "string" ? o.tableLabel.trim() : "";
  const humanTableNumber = rawLabel ? (rawLabel.match(/\d+/)?.[0] ?? rawLabel) : String(tableId);
  const billLine = [
    `CHCE ZAPLATIT: ${hhmmLocalNow()}`,
    `STŮL - ${humanTableNumber}`,
    ...(paymentMethodLabel ? [`platba ${paymentMethodLabel}`] : []),
    `subtotal ${fmtCzk(ordersTotal)}`,
    Number.isFinite(tipPct) ? `tip ${Math.round(tipPct)}% (${fmtCzk(tipAmount)})` : `tip ${fmtCzk(tipAmount)}`,
    `total ${fmtCzk(billTotal)}`,
  ].join(" · ");

  // Propsat žádost o účet ideálně jen na "náš" otevřený účet (external-id relace).
  // Pokud na stole žádný náš účet není, spadneme na všechny otevřené (lepší než mlčet).
  const ours = openOrders.filter((x) => x.externalId === sessionExternalId);
  const targets = ours.length > 0 ? ours : openOrders;

  for (const ord of targets) {
    const note = mergeOrderNoteWithOaBillLine(ord.note, billLine);
    const upd = await postDotykackaPosAction(cfg, accessToken, {
      action: "order/update",
      "order-id": ord.orderId,
      note,
    });
    if (!upd.ok) {
      return {
        ok: false,
        error: formatPosActionsHttpError(cfg, upd.status, upd.text),
        meta: { tableId, sessionExternalId, action: "order/update", httpStatus: upd.status },
      };
    }
    const updData = upd.data;
    if (updData && typeof updData === "object") {
      const code = (updData as { code?: unknown }).code;
      if (typeof code === "number" && code !== 0) {
        return {
          ok: false,
          error: `Dotykačka order/update selhal (code ${code})`,
          meta: { tableId, sessionExternalId, action: "order/update" },
        };
      }
    }
  }

  return { ok: true, meta: { tableId, sessionExternalId, action: "bill_request_note" } };
}

/**
 * Přivolání personálu: doplní poznámku k otevřenému účtu na stole.
 * Používá jen `order/update` (bez `order/issue`), aby se neměnil stav účtu v Dotypos.
 */
export async function syncStaffCallToDotykacka(payload: unknown, cfg: DotykackaConfig): Promise<DotykackaSyncResult> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Neplatné tělo přivolání personálu", meta: {} };
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

  const sessionExternalId = buildDotykackaTableSessionExternalId(cfg, o);
  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const pre = await preflightDotykackaPosActions(cfg, accessToken);
  if (!pre.ok) return { ok: false, error: pre.error, meta: { tableId, sessionExternalId, action: "order/hello" } };

  const listResult = await listOpenDotykackaOrdersForTable(cfg, accessToken, tableId);
  if (!listResult.ok) {
    return {
      ok: false,
      error: listResult.message,
      meta: {
        tableId,
        sessionExternalId,
        action: "order/list",
        httpStatus: listResult.httpStatus,
      },
    };
  }
  const rawLabel = typeof o.tableLabel === "string" ? o.tableLabel.trim() : "";
  const humanTableNumber = rawLabel ? (rawLabel.match(/\d+/)?.[0] ?? rawLabel) : String(tableId);
  const staffLine = [`VOLÁ OBSLUHU: ${hhmmLocalNow()}`, `STŮL - ${humanTableNumber}`].join(" · ");

  // Pokud účet na stole ještě neexistuje, založíme ho jen kvůli poznámce (bez `issue`).
  // Pozor: některé konfigurace Dotypos nemusí povolit účet bez položek; v tom případě vracíme chybu z API.
  if (listResult.orders.length === 0) {
    const created = await postDotykackaPosAction(cfg, accessToken, {
      action: "order/create",
      "table-id": tableId,
      "external-id": sessionExternalId,
      note: staffLine,
      items: [],
    });
    if (!created.ok) {
      return {
        ok: false,
        error: formatPosActionsHttpError(cfg, created.status, created.text),
        meta: { tableId, sessionExternalId, action: "order/create", httpStatus: created.status },
      };
    }
    const createdData = created.data;
    if (createdData && typeof createdData === "object") {
      const code = (createdData as { code?: unknown }).code;
      if (typeof code === "number" && code !== 0) {
        return {
          ok: false,
          error: `Dotykačka order/create selhal (code ${code})`,
          meta: { tableId, sessionExternalId, action: "order/create" },
        };
      }
    }
    return { ok: true, meta: { tableId, sessionExternalId, action: "staff_call_create_note" } };
  }

  const ours = listResult.orders.filter((x) => x.externalId === sessionExternalId);
  const targets = ours.length > 0 ? ours : listResult.orders;

  for (const ord of targets) {
    const note = mergeOrderNoteWithOaStaffLine(ord.note, staffLine);
    const upd = await postDotykackaPosAction(cfg, accessToken, {
      action: "order/update",
      "order-id": ord.orderId,
      note,
    });
    if (!upd.ok) {
      return {
        ok: false,
        error: formatPosActionsHttpError(cfg, upd.status, upd.text),
        meta: { tableId, sessionExternalId, action: "order/update", httpStatus: upd.status },
      };
    }
    const updData = upd.data;
    if (updData && typeof updData === "object") {
      const code = (updData as { code?: unknown }).code;
      if (typeof code === "number" && code !== 0) {
        return {
          ok: false,
          error: `Dotykačka order/update selhal (code ${code})`,
          meta: { tableId, sessionExternalId, action: "order/update" },
        };
      }
    }
  }

  return { ok: true, meta: { tableId, sessionExternalId, action: "staff_call_note" } };
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
  const pre = await preflightDotykackaPosActions(cfg, accessToken);
  if (!pre.ok) return { ok: false, error: pre.error, meta: { tableId, sessionExternalId, action: "order/hello" } };

  const tableNote =
    typeof o.tableLabel === "string" && o.tableLabel.trim()
      ? `Stůl: ${o.tableLabel.trim()}`
      : undefined;
  const existingOrderId = await findOpenDotykackaOrderIdForSession(cfg, accessToken, tableId, sessionExternalId);

  const body: Record<string, unknown> =
    existingOrderId !== undefined
      ? {
          action: "order/add-item",
          "order-id": existingOrderId.orderId,
          items,
        }
      : {
          action: "order/create",
          "table-id": tableId,
          "external-id": sessionExternalId,
          items,
          ...(tableNote ? { note: tableNote } : {}),
        };

  const posted = await postDotykackaPosAction(cfg, accessToken, body);
  if (!posted.ok) {
    return {
      ok: false,
      error: formatPosActionsHttpError(cfg, posted.status, posted.text),
      meta: {
        tableId,
        sessionExternalId,
        action: typeof body.action === "string" ? body.action : undefined,
        httpStatus: posted.status,
      },
    };
  }
  const postedData = posted.data;
  if (postedData && typeof postedData === "object") {
    const code = (postedData as { code?: unknown }).code;
    if (typeof code === "number" && code !== 0) {
      const action = typeof body.action === "string" ? body.action : "akce";
      return {
        ok: false,
        error: `Dotykačka ${action} selhal (code ${code})`,
        meta: { tableId, sessionExternalId, action: typeof body.action === "string" ? body.action : undefined },
      };
    }
  }

  return {
    ok: true,
    meta: { tableId, sessionExternalId, action: typeof body.action === "string" ? body.action : "order" },
  };
}
