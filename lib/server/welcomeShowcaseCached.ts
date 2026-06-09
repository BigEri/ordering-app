import { revalidateTag, unstable_cache } from "next/cache";

import type { WelcomeLayoutPreset } from "../menu/welcomeLayoutPreset";
import { getWelcomeShowcaseForPublicAsync } from "./restaurantWelcome";

const DEFAULT_REVALIDATE_SEC = 120;

function cacheRevalidateSec(): number {
  const raw = process.env.WELCOME_SHOWCASE_CACHE_REVALIDATE_SEC;
  if (!raw) return DEFAULT_REVALIDATE_SEC;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_REVALIDATE_SEC;
}

export type WelcomeShowcasePublic = {
  imageUrls: string[];
  layoutPreset: WelcomeLayoutPreset;
};

export function welcomeShowcaseCacheTag(restaurantId: string): string {
  return `welcome-showcase-${restaurantId.trim()}`;
}

export function invalidateWelcomeShowcaseCache(restaurantId: string): void {
  const rid = restaurantId.trim();
  if (!rid) return;
  revalidateTag(welcomeShowcaseCacheTag(rid));
}

/** Úvodní stránka — cache s invalidací z admin welcome editoru. */
export async function getWelcomeShowcaseForPublicCached(
  restaurantId: string | null,
): Promise<WelcomeShowcasePublic> {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) return getWelcomeShowcaseForPublicAsync(null);

  const revalidate = cacheRevalidateSec();
  const run = unstable_cache(
    () => getWelcomeShowcaseForPublicAsync(rid),
    ["welcome-showcase-v1", rid],
    { revalidate, tags: [welcomeShowcaseCacheTag(rid)] },
  );
  return run();
}
