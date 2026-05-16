import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

/** Klíč sekce pro ukládání pořadí jídel (shodný server/klient). */
export function menuSectionCategoryKey(sec: DotykackaMenuSection): string {
  if (sec.labelKey === "other") return "other";
  if (sec.labelKey === "all") return "all";
  if (sec.categoryId != null) return String(sec.categoryId);
  return "null";
}
