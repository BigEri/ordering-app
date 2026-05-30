import type { MenuCartLine } from "../../components/MenuCartProvider";
import type { MenuItemData } from "../../components/MenuItem";
import { dotykackaExtraUnitPriceCzk } from "./dotykackaLine";
import type { Locale } from "../i18n/messages";
import { localizeIngredientNamesForDisplay, localizeMenuItem } from "./menuEnPatches";

export function countAddonSelections(selectedAddonIds: string[], addonId: string): number {
  return selectedAddonIds.filter((id) => id === addonId).length;
}

function addonLineLabel(a: { label: string; portionNote?: string }) {
  return a.portionNote ? `${a.label} · ${a.portionNote}` : a.label;
}

/** Řádky do košíku / souhrnu (bez úvodního „+ „). */
export function cartAddonSummaryParts(item: MenuItemData, selectedAddonIds: string[]): string[] {
  const parts: string[] = [];
  for (const a of item.addons ?? []) {
    const n = countAddonSelections(selectedAddonIds, a.id);
    if (n <= 0) continue;
    if (n === 1) parts.push(addonLineLabel(a));
    else parts.push(`${n}× ${a.label}${a.portionNote ? ` · ${a.portionNote}` : ""}`);
  }
  return parts;
}

/** Segmenty typu „+ …“ pro potvrzení objednávky. */
function orderAddonSegments(item: MenuItemData, selectedAddonIds: string[]): string[] {
  return cartAddonSummaryParts(item, selectedAddonIds).map((p) => `+ ${p}`);
}

export function sideOptionLine(item: MenuItemData, sideId: string | undefined): string | null {
  if (!item.sideChoice || !sideId) return null;
  const o = item.sideChoice.options.find((x) => x.id === sideId);
  if (!o) return null;
  return o.portionNote ? `${o.label} · ${o.portionNote}` : o.label;
}

export function resolveMultiPicks(
  item: MenuItemData,
  arg?: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of item.multiPickGroups ?? []) {
    const raw = arg?.[g.id];
    out[g.id] = raw?.length ? [...raw].sort() : [g.options[0]!.id];
  }
  return out;
}

export function resolveSavoryGlazeId(item: MenuItemData, arg?: string): string | undefined {
  const grp = item.savoryGlazeChoice;
  if (!grp?.options.length) return undefined;
  if (arg && grp.options.some((o) => o.id === arg)) return arg;
  return grp.options[0]!.id;
}

export function customizeSummaryLines(
  item: MenuItemData,
  picks: Record<string, string[]>,
  savoryGlazeId: string | undefined,
): string[] {
  const lines: string[] = [];
  for (const g of item.multiPickGroups ?? []) {
    const labels = [...(picks[g.id] ?? [])]
      .sort()
      .map((id) => g.options.find((o) => o.id === id)?.label)
      .filter(Boolean) as string[];
    if (labels.length) lines.push(`${g.sectionLabel}: ${labels.join(", ")}`);
  }
  if (item.savoryGlazeChoice && savoryGlazeId) {
    const o = item.savoryGlazeChoice.options.find((x) => x.id === savoryGlazeId);
    if (o) lines.push(`${item.savoryGlazeChoice.sectionLabel}: ${o.label}`);
  }
  return lines;
}

export type OrderLineSnapshotInput = {
  item: MenuItemData;
  excludedIngredients: string[];
  selectedAddonIds: string[];
  selectedSideId?: string;
  multiPickByGroupId?: Record<string, string[]>;
  savoryGlazeId?: string;
  dotykackaPicks?: Record<string, string[]>;
};

export function menuCartLineToSnapshot(l: MenuCartLine): OrderLineSnapshotInput {
  return {
    item: l.item,
    excludedIngredients: l.excludedIngredients,
    selectedAddonIds: l.selectedAddonIds,
    selectedSideId: l.selectedSideId,
    multiPickByGroupId: l.multiPickByGroupId,
    savoryGlazeId: l.savoryGlazeId,
    dotykackaPicks: l.dotykackaPicks,
  };
}

function normalizeKnownLocale(raw: string): Locale {
  const lc = raw.trim().toLowerCase();
  if (lc === "en" || lc === "ko" || lc === "cs") return lc;
  return "cs";
}

export function buildOrderLineName(l: OrderLineSnapshotInput, textLocale: string): string {
  const locale = normalizeKnownLocale(textLocale);
  const item = l.item;
  const disp = localizeMenuItem(item, locale);
  const addonLabels = orderAddonSegments(disp, l.selectedAddonIds);
  const sideLine = sideOptionLine(disp, l.selectedSideId);
  const picks = l.multiPickByGroupId ?? resolveMultiPicks(item, undefined);
  const sg = l.savoryGlazeId ?? resolveSavoryGlazeId(item, undefined);
  const customLines = customizeSummaryLines(disp, picks, sg);
  const parts = [disp.name];
  const excluded =
    locale !== "cs"
      ? localizeIngredientNamesForDisplay(item, l.excludedIngredients, locale)
      : l.excludedIngredients;
  const withoutWord =
    locale === "en" ? "without" : locale === "ko" ? "제외" : "bez";
  const sideFallback =
    locale === "en" ? "side" : locale === "ko" ? "사이드" : "příloha";
  if (excluded.length > 0) {
    parts.push(`(${withoutWord}: ${excluded.join(", ")})`);
  }
  if (sideLine) {
    const sideTag = disp.sideChoice?.summaryLabel?.toLowerCase() ?? sideFallback;
    parts.push(`(${sideTag}: ${sideLine})`);
  }
  if (addonLabels.length > 0) parts.push(`(${addonLabels.join(", ")})`);
  if (customLines.length > 0) parts.push(`(${customLines.join(" | ")})`);

  const dk = l.item.dotykackaCustomizationGroups;
  const dp = l.dotykackaPicks;
  if (dk?.length && dp) {
    const segs: string[] = [];
    for (const g of dk) {
      const ids = dp[g.id] ?? [];
      const labels = [...ids]
        .sort()
        .map((id) => g.options.find((o) => o.id === id)?.label)
        .filter(Boolean) as string[];
      if (labels.length) segs.push(`${g.sectionLabel}: ${labels.join(", ")}`);
    }
    if (segs.length) parts.push(`(${segs.join(" | ")})`);
  }

  return parts.join(" ");
}

/** Jednotková cena včetně příplatků za úpravy Dotykačky. */
export function orderLineUnitPriceCzk(l: OrderLineSnapshotInput): number {
  const base = l.item.priceCzk;
  return base + dotykackaExtraUnitPriceCzk(l.item, l.dotykackaPicks);
}
