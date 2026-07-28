import type { WelcomeLayoutPreset } from "./welcomeLayoutPreset";

/** Kolik různých obrázků musí být vidět najednou (bez duplicit v jednom snímku). */
export function welcomeLayoutVisibleSlotCount(preset: WelcomeLayoutPreset): number {
  switch (preset) {
    case "fade":
      return 1;
    case "split_half":
      return 2;
    case "mosaic":
      return 3;
    case "grid_four":
      return 4;
    default:
      return 3;
  }
}

export function welcomeLayoutPresetLabelCs(preset: WelcomeLayoutPreset): string {
  switch (preset) {
    case "mosaic":
      return "Mozaika";
    case "split_half":
      return "Dvě poloviny";
    case "grid_four":
      return "Čtyři čtvrtiny";
    case "fade":
      return "Jedna plocha";
    default:
      return preset;
  }
}

/** Unikátní URL v pořadí výskytu. */
export function uniqueWelcomeImageUrls(urls: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const u = raw.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export type WelcomeSlotAssignment = {
  /** URL pro každý slot layoutu (prázdný řetězec = prázdný panel, bez duplicity). */
  slots: string[];
  uniqueCount: number;
  requiredCount: number;
  sufficient: boolean;
  /** Skutečně použitý layout (může být zúžený, když chybí fotky). */
  layoutPreset: WelcomeLayoutPreset;
};

/**
 * Přiřadí zdroje pro viditelné sloty — nikdy neopakuje stejnou URL ve dvou slotech najednou.
 * rotateOffset posouvá výběr při rotaci slideshow.
 *
 * Když není dost fotek pro zvolený preset, layout se zúží (fade / split), ať nevznikají
 * černé prázdné panely přes půlku tabletu v kiosku.
 */
export function assignWelcomeShowcaseSlots(
  urls: readonly string[],
  preset: WelcomeLayoutPreset,
  rotateOffset = 0,
): WelcomeSlotAssignment {
  const unique = uniqueWelcomeImageUrls(urls);
  let effectivePreset = preset;
  if (unique.length < welcomeLayoutVisibleSlotCount(preset)) {
    if (unique.length <= 1) effectivePreset = "fade";
    else if (unique.length === 2) effectivePreset = "split_half";
    else if (unique.length === 3 && preset === "grid_four") effectivePreset = "mosaic";
  }

  const requiredCount = welcomeLayoutVisibleSlotCount(effectivePreset);
  const sufficient = unique.length >= welcomeLayoutVisibleSlotCount(preset);
  const slots: string[] = [];

  for (let i = 0; i < requiredCount; i++) {
    if (unique.length === 0) {
      slots.push("");
    } else if (unique.length >= requiredCount) {
      slots.push(unique[(rotateOffset + i) % unique.length]!);
    } else {
      slots.push(unique[i % unique.length]!);
    }
  }

  return { slots, uniqueCount: unique.length, requiredCount, sufficient, layoutPreset: effectivePreset };
}

export function welcomeLayoutInsufficientMessage(
  preset: WelcomeLayoutPreset,
  uniqueCount: number,
): string {
  const need = welcomeLayoutVisibleSlotCount(preset);
  const label = welcomeLayoutPresetLabelCs(preset);
  return `Pro rozložení „${label}“ jsou potřeba minimálně ${need} různé obrázky (máte ${uniqueCount}).`;
}
