import { buildBillRequestItemNote } from "../dotykacka/billRequestProduct";
import { BILL_EMPTY_CODE } from "../pos/tillErrorCodes";
import { formatRestaurantLocalHhmm } from "../restaurantLocalTime";
import { getPublicAppBaseUrl } from "../server/publicAppUrl";
import { type StoryousRestaurantConfig } from "./config";
import { storyousPostJson } from "./client";
import { invalidateStoryousDeskChecks, loadStoryousDeskChecks } from "./deskChecks";
import { storyousSourceId } from "./env";
import { pickStoryousTargetCheck } from "./openChecks";
import type { StoryousDeliveryAddition } from "./orderAdditions";
import { resolveStoryousSignalItemId } from "./signalItem";

export type StoryousSyncMeta = {
  action?: string;
  httpStatus?: number;
  deskId?: string;
  orderId?: string;
  externalId?: string;
  deliveryType?: "orderToTable" | "orderToCheck";
  /** Otevřený účet stolu, na který šla objednávka (`orderToCheck`). */
  checkId?: string;
  /** `orderToCheck` selhal a objednávka šla na stůl jako nový účet. */
  checkFallbackError?: string;
  /** `/checks` nešel přečíst — chování jako bez živého účtu. */
  checksUnavailable?: string;
};

export type StoryousSyncResult =
  | { ok: true; meta: StoryousSyncMeta }
  | { ok: false; error: string; meta: StoryousSyncMeta; code?: typeof BILL_EMPTY_CODE };

type OrderLineInput = {
  name?: string;
  qty?: number;
  unitPriceCzk?: number;
  menuItemId?: string;
  storyousAdditions?: StoryousDeliveryAddition[];
};

function rec(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function orderIdFromStoryousDeliveryResponse(json: unknown): string | undefined {
  const root = rec(json);
  if (!root) return undefined;
  if (typeof root.orderId === "string" && root.orderId.trim()) return root.orderId.trim();
  const nested = rec(root.order);
  if (nested && typeof nested.orderId === "string" && nested.orderId.trim()) return nested.orderId.trim();
  return undefined;
}

function deskIdFromPayload(payload: Record<string, unknown>): string {
  const raw = payload.tableId;
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.trunc(raw));
  return "";
}

function tableLabelFromPayload(payload: Record<string, unknown>, deskId: string): string {
  const raw = payload.tableLabel;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return deskId ? `Stůl ${deskId}` : "Stůl";
}

function numField(payload: Record<string, unknown>, key: string): number {
  const v = payload[key];
  return typeof v === "number" ? v : Number(v);
}

/** Poznámka žádosti o účet — spropitné a způsob platby, stejný text jako u Dotykačky. */
export function buildStoryousBillRequestNote(
  payload: Record<string, unknown>,
  tableLabel: string,
  now = new Date(),
): string {
  const paymentMethodRaw = typeof payload.paymentMethod === "string" ? payload.paymentMethod.trim() : "";
  return buildBillRequestItemNote({
    tableLabelOrId: tableLabel,
    paymentMethodRaw,
    ordersTotal: numField(payload, "ordersTotal"),
    tipPct: numField(payload, "tipPct"),
    tipAmount: numField(payload, "tipAmount"),
    billTotal: numField(payload, "billTotal"),
    timeLabel: formatRestaurantLocalHhmm(now),
  });
}

function externalIdFromPayload(payload: Record<string, unknown>, suffix: string): string {
  const cid = payload.clientRequestId;
  if (typeof cid === "string" && cid.trim()) return cid.trim().slice(0, 120);
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "dev";
  return `tf-${deviceId.slice(0, 24)}-${suffix}-${Date.now()}`;
}

export function buildStoryousDeliveryItems(lines: unknown): {
  itemId: string;
  count: number;
  unitPriceWithVat: number;
  note?: string;
  additions?: StoryousDeliveryAddition[];
}[] {
  if (!Array.isArray(lines)) return [];
  const out: {
    itemId: string;
    count: number;
    unitPriceWithVat: number;
    note?: string;
    additions?: StoryousDeliveryAddition[];
  }[] = [];
  for (const row of lines) {
    if (!row || typeof row !== "object") continue;
    const line = row as OrderLineInput;
    const qty = typeof line.qty === "number" && line.qty > 0 ? Math.floor(line.qty) : 0;
    if (qty <= 0) continue;
    const itemId = typeof line.menuItemId === "string" ? line.menuItemId.trim() : "";
    if (!itemId) continue;
    const price = typeof line.unitPriceCzk === "number" && Number.isFinite(line.unitPriceCzk) ? line.unitPriceCzk : 0;
    const note = typeof line.name === "string" && line.name.trim() ? line.name.trim() : undefined;
    const additions = Array.isArray(line.storyousAdditions)
      ? line.storyousAdditions.filter(
          (a) => a && typeof a.additionId === "string" && a.additionId.trim() && a.countPerMainItem > 0,
        )
      : [];
    out.push({
      itemId,
      count: qty,
      unitPriceWithVat: price,
      ...(note ? { note } : {}),
      ...(additions.length ? { additions } : {}),
    });
  }
  return out;
}

