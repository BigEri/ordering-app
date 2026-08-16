/**
 * Samostatné položky v kiosku = jídla a pití.
 * Suroviny z receptur, vážené skladové položky a interní štítky se hostům neukážou
 * (v customizacích u jídla a v pokladně zůstanou).
 */

const REQUIRES_PRICE_ENTRY_FLAG = 1 << 2;

/** Štítek v Dotyce, který položku / kategorii vždy schová z kiosku. */
const HIDE_TAGS = [
  "sklad",
  "warehouse",
  "internal",
  "interni",
  "surovina",
  "suroviny",
  "ingredient",
  "ingredience",
] as const;

/** Únikový štítek: i surovinu nebo váženou položku na kiosku ukázat. */
const FORCE_SHOW_TAGS = ["kiosk", "tableflow", "public"] as const;

const WAREHOUSE_WEIGHT_UNITS = new Set([
  "kilogram",
  "kg",
  "gram",
  "g",
  "decagram",
  "dkg",
  "dag",
  "ton",
  "tonne",
  "milligram",
  "mg",
]);

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function foldDotykackaText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tagsFromRecord(row: Record<string, unknown>): string[] {
  const raw = row.tags;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t === "string" && t.trim()) out.push(foldDotykackaText(t));
  }
  return out;
}

function hasAnyTag(row: Record<string, unknown>, needles: readonly string[]): boolean {
  const tags = tagsFromRecord(row);
  if (tags.length === 0) return false;
  const want = new Set(needles.map((n) => foldDotykackaText(n)));
  return tags.some((t) => want.has(t));
}

export function recordHasInternalHideTag(row: Record<string, unknown>): boolean {
  return hasAnyTag(row, HIDE_TAGS);
}

export function recordHasGuestForceShowTag(row: Record<string, unknown>): boolean {
  return hasAnyTag(row, FORCE_SHOW_TAGS);
}

function requiresPriceEntry(raw: Record<string, unknown>): boolean {
  if (raw.requiresPriceEntry === true) return true;
  const flags = num(raw.flags);
  if (flags == null) return false;
  return (flags & REQUIRES_PRICE_ENTRY_FLAG) !== 0;
}

function unitIsWarehouseWeight(unit: unknown): boolean {
  if (typeof unit !== "string" || !unit.trim()) return false;
  return WAREHOUSE_WEIGHT_UNITS.has(foldDotykackaText(unit));
}

function productHasCustomizations(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.customizations) && raw.customizations.length > 0;
}

export type RecipeGraph = {
  ingredientProductIds: Set<number>;
  recipeParentProductIds: Set<number>;
};

export function emptyRecipeGraph(): RecipeGraph {
  return {
    ingredientProductIds: new Set(),
    recipeParentProductIds: new Set(),
  };
}

/** Z `product-ingredients`: dítě = surovina, rodič = jídlo / polotovar s recepturou. */
export function collectRecipeGraphFromIngredientRows(rows: Record<string, unknown>[]): RecipeGraph {
  const graph = emptyRecipeGraph();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    if (row.deleted === true) continue;
    const child = num(row._productId);
    const parent = num(row._parentProductId);
    if (child != null) graph.ingredientProductIds.add(child);
    if (parent != null) graph.recipeParentProductIds.add(parent);
  }
  return graph;
}

function isRawWarehouseIngredient(raw: Record<string, unknown>, graph: RecipeGraph): boolean {
  const id = num(raw.id);
  if (id == null) return false;
  if (!graph.ingredientProductIds.has(id)) return false;
  if (graph.recipeParentProductIds.has(id)) return false;
  if (productHasCustomizations(raw)) return false;
  return true;
}

export type StandaloneProductHideReason =
  | "internal-tag"
  | "price-entry"
  | "weight-unit"
  | "recipe-ingredient";

/**
 * Proč schovat z nabídky pro hosty (ne z customizací). `null` = nechat.
 * Štítek kiosk/tableflow/public má přednost. `display` / smazané řeší volající.
 */
export function standaloneDotykackaProductHideReason(
  raw: Record<string, unknown>,
  graph: RecipeGraph,
): StandaloneProductHideReason | null {
  if (recordHasGuestForceShowTag(raw)) return null;
  if (recordHasInternalHideTag(raw)) return "internal-tag";
  if (requiresPriceEntry(raw)) return "price-entry";
  if (unitIsWarehouseWeight(raw.unit)) return "weight-unit";
  if (isRawWarehouseIngredient(raw, graph)) return "recipe-ingredient";
  return null;
}

/**
 * Schovat z nabídky pro hosty (ne z customizací). `display` / smazané řeší volající.
 */
export function shouldHideStandaloneDotykackaProduct(
  raw: Record<string, unknown>,
  graph: RecipeGraph,
): boolean {
  return standaloneDotykackaProductHideReason(raw, graph) != null;
}
