import type {
  MenuIngredientOverrideLine,
  MenuIngredientOverridesForLocale,
} from "../menu/menuIngredientOverridesTypes";
import { prisma } from "./prisma";

export const MENU_INGREDIENT_MAX_LABEL = 200;
export const MENU_INGREDIENT_MAX_LINES_PER_ITEM = 120;

function safeJsonParseArray(v: string): unknown[] | null {
  try {
    const j = JSON.parse(v);
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

function normalizeLine(raw: unknown): MenuIngredientOverrideLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sourceName = typeof o.sourceName === "string" ? o.sourceName.trim() : "";
  const label = typeof o.label === "string" ? o.label : "";
  const allowExclude = o.allowExclude === true;
  const hidden = o.hidden === true;
  if (!sourceName) return null;
  const lab = label.trim().slice(0, MENU_INGREDIENT_MAX_LABEL);
  // label může být prázdný — fallback na sourceName v UI
  return {
    sourceName: sourceName.slice(0, MENU_INGREDIENT_MAX_LABEL),
    label: lab,
    allowExclude,
    ...(hidden ? { hidden: true } : {}),
  };
}

export async function readMenuIngredientOverridesForRestaurantLocale(
  restaurantId: string,
  locale: string,
): Promise<MenuIngredientOverridesForLocale> {
  const out: MenuIngredientOverridesForLocale = { items: {} };
  const rows = await prisma.menuIngredientOverride.findMany({
    where: { restaurantId: restaurantId.trim(), locale: locale.trim().toLowerCase() },
    select: { menuItemId: true, ingredientsJson: true },
  });

  for (const r of rows) {
    const itemId = typeof r.menuItemId === "string" ? r.menuItemId.trim() : "";
    if (!itemId) continue;
    const arr = safeJsonParseArray(r.ingredientsJson);
    if (!arr) continue;
    const lines = arr.map(normalizeLine).filter((x): x is NonNullable<typeof x> => x != null);
    if (lines.length > 0) out.items[itemId] = lines.slice(0, MENU_INGREDIENT_MAX_LINES_PER_ITEM);
  }

  return out;
}

export async function readAllMenuIngredientOverridesForRestaurant(
  restaurantId: string,
): Promise<Record<string, MenuIngredientOverridesForLocale>> {
  const enabled = await prisma.appLocale.findMany({
    where: { enabled: 1 },
    orderBy: [{ createdAtIso: "asc" }, { code: "asc" }],
    select: { code: true },
  });
  const out: Record<string, MenuIngredientOverridesForLocale> = {};
  for (const r of enabled) {
    const code = typeof r.code === "string" ? r.code.trim().toLowerCase() : "";
    if (code) out[code] = { items: {} };
  }
  if (!out.cs) out.cs = { items: {} };
  const enabledSet = new Set(Object.keys(out));

  const rows = await prisma.menuIngredientOverride.findMany({
    where: { restaurantId: restaurantId.trim() },
    select: { locale: true, menuItemId: true, ingredientsJson: true },
  });

  for (const r of rows) {
    const lc = typeof r.locale === "string" ? r.locale.trim().toLowerCase() : "";
    if (!lc || !enabledSet.has(lc)) continue;
    const itemId = typeof r.menuItemId === "string" ? r.menuItemId.trim() : "";
    if (!itemId) continue;
    const arr = safeJsonParseArray(r.ingredientsJson);
    if (!arr) continue;
    const lines = arr.map(normalizeLine).filter((x): x is NonNullable<typeof x> => x != null);
    if (lines.length > 0) out[lc]!.items[itemId] = lines.slice(0, MENU_INGREDIENT_MAX_LINES_PER_ITEM);
  }

  return out;
}

export async function replaceMenuIngredientOverridesForLocale(
  restaurantId: string,
  locale: string,
  items: Record<string, MenuIngredientOverrideLine[]>,
  updatedByUserId: string | null,
  updatedAtIso: string,
): Promise<void> {
  const rid = restaurantId.trim();
  const loc = locale.trim().toLowerCase();
  await prisma.$transaction(async (tx) => {
    await tx.menuIngredientOverride.deleteMany({ where: { restaurantId: rid, locale: loc } });
    const rows: Array<{ menuItemId: string; ingredientsJson: string }> = [];
    for (const [menuItemIdRaw, listRaw] of Object.entries(items ?? {})) {
      const menuItemId = menuItemIdRaw.trim();
      if (!menuItemId) continue;
      const arr = Array.isArray(listRaw) ? listRaw : [];
      const norm = arr.map(normalizeLine).filter((x): x is NonNullable<typeof x> => x != null);
      if (norm.length === 0) continue;
      rows.push({
        menuItemId,
        ingredientsJson: JSON.stringify(norm.slice(0, MENU_INGREDIENT_MAX_LINES_PER_ITEM)),
      });
    }
    if (rows.length === 0) return;
    await tx.menuIngredientOverride.createMany({
      data: rows.map((r) => ({
        restaurantId: rid,
        locale: loc,
        menuItemId: r.menuItemId,
        ingredientsJson: r.ingredientsJson,
        updatedAtIso,
        updatedByUserId,
      })),
    });
  });
}