function dineInCustomer(tableLabel: string, deskId: string) {
  return {
    name: tableLabel,
    phoneNumber: "+420777123456",
    email: "noreply@tableflow.cz",
    deliveryAddress: tableLabel,
    deliveryAddressParts: {
      street: "Stůl",
      streetNumber: deskId || "1",
      city: "Praha",
      country: "Czech republic",
      countryCode: "CZ",
      zip: "11000",
    },
  };
}

type DeskOrderInput = {
  externalId: string;
  deskId: string;
  tableLabel: string;
  items: ReturnType<typeof buildStoryousDeliveryItems>;
  note: string;
};

type DeskOrderTarget = { deliveryType: "orderToTable" } | { deliveryType: "orderToCheck"; checkId: string };

export function buildStoryousDeliveryOrderBody(
  input: DeskOrderInput,
  target: DeskOrderTarget,
  notifyBase: string,
): Record<string, unknown> {
  return {
    externalId: input.externalId,
    deliveryType: target.deliveryType,
    timing: { asSoonAsPossible: true },
    customer: dineInCustomer(input.tableLabel, input.deskId),
    alreadyPaid: false,
    items: input.items,
    note: input.note,
    // Storyous: `deskId` jen u `orderToTable` — u `orderToCheck` vrací 400.
    ...(target.deliveryType === "orderToCheck" ? { checkId: target.checkId } : { deskId: input.deskId }),
    autoConfirm: true,
    ...(notifyBase
      ? {
          notification: {
            confirm: `${notifyBase}&state=CONFIRMED`,
            dispatch: `${notifyBase}&state=DISPATCHED`,
            decline: `${notifyBase}&state=DECLINED`,
          },
        }
      : {}),
  };
}

async function postDeliveryOrder(
  cfg: StoryousRestaurantConfig,
  input: DeskOrderInput,
  target: DeskOrderTarget,
): Promise<StoryousSyncResult> {
  const sourceId = storyousSourceId(cfg.merchantId, cfg.placeId);
  const publicBase = getPublicAppBaseUrl();
  const notifyBase = publicBase
    ? `${publicBase}/api/integrations/storyous/delivery-notify?externalId=${encodeURIComponent(input.externalId)}`
    : "";
  const body = buildStoryousDeliveryOrderBody(input, target, notifyBase);
  const baseMeta: StoryousSyncMeta = {
    deskId: input.deskId,
    externalId: input.externalId,
    deliveryType: target.deliveryType,
    ...(target.deliveryType === "orderToCheck" ? { checkId: target.checkId } : {}),
  };
  const posted = await storyousPostJson(cfg, `/delivery/orders/${encodeURIComponent(sourceId)}`, body);
  if (!posted.ok) {
    if (posted.status === 409) {
      const orderId = orderIdFromStoryousDeliveryResponse(parseJsonText(posted.text));
      return {
        ok: true,
        meta: { ...baseMeta, action: "delivery_order_exists", httpStatus: 409, ...(orderId ? { orderId } : {}) },
      };
    }
    const snippet = posted.text.replace(/\s+/g, " ").trim().slice(0, 400);
    return {
      ok: false,
      error: `Storyous objednávka ${posted.status}: ${snippet || "(prázdná odpověď)"}`,
      meta: { ...baseMeta, action: "delivery_order", httpStatus: posted.status },
    };
  }
  const orderId = orderIdFromStoryousDeliveryResponse(posted.json);
  return {
    ok: true,
    meta: { ...baseMeta, action: "delivery_order", httpStatus: posted.status, ...(orderId ? { orderId } : {}) },
  };
}

/**
 * Jeden stůl = jeden účet: když má stůl ve Storyous otevřený účet, jde objednávka přes
 * `orderToCheck` přímo do něj. Bez otevřeného účtu (nebo když Storyous `orderToCheck` odmítne)
 * `orderToTable` — stejný `externalId`, takže případný duplicitní zápis vrátí 409.
 */
