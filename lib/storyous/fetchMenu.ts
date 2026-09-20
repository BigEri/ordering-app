import { getStoryousConfig } from "./config";
import { getStoryousAppCredentials } from "./env";
import {
  fetchStoryousMenuTree,
  fetchStoryousRemainingAmounts,
  fetchStoryousTimeBasedMenu,
} from "./client";
import { mapStoryousMenuTree } from "./mapMenu";
import { applyStoryousRemainingAmounts, mapStoryousTimeBasedSections } from "./timeBasedMenu";
import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

export async function fetchStoryousProductsForMenu(
  restaurantId: string,
): Promise<{ ok: true; sections: DotykackaMenuSection[] } | { ok: false; error: string }> {
  const cfg = await getStoryousConfig(restaurantId);
  if (!cfg) {
    if (!getStoryousAppCredentials()) {
      return {
        ok: false,
        error: "Na serveru chybí přihlašovací údaje Storyous (STORYOUS_CLIENT_ID / SECRET).",
      };
    }
    return {
      ok: false,
      error:
        "Pro vaši restauraci není připojený Storyous — v administraci otevřete sekci Storyous a ověřte napojení.",
    };
  }
  try {
    const tree = await fetchStoryousMenuTree(cfg, cfg.merchantId, cfg.placeId);
    let sections = mapStoryousMenuTree(tree);
    const [timeBased, remaining] = await Promise.all([
      fetchStoryousTimeBasedMenu(cfg, cfg.merchantId, cfg.placeId),
      fetchStoryousRemainingAmounts(cfg, cfg.merchantId, cfg.placeId),
    ]);
    if (timeBased) {
      const extra = mapStoryousTimeBasedSections(timeBased, tree);
      if (extra.length) sections = [...extra, ...sections];
    }
    if (remaining) sections = applyStoryousRemainingAmounts(sections, remaining);
    return { ok: true, sections };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Nepodařilo se načíst menu ze Storyous.";
    return { ok: false, error: raw };
  }
}
