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
