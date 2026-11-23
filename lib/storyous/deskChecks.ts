import type { StoryousRestaurantConfig } from "./config";
import { fetchStoryousDeskChecks } from "./client";
import { storyousSourceId } from "./env";
import { parseStoryousOpenChecks, type StoryousOpenCheck } from "./openChecks";
import { resolveStoryousSignalItemId } from "./signalItem";

export type StoryousDeskChecksResult =
  | { ok: true; checks: StoryousOpenCheck[] }
  | { ok: false; error: string };

const cache = new Map<string, { at: number; result: StoryousDeskChecksResult }>();
/** Tablety se ptají každé 2,5–4 s; krátká cache drží zátěž Storyous API při víc tabletech/kartách. */
const DESK_CHECKS_CACHE_MS = 3_000;

function cacheKey(cfg: Pick<StoryousRestaurantConfig, "merchantId" | "placeId">, deskId: string): string {
  return `${storyousSourceId(cfg.merchantId, cfg.placeId)}:${deskId.trim()}`;
}

/** Po zápisu na stůl (objednávka, signál) musí další sync vidět čerstvý stav. */
export function invalidateStoryousDeskChecks(
  cfg: Pick<StoryousRestaurantConfig, "merchantId" | "placeId">,
  deskId: string,
): void {
  cache.delete(cacheKey(cfg, deskId));
}

/**
 * Otevřené účty na stole ze Storyous. `ok: false` = endpoint nedostupný nebo neznámý tvar odpovědi —
 * volající se pak chová jako dřív (bez živého účtu), nic nehádá.
 */
export async function loadStoryousDeskChecks(
  cfg: StoryousRestaurantConfig,
  deskId: string,
  opts: { fresh?: boolean } = {},
): Promise<StoryousDeskChecksResult> {
  const id = deskId.trim();
  if (!id) return { ok: false, error: "Chybí ID stolu ze Storyous." };
  const key = cacheKey(cfg, id);
  if (!opts.fresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < DESK_CHECKS_CACHE_MS) return hit.result;
  }

  const fetched = await fetchStoryousDeskChecks(cfg, cfg.merchantId, cfg.placeId, id);
  let result: StoryousDeskChecksResult;
  if (!fetched.ok) {
    result = { ok: false, error: fetched.error };
  } else {
    const parsed = parseStoryousOpenChecks(fetched.json, {
      deskId: id,
      signalProductId: await resolveStoryousSignalItemId(cfg).catch(() => null),
    });
    result = parsed.readable
      ? { ok: true, checks: parsed.checks }
      : { ok: false, error: "Storyous /checks: neočekávaný tvar odpovědi." };
  }
  cache.set(key, { at: Date.now(), result });
  return result;
}
