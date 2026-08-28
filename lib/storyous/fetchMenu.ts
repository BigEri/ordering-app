import { getStoryousConfig } from "./config";
import { getStoryousAppCredentials } from "./env";
import { fetchStoryousMenuTree } from "./client";
import { mapStoryousMenuTree } from "./mapMenu";
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
    return { ok: true, sections: mapStoryousMenuTree(tree) };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Nepodařilo se načíst menu ze Storyous.";
    return { ok: false, error: raw };
  }
}
