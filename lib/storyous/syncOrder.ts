import { type StoryousRestaurantConfig } from "./config";
import { fetchStoryousMenuTree, storyousPostJson } from "./client";
import { findStoryousSignalProductId } from "./mapMenu";
import { storyousSourceId } from "./env";

export type StoryousSyncMeta = {
  action?: string;
  httpStatus?: number;
  deskId?: string;
  orderId?: string;
  externalId?: string;
};

export type StoryousSyncResult =
  | { ok: true; meta: StoryousSyncMeta }
  | { ok: false; error: string; meta: StoryousSyncMeta };

type OrderLineInput = {
  name?: string;
  qty?: number;
  unitPriceCzk?: number;
  menuItemId?: string;
};

const signalProductCache = new Map<string, string | null>();

function rec(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
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

function externalIdFromPayload(payload: Record<string, unknown>, suffix: string): string {
  const cid = payload.clientRequestId;
  if (typeof cid === "string" && cid.trim()) return cid.trim().slice(0, 120);
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : "dev";
  return `tf-${deviceId.slice(0, 24)}-${suffix}-${Date.now()}`;
}

export function buildStoryousDeliveryItems(lines: unknown): { itemId: string; count: number; unitPriceWithVat: number; note?: string }[] {
  if (!Array.isArray(lines)) return [];
  const out: { itemId: string; count: number; unitPriceWithVat: number; note?: string }[] = [];
  for (const row of lines) {
    if (!row || typeof row !== "object") continue;
    const line = row as OrderLineInput;
    const qty = typeof line.qty === "number" && line.qty > 0 ? Math.floor(line.qty) : 0;
    if (qty <= 0) continue;
    const itemId = typeof line.menuItemId === "string" ? line.menuItemId.trim() : "";
    if (!itemId) continue;
    const price = typeof line.unitPriceCzk === "number" && Number.isFinite(line.unitPriceCzk) ? line.unitPriceCzk : 0;
    const note = typeof line.name === "string" && line.name.trim() ? line.name.trim() : undefined;
    out.push({ itemId, count: qty, unitPriceWithVat: price, ...(note ? { note } : {}) });
  }
  return out;
}

function dineInCustomer(tableLabel: string, deskId: string) {
  return {
    name: tableLabel,
    phoneNumber: "+420000000000",
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

async function resolveSignalItemId(cfg: StoryousRestaurantConfig): Promise<string | null> {
  const key = storyousSourceId(cfg.merchantId, cfg.placeId);
  if (signalProductCache.has(key)) return signalProductCache.get(key) ?? null;
  const tree = await fetchStoryousMenuTree(cfg, cfg.merchantId, cfg.placeId);
  const id = findStoryousSignalProductId(tree);
  signalProductCache.set(key, id);
  return id;
}

async function postOrderToTable(
  cfg: StoryousRestaurantConfig,
  input: {
    externalId: string;
    deskId: string;
    tableLabel: string;
    items: { itemId: string; count: number; unitPriceWithVat: number; note?: string }[];
    note: string;
  },
): Promise<StoryousSyncResult> {
  const sourceId = storyousSourceId(cfg.merchantId, cfg.placeId);
  const body = {
    externalId: input.externalId,
    deliveryType: "orderToTable",
    timing: { asSoonAsPossible: true },
    customer: dineInCustomer(input.tableLabel, input.deskId),
    alreadyPaid: false,
    items: input.items,
    note: input.note,
    deskId: input.deskId,
    autoConfirm: true,
  };
  const posted = await storyousPostJson(cfg, `/delivery/orders/${encodeURIComponent(sourceId)}`, body);
  if (!posted.ok) {
    if (posted.status === 409) {
      return { ok: true, meta: { action: "delivery_order_exists", httpStatus: 409, deskId: input.deskId, externalId: input.externalId } };
    }
    const snippet = posted.text.replace(/\s+/g, " ").trim().slice(0, 400);
    return {
      ok: false,
      error: `Storyous objednávka ${posted.status}: ${snippet || "(prázdná odpověď)"}`,
      meta: { action: "delivery_order", httpStatus: posted.status, deskId: input.deskId, externalId: input.externalId },
    };
  }
  const json = posted.json && typeof posted.json === "object" ? (posted.json as Record<string, unknown>) : null;
  const orderId = typeof json?.orderId === "string" ? json.orderId : undefined;
  return {
    ok: true,
    meta: {
      action: "delivery_order",
      httpStatus: posted.status,
      deskId: input.deskId,
      externalId: input.externalId,
      ...(orderId ? { orderId } : {}),
    },
  };
}

export async function syncOrderConfirmedToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
): Promise<StoryousSyncResult> {
  const o = rec(payload);
  if (!o) return { ok: false, error: "Neplatné tělo objednávky", meta: {} };
  const deskId = deskIdFromPayload(o);
  if (!deskId) return { ok: false, error: "Chybí ID stolu (deskId ze Storyous).", meta: {} };
  const items = buildStoryousDeliveryItems(o.lines);
  if (items.length === 0) {
    return { ok: false, error: "Objednávka nemá žádné položky se Storyous productId.", meta: { deskId } };
  }
  const tableLabel = tableLabelFromPayload(o, deskId);
  return postOrderToTable(cfg, {
    externalId: externalIdFromPayload(o, "order"),
    deskId,
    tableLabel,
    items,
    note: `Tableflow · ${tableLabel}`,
  });
}

async function syncSignalToStoryous(
  payload: unknown,
  cfg: StoryousRestaurantConfig,
  kind: "staff" | "bill",
): Promise<StoryousSyncResult> {
  const o = rec(payload);
  if (!o) return { ok: false, error: "Neplatné tělo požadavku", meta: {} };
  const deskId = deskIdFromPayload(o);
  if (!deskId) return { ok: false, error: "Chybí ID stolu (deskId ze Storyous).", meta: {} };
  const signalId = await resolveSignalItemId(cfg);
  if (!signalId) {
    return {
      ok: false,
      error:
        "Ve Storyous chybí 0 Kč variabilní položka pro přivolání obsluhy / žádost o účet. Přidejte ji v pokladně (stejně jako dummy položka 0 %).",
      meta: { deskId, action: `${kind}_missing_signal_item` },
    };
  }
  const tableLabel = tableLabelFromPayload(o, deskId);
  const note =
    kind === "staff"
      ? `Přivolání obsluhy · ${tableLabel}`
      : `Host žádá o účet · ${tableLabel}`;
  return postOrderToTable(cfg, {
    externalId: externalIdFromPayload(o, kind),
    deskId,
    tableLabel,
    items: [{ itemId: signalId, count: 1, unitPriceWithVat: 0, note }],
    note,
  });
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
