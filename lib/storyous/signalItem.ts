import type { StoryousRestaurantConfig } from "./config";
import { fetchStoryousMenuTree } from "./client";
import { findStoryousSignalProductId } from "./mapMenu";
import { storyousSourceId } from "./env";

const signalProductCache = new Map<string, string | null>();

/** 0 Kč položka z menu Storyous pro přivolání obsluhy a žádost o účet. */
export async function resolveStoryousSignalItemId(cfg: StoryousRestaurantConfig): Promise<string | null> {
  const key = storyousSourceId(cfg.merchantId, cfg.placeId);
  if (signalProductCache.has(key)) return signalProductCache.get(key) ?? null;
  const tree = await fetchStoryousMenuTree(cfg, cfg.merchantId, cfg.placeId);
  const id = findStoryousSignalProductId(tree);
  signalProductCache.set(key, id);
  return id;
}
