import { parseWelcomeLayoutPreset, type WelcomeLayoutPreset } from "../menu/welcomeLayoutPreset";
import { uniqueWelcomeImageUrls } from "../menu/welcomeShowcaseSlots";
import { WELCOME_SHOWCASE_IMAGE_URLS } from "../menu/welcomeShowcaseImages";
import { isAllowedWelcomeImageUrl, tryDeleteStoredWelcomeImage } from "./welcomeImageStorage";
import { nowIso } from "./db";
import { prisma } from "./prisma";

export type { WelcomeLayoutPreset };

const MAX_URLS = 6;

function defaultUrls(): string[] {
  const u = [...WELCOME_SHOWCASE_IMAGE_URLS];
  if (u.length >= 3) return u.slice(0, 6);
  while (u.length < 3 && WELCOME_SHOWCASE_IMAGE_URLS.length > 0) {
    u.push(WELCOME_SHOWCASE_IMAGE_URLS[u.length % WELCOME_SHOWCASE_IMAGE_URLS.length]!);
  }
  return u.slice(0, MAX_URLS);
}

function normalizePreset(raw: string | null | undefined): WelcomeLayoutPreset {
  return parseWelcomeLayoutPreset(raw);
}

export function getWelcomeShowcaseForPublic(restaurantId: string | null): {
  imageUrls: string[];
  layoutPreset: WelcomeLayoutPreset;
} {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) {
    return { imageUrls: defaultUrls(), layoutPreset: "mosaic" };
  }
  // NOTE: kept sync signature; Prisma version is async. Prefer `getWelcomeShowcaseForPublicAsync`.
  throw new Error("Use getWelcomeShowcaseForPublicAsync (Prisma refactor)");
}

export async function getWelcomeShowcaseForPublicAsync(
  restaurantId: string | null,
): Promise<{ imageUrls: string[]; layoutPreset: WelcomeLayoutPreset }> {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) return { imageUrls: defaultUrls(), layoutPreset: "mosaic" };
  const row = await prisma.restaurantWelcome.findUnique({
    where: { restaurantId: rid },
    select: { layoutPreset: true, imageUrlsJson: true },
  });
  if (!row) return { imageUrls: defaultUrls(), layoutPreset: "mosaic" };
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(String(row.imageUrlsJson ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      urls = parsed
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x && isAllowedWelcomeImageUrl(x, rid));
    }
  } catch {
    urls = [];
  }
  if (urls.length === 0) urls = defaultUrls();
  return { imageUrls: urls.slice(0, MAX_URLS), layoutPreset: normalizePreset(row.layoutPreset) };
}

export async function getRestaurantWelcomeRow(restaurantId: string): Promise<{
  layoutPreset: WelcomeLayoutPreset;
  imageUrls: string[];
} | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurantWelcome.findUnique({
    where: { restaurantId: rid },
    select: { layoutPreset: true, imageUrlsJson: true },
  });
  if (!row) return null;
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(String(row.imageUrlsJson ?? "[]")) as unknown;
    if (Array.isArray(parsed)) {
      urls = parsed
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .slice(0, MAX_URLS);
    }
  } catch {
    urls = [];
  }
  return {
    layoutPreset: normalizePreset(row.layoutPreset),
    imageUrls: urls,
  };
}

/** Pro admin editor: když v DB řádek není, vrátí stejný obsah jako veřejná stránka (výchozí fotky). */
export async function getRestaurantWelcomeForAdmin(restaurantId: string): Promise<{
  layoutPreset: WelcomeLayoutPreset;
  imageUrls: string[];
  hasCustomRow: boolean;
}> {
  const rid = restaurantId.trim();
  if (!rid) {
    const pub = await getWelcomeShowcaseForPublicAsync(null);
    return { ...pub, hasCustomRow: false };
  }
  const raw = await getRestaurantWelcomeRow(rid);
  if (!raw) {
    const pub = await getWelcomeShowcaseForPublicAsync(rid);
    return { ...pub, hasCustomRow: false };
  }
  return {
    layoutPreset: raw.layoutPreset,
    imageUrls: raw.imageUrls,
    hasCustomRow: true,
  };
}

export async function upsertRestaurantWelcome(opts: {
  restaurantId: string;
  layoutPreset: WelcomeLayoutPreset;
  imageUrls: string[];
  updatedByUserId: string | null;
}): Promise<{ savedUrls: string[]; rejectedUrls: string[] }> {
  const rid = opts.restaurantId.trim();
  if (!rid) return { savedUrls: [], rejectedUrls: [] };
  const rejectedUrls: string[] = [];
  const cleaned: string[] = [];
  for (const u of uniqueWelcomeImageUrls(opts.imageUrls)) {
    if (!isAllowedWelcomeImageUrl(u, rid)) {
      rejectedUrls.push(u);
      continue;
    }
    cleaned.push(u);
    if (cleaned.length >= MAX_URLS) break;
  }
  const prev = await getRestaurantWelcomeRow(rid);
  const removed = (prev?.imageUrls ?? []).filter((u) => !cleaned.includes(u));

  const urlsJson = JSON.stringify(cleaned);
  const preset = parseWelcomeLayoutPreset(opts.layoutPreset);
  const ts = nowIso();
  await prisma.restaurantWelcome.upsert({
    where: { restaurantId: rid },
    update: { layoutPreset: preset, imageUrlsJson: urlsJson, updatedAtIso: ts, updatedByUserId: opts.updatedByUserId },
    create: { restaurantId: rid, layoutPreset: preset, imageUrlsJson: urlsJson, updatedAtIso: ts, updatedByUserId: opts.updatedByUserId },
  });
  for (const url of removed) {
    await tryDeleteStoredWelcomeImage(url);
  }
  return { savedUrls: cleaned, rejectedUrls };
}
