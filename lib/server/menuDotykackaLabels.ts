import { prisma } from "./prisma";

export type DotykackaLabelPayload = {
  groups: Record<string, string>;
  options: Record<string, string>;
};

function cleanLabel(x: unknown, maxLen = 200): string {
  const s = typeof x === "string" ? x.trim() : "";
  if (!s) return "";
  return s.slice(0, maxLen);
}

export async function readDotykackaLabelsForRestaurantLocale(
  restaurantId: string,
  locale: string,
): Promise<DotykackaLabelPayload> {
  const rows = await prisma.menuDotykackaLabel.findMany({
    where: { restaurantId: restaurantId.trim(), locale: locale.trim().toLowerCase() },
    select: { entityType: true, entityId: true, label: true },
  });
  const groups: Record<string, string> = {};
  const options: Record<string, string> = {};
  for (const r of rows) {
    const type = typeof r.entityType === "string" ? r.entityType.trim() : "";
    const id = typeof r.entityId === "string" ? r.entityId.trim() : "";
    const label = cleanLabel(r.label);
    if (!type || !id || !label) continue;
    if (type === "group") groups[id] = label;
    else if (type === "option") options[id] = label;
  }
  return { groups, options };
}

export async function replaceDotykackaLabelsForRestaurantLocale(
  restaurantId: string,
  locale: string,
  payload: DotykackaLabelPayload,
  updatedByUserId: string | null,
  updatedAtIso: string,
): Promise<void> {
  const rid = restaurantId.trim();
  const loc = locale.trim().toLowerCase();
  await prisma.$transaction(async (tx) => {
    await tx.menuDotykackaLabel.deleteMany({ where: { restaurantId: rid, locale: loc } });
    const rows: Array<{ entityType: string; entityId: string; label: string }> = [];
    for (const [id, raw] of Object.entries(payload.groups ?? {})) {
      const entityId = id.trim();
      const label = cleanLabel(raw);
      if (!entityId || !label) continue;
      rows.push({ entityType: "group", entityId, label });
    }
    for (const [id, raw] of Object.entries(payload.options ?? {})) {
      const entityId = id.trim();
      const label = cleanLabel(raw);
      if (!entityId || !label) continue;
      rows.push({ entityType: "option", entityId, label });
    }
    if (rows.length === 0) return;
    await tx.menuDotykackaLabel.createMany({
      data: rows.map((r) => ({
        restaurantId: rid,
        locale: loc,
        entityType: r.entityType,
        entityId: r.entityId,
        label: r.label,
        updatedAtIso,
        updatedByUserId,
      })),
    });
  });
}

