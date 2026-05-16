import type { MenuTextOverridesForLocale } from "../menu/menuTextOverridesTypes";
import { prisma } from "./prisma";

export const MENU_TEXT_MAX_NAME = 500;
export const MENU_TEXT_MAX_DESCRIPTION = 4000;

export type MenuTextOverrideItemPayload = {
  name?: string;
  /** `undefined` = neukládat přepsání popisu; řetězec včetně `""` = uložit. */
  description?: string;
};

export type MenuTextOverrideCategoryPayload = {
  name?: string;
};

export type { MenuTextOverridesForLocale };

export async function listEnabledLocaleCodes(): Promise<string[]> {
  const rows = await prisma.appLocale.findMany({
    where: { enabled: 1 },
    orderBy: [{ createdAtIso: "asc" }, { code: "asc" }],
    select: { code: true },
  });
  return rows.map((r) => (typeof r.code === "string" ? r.code.trim().toLowerCase() : "")).filter(Boolean);
}

export async function isEnabledLocale(v: string): Promise<boolean> {
  const code = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (!code) return false;
  const row = await prisma.appLocale.findFirst({ where: { code, enabled: 1 }, select: { code: true } });
  return Boolean(row?.code);
}

export function readMenuTextOverridesForRestaurantLocale(
  restaurantId: string,
  locale: string,
): Promise<MenuTextOverridesForLocale> {
  return (async () => {
    const rows = await prisma.menuTextOverride.findMany({
      where: { restaurantId: restaurantId.trim(), locale: locale.trim().toLowerCase() },
      select: { entityType: true, entityId: true, name: true, description: true },
    });

    const items: Record<string, { name?: string; description?: string }> = {};
    const categories: Record<string, { name?: string }> = {};

    for (const r of rows) {
      if (r.entityType === "item") {
        const o: { name?: string; description?: string } = {};
        if (r.name != null && r.name !== "") o.name = r.name;
        if (r.description !== null) o.description = r.description;
        if (Object.keys(o).length > 0) items[r.entityId] = o;
      } else if (r.entityType === "category") {
        if (r.name != null && r.name !== "") categories[r.entityId] = { name: r.name };
      }
    }

    return { items, categories };
  })();
}

export async function readAllMenuTextOverridesForRestaurant(
  restaurantId: string,
): Promise<Record<string, MenuTextOverridesForLocale>> {
  const enabled = await listEnabledLocaleCodes();
  const out: Record<string, MenuTextOverridesForLocale> = {};
  for (const code of enabled) out[code] = { items: {}, categories: {} };
  if (!out.cs) out.cs = { items: {}, categories: {} };
  const enabledSet = new Set(Object.keys(out));

  const rows = await prisma.menuTextOverride.findMany({
    where: { restaurantId: restaurantId.trim() },
    select: { locale: true, entityType: true, entityId: true, name: true, description: true },
  });

  for (const r of rows) {
    const lc = typeof r.locale === "string" ? r.locale.trim().toLowerCase() : "";
    if (!lc || !enabledSet.has(lc)) continue;
    const bucket = out[lc]!;
    if (r.entityType === "item") {
      const o: { name?: string; description?: string } = {};
      if (r.name != null && r.name !== "") o.name = r.name;
      if (r.description !== null) o.description = r.description;
      if (Object.keys(o).length > 0) bucket.items[r.entityId] = o;
    } else if (r.entityType === "category") {
      if (r.name != null && r.name !== "") bucket.categories[r.entityId] = { name: r.name };
    }
  }

  return out;
}

/**
 * Nahradí všechny řádky pro danou restauraci a jazyk podle map z payloadu.
 */
export function replaceMenuTextOverridesForLocale(
  restaurantId: string,
  locale: string,
  items: Record<string, MenuTextOverrideItemPayload>,
  categories: Record<string, MenuTextOverrideCategoryPayload>,
  updatedByUserId: string | null,
  updatedAtIso: string,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    const rid = restaurantId.trim();
    const loc = locale.trim().toLowerCase();
    await tx.menuTextOverride.deleteMany({ where: { restaurantId: rid, locale: loc } });

    const rows: Array<{
      entityType: string;
      entityId: string;
      name: string | null;
      description: string | null;
    }> = [];

    for (const [entityId, v] of Object.entries(items)) {
      const id = entityId.trim();
      if (!id) continue;
      if (!v || typeof v !== "object") continue;
      const o = v as MenuTextOverrideItemPayload;
      const name =
        typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, MENU_TEXT_MAX_NAME) : null;
      const hasDescKey = "description" in o;
      const descColumn = hasDescKey
        ? typeof o.description === "string"
          ? o.description.slice(0, MENU_TEXT_MAX_DESCRIPTION)
          : null
        : null;
      if (name == null && !hasDescKey) continue;
      rows.push({
        entityType: "item",
        entityId: id,
        name,
        description: hasDescKey ? descColumn : null,
      });
    }

    for (const [entityId, v] of Object.entries(categories)) {
      const id = entityId.trim();
      if (!id) continue;
      const name =
        typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, MENU_TEXT_MAX_NAME) : null;
      if (name == null) continue;
      rows.push({ entityType: "category", entityId: id, name, description: null });
    }

    if (rows.length === 0) return;
    await tx.menuTextOverride.createMany({
      data: rows.map((r) => ({
        restaurantId: rid,
        locale: loc,
        entityType: r.entityType,
        entityId: r.entityId,
        name: r.name,
        description: r.description,
        updatedAtIso: updatedAtIso,
        updatedByUserId,
      })),
    });
  });
}