async function postOrderToDesk(
  cfg: StoryousRestaurantConfig,
  input: DeskOrderInput,
  checks: Awaited<ReturnType<typeof loadStoryousDeskChecks>>,
): Promise<StoryousSyncResult> {
  const target = checks.ok ? pickStoryousTargetCheck(checks.checks) : null;
  const unavailable = checks.ok ? {} : { checksUnavailable: checks.error.slice(0, 300) };
  try {
    if (target) {
      const toCheck = await postDeliveryOrder(cfg, input, { deliveryType: "orderToCheck", checkId: target.checkId });
      if (toCheck.ok) return toCheck;
      const toTable = await postDeliveryOrder(cfg, input, { deliveryType: "orderToTable" });
      return { ...toTable, meta: { ...toTable.meta, checkFallbackError: toCheck.error.slice(0, 300) } };
    }
    const toTable = await postDeliveryOrder(cfg, input, { deliveryType: "orderToTable" });
    return { ...toTable, meta: { ...toTable.meta, ...unavailable } };
  } finally {
    invalidateStoryousDeskChecks(cfg, input.deskId);
  }
}

export async function syncOrderConfirmedToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
): Promise<StoryousSyncResult> {
  const o = rec(payload);
  if (!o) return { ok: false, error: "Neplatné tělo objednávky", meta: {} };
  const deskId = deskIdFromPayload(o);
  if (!deskId) return { ok: false, error: "Chybí ID stolu ze Storyous.", meta: {} };
  const items = buildStoryousDeliveryItems(o.lines);
  if (items.length === 0) {
    return { ok: false, error: "Objednávku se nepodařilo odeslat do Storyous — položky nemají vazbu na pokladnu.", meta: { deskId } };
  }
  const tableLabel = tableLabelFromPayload(o, deskId);
  const checks = await loadStoryousDeskChecks(cfg, deskId, { fresh: true });
  return postOrderToDesk(
    cfg,
    {
      externalId: externalIdFromPayload(o, "order"),
      deskId,
      tableLabel,
      items,
      note: `Tableflow · ${tableLabel}`,
    },
    checks,
  );
}

async function syncSignalToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
  kind: "staff" | "bill",
): Promise<StoryousSyncResult> {
  const o = rec(payload);
  if (!o) return { ok: false, error: "Neplatné tělo požadavku", meta: {} };
  const deskId = deskIdFromPayload(o);
  if (!deskId) return { ok: false, error: "Chybí ID stolu ze Storyous.", meta: {} };

  const checks = await loadStoryousDeskChecks(cfg, deskId, { fresh: true });
  // Stejně jako Dotykačka: žádost o účet jen na otevřený účet. Když `/checks` nejde přečíst,
  // nevíme to jistě — žádost se pošle jako dřív, ať host nezůstane bez obsluhy.
  if (kind === "bill" && checks.ok && checks.checks.length === 0) {
    return {
      ok: false,
      code: BILL_EMPTY_CODE,
      error: "Na stole ve Storyous není otevřený účet — host zatím nemá nic na účtu.",
      meta: { deskId, action: "bill_request_no_open_check" },
    };
  }

  const signalId = await resolveStoryousSignalItemId(cfg);
  if (!signalId) {
    return {
      ok: false,
      error:
        "Ve Storyous chybí položka za 0 Kč pro přivolání obsluhy a žádost o účet. Přidejte v pokladně variabilní položku za 0 Kč.",
      meta: { deskId, action: `${kind}_missing_signal_item` },
    };
  }
  const tableLabel = tableLabelFromPayload(o, deskId);
  const note =
    kind === "staff"
      ? `Přivolání obsluhy · ${tableLabel}`
      : buildStoryousBillRequestNote(o, tableLabel);
  return postOrderToDesk(
    cfg,
    {
      externalId: externalIdFromPayload(o, kind),
      deskId,
      tableLabel,
      items: [{ itemId: signalId, count: 1, unitPriceWithVat: 0, note }],
      note,
    },
    checks,
  );
}

export async function syncStaffCallToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
): Promise<StoryousSyncResult> {
  return syncSignalToStoryous(payload, cfg, "staff");
}

export async function syncBillRequestToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
): Promise<StoryousSyncResult> {
  return syncSignalToStoryous(payload, cfg, "bill");
}
