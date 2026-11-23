import { fetchWithRetry } from "../dotykacka/fetchRetry";
import { getStoryousAccessToken } from "./accessToken";
import type { StoryousAppCredentials } from "./env";
import { storyousSourceId } from "./env";
import {
  countMenuItems,
  parseDesks,
  parseMerchantPlaces,
  type StoryousDesk,
  type StoryousPlace,
} from "./parse";

async function storyousGet(creds: StoryousAppCredentials, path: string): Promise<unknown> {
  const token = await getStoryousAccessToken(creds);
  const url = `${creds.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Storyous ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Storyous ${path}: neplatné JSON.`);
  }
}

export async function fetchStoryousMerchantPlaces(
  creds: StoryousAppCredentials,
  merchantId: string,
): Promise<{ merchantName: string; places: StoryousPlace[] }> {
  const json = await storyousGet(creds, `/merchants/${encodeURIComponent(merchantId.trim())}`);
  return parseMerchantPlaces(json);
}

export type StoryousPlacePreview = {
  merchantName: string;
  placeName: string;
  placeState: string | null;
  desks: StoryousDesk[];
  menuItemCount: number;
};

export async function fetchStoryousPlacePreview(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
): Promise<StoryousPlacePreview> {
  const mid = merchantId.trim();
  const pid = placeId.trim();
  const { merchantName, places } = await fetchStoryousMerchantPlaces(creds, mid);
  const place = places.find((p) => p.placeId === pid);
  if (!place) {
    throw new Error("Provozovna (Place ID) u tohoto merchantu neexistuje.");
  }
  const sourceId = storyousSourceId(mid, pid);
  const [deskView, deskList, menu] = await Promise.all([
    storyousGet(creds, `/deskViews/${encodeURIComponent(sourceId)}`),
    storyousGet(creds, `/deskViews/${encodeURIComponent(sourceId)}/desks`),
    storyousGet(creds, `/menu/${encodeURIComponent(mid)}?placeId=${encodeURIComponent(pid)}`),
  ]);
  const desksMap = new Map<string, StoryousDesk>();
  for (const d of [...parseDesks(deskList), ...parseDesks(deskView)]) {
    desksMap.set(d.deskId, d);
  }
  const desks = [...desksMap.values()].sort(
    (a, b) => a.code.localeCompare(b.code, "cs", { numeric: true }) || a.name.localeCompare(b.name, "cs"),
  );
  return {
    merchantName,
    placeName: place.name,
    placeState: place.state,
    desks,
    menuItemCount: countMenuItems(menu),
  };
}

export async function fetchStoryousMenuTree(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
): Promise<unknown> {
  const mid = merchantId.trim();
  const pid = placeId.trim();
  return storyousGet(creds, `/menu/${encodeURIComponent(mid)}?placeId=${encodeURIComponent(pid)}`);
}

async function storyousGetOptional(creds: StoryousAppCredentials, path: string): Promise<unknown | null> {
  try {
    return await storyousGet(creds, path);
  } catch {
    return null;
  }
}

export async function fetchStoryousTimeBasedMenu(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
): Promise<unknown | null> {
  const mid = merchantId.trim();
  const pid = placeId.trim();
  return storyousGetOptional(creds, `/menu/${encodeURIComponent(mid)}/timeBased/${encodeURIComponent(pid)}`);
}

export async function fetchStoryousRemainingAmounts(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
): Promise<unknown | null> {
  const mid = merchantId.trim();
  const pid = placeId.trim();
  return storyousGetOptional(
    creds,
    `/menu/${encodeURIComponent(mid)}/timeBased/${encodeURIComponent(pid)}/remainingAmounts`,
  );
}

export async function fetchStoryousDeliveryOrderStatus(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
  orderId: string,
): Promise<{ orderId: string; externalId: string; state: string } | null> {
  const sourceId = storyousSourceId(merchantId, placeId);
  const json = await storyousGet(
    creds,
    `/delivery/orders/${encodeURIComponent(sourceId)}/${encodeURIComponent(orderId.trim())}`,
  );
  const rec = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
  const state = typeof rec?.state === "string" ? rec.state.trim() : "";
  if (!state) return null;
  return {
    orderId: typeof rec?.orderId === "string" ? rec.orderId : orderId,
    externalId: typeof rec?.externalId === "string" ? rec.externalId : "",
    state,
  };
}

const BILLS_PAGE_LIMIT = 100;
const BILLS_MAX_PAGES = 5;

/**
 * Zaplacené účty od `fromIso`. Storyous řadí vzestupně podle billId, takže nejnovější
 * účty jsou na konci — bez stránkování by se v rušném provozu nenašly.
 * Vrací `{ data: [...] }` se všemi načtenými řádky, nebo null při chybě.
 */
export async function fetchStoryousBills(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
  fromIso: string,
): Promise<unknown | null> {
  const sourceId = storyousSourceId(merchantId, placeId);
  const rows: unknown[] = [];
  let lastBillId = "";
  for (let page = 0; page < BILLS_MAX_PAGES; page += 1) {
    const q = new URLSearchParams({ from: fromIso, limit: String(BILLS_PAGE_LIMIT) });
    if (lastBillId) q.set("lastBillId", lastBillId);
    const json = await storyousGetOptional(creds, `/bills/${encodeURIComponent(sourceId)}?${q.toString()}`);
    if (json == null) return page === 0 ? null : { data: rows };
    const rec = json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : null;
    const data = Array.isArray(rec?.data) ? (rec.data as unknown[]) : [];
    rows.push(...data);
    const last = data[data.length - 1];
    const nextId =
      last && typeof last === "object" && typeof (last as Record<string, unknown>).billId === "string"
        ? ((last as Record<string, unknown>).billId as string)
        : "";
    if (!rec?.nextPage || data.length < BILLS_PAGE_LIMIT || !nextId || nextId === lastBillId) break;
    lastBillId = nextId;
  }
  return { data: rows };
}

/**
 * Otevřené účty (payment sessions) na stole. Endpoint není ve veřejné dokumentaci Storyous;
 * chyba se vrací explicitně, aby volající poznal „nečitelné“ od „žádný otevřený účet“.
 */
export async function fetchStoryousDeskChecks(
  creds: StoryousAppCredentials,
  merchantId: string,
  placeId: string,
  deskId: string,
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const sourceId = storyousSourceId(merchantId, placeId);
  const q = new URLSearchParams({ deskId: deskId.trim() });
  try {
    return { ok: true, json: await storyousGet(creds, `/checks/${encodeURIComponent(sourceId)}?${q.toString()}`) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Storyous /checks selhal" };
  }
}

export async function storyousPostJson(
  creds: StoryousAppCredentials,
  path: string,
  body: unknown,
): Promise<{ ok: true; status: number; json: unknown } | { ok: false; status: number; text: string }> {
  const token = await getStoryousAccessToken(creds);
  const url = `${creds.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text };
  }
  if (!text.trim()) return { ok: true, status: res.status, json: null };
  try {
    return { ok: true, status: res.status, json: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: res.status, text: "neplatné JSON" };
  }
}
