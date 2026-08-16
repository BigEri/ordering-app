/**
 * Stejné rozhodování jako kiosk (`fetchDotykackaProductsForMenu`), bez volání API.
 * Hodí se na schůzku / dry-run: jídlo vs. sklad vs. pool příloh.
 */

import { pickDotykackaLocalizedName } from "./dotykackaLocalizedName";
import {
  isInternalDotykackaCategoryName,
  productCategoryId,
  resolveProductExcludedCategoryIds,
} from "./menuCategoryFilter";
import {
  collectRecipeGraphFromIngredientRows,
  recordHasInternalHideTag,
  standaloneDotykackaProductHideReason,
  type RecipeGraph,
} from "./menuProductFilter";

export type KioskFilterHideReason =
  | "deleted"
  | "not-displayed"
  | "category-deleted"
  | "category-not-displayed"
  | "category-tag"
  | "category-name"
  | "category-excluded"
  | "internal-tag"
  | "price-entry"
  | "weight-unit"
  | "recipe-ingredient";

export type KioskFilterDecision = {
  id: number | null;
  name: string;
  categoryName: string;
  shown: boolean;
  reason: KioskFilterHideReason | "shown";
};

export type KioskFilterSimulationInput = {
  categories: Record<string, unknown>[];
  products: Record<string, unknown>[];
  ingredientRows: Record<string, unknown>[];
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isDotykackaProductDisplayed(raw: Record<string, unknown>): boolean {
  const d = raw.display;
  if (d === false) return false;
  if (d === 0) return false;
  if (typeof d === "string" && d.trim().toLowerCase() === "false") return false;
  return true;
}

function categoryNameById(categories: Record<string, unknown>[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const row of categories) {
    const id = num(row.id);
    if (id == null) continue;
    m.set(id, pickDotykackaLocalizedName(row) ?? "");
  }
  return m;
}

function excludedCategoryReason(
  row: Record<string, unknown> | undefined,
): Exclude<KioskFilterHideReason, "deleted" | "not-displayed" | "internal-tag" | "price-entry" | "weight-unit" | "recipe-ingredient"> {
  if (!row) return "category-excluded";
  if (row.deleted === true) return "category-deleted";
  if (row.display === false) return "category-not-displayed";
  if (recordHasInternalHideTag(row)) return "category-tag";
  const name = pickDotykackaLocalizedName(row) ?? "";
  if (name && isInternalDotykackaCategoryName(name)) return "category-name";
  return "category-excluded";
}

/**
 * Rozhodne u každého produktu, jestli by skončil jako samostatná položka v kiosku.
 */
export function simulateKioskMenuFilter(input: KioskFilterSimulationInput): KioskFilterDecision[] {
  const graph: RecipeGraph = collectRecipeGraphFromIngredientRows(input.ingredientRows);
  const excludedCategoryIds = resolveProductExcludedCategoryIds(input.categories);
  const catsById = new Map<number, Record<string, unknown>>();
  for (const row of input.categories) {
    const id = num(row.id);
    if (id != null) catsById.set(id, row);
  }
  const catNames = categoryNameById(input.categories);

  const out: KioskFilterDecision[] = [];
  for (const raw of input.products) {
    const id = num(raw.id);
    const name = pickDotykackaLocalizedName(raw) ?? String(raw.name ?? "");
    const catId = productCategoryId(raw);
    const categoryName = catId != null ? (catNames.get(catId) ?? "") : "";

    if (raw.deleted === true) {
      out.push({ id, name, categoryName, shown: false, reason: "deleted" });
      continue;
    }
    if (!isDotykackaProductDisplayed(raw)) {
      out.push({ id, name, categoryName, shown: false, reason: "not-displayed" });
      continue;
    }
    if (catId != null && excludedCategoryIds.has(catId)) {
      out.push({
        id,
        name,
        categoryName,
        shown: false,
        reason: excludedCategoryReason(catsById.get(catId)),
      });
      continue;
    }
    const productReason = standaloneDotykackaProductHideReason(raw, graph);
    if (productReason) {
      out.push({ id, name, categoryName, shown: false, reason: productReason });
      continue;
    }
    out.push({ id, name, categoryName, shown: true, reason: "shown" });
  }
  return out;
}

export function formatKioskFilterSimulationReport(decisions: KioskFilterDecision[]): string {
  const shown = decisions.filter((d) => d.shown);
  const hidden = decisions.filter((d) => !d.shown);
  const lines: string[] = [
    `Kiosk filtr — ${shown.length} jídel / nápojů viditelných, ${hidden.length} schovaných (sklad, suroviny, přílohy).`,
    "",
    "VIDÍ HOST:",
  ];
  for (const d of shown) {
    lines.push(`  + ${d.name}  [${d.categoryName || "—"}]`);
  }
  lines.push("", "SCHOVÁNO:");
  for (const d of hidden) {
    lines.push(`  − ${d.name}  [${d.categoryName || "—"}]  (${d.reason})`);
  }
  return lines.join("\n");
}
