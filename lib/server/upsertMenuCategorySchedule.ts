import { prisma } from "./prisma";

/**
 * Zápis okna / Pořád bez závislosti na sloupci `alwaysVisible`.
 * Prisma client ten sloupec do INSERT dává vždycky — na DB bez migrace to spadne.
 */
export async function upsertMenuCategoryScheduleRow(input: {
  restaurantId: string;
  categoryKey: string;
  visibleFrom: string;
  visibleUntil: string;
  always: boolean;
  updatedAtIso: string;
  updatedByUserId: string;
}): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "MenuCategorySchedule" ("restaurantId", "categoryKey", "visibleFrom", "visibleUntil", "updatedAtIso", "updatedByUserId")
    VALUES (${input.restaurantId}, ${input.categoryKey}, ${input.visibleFrom}, ${input.visibleUntil}, ${input.updatedAtIso}, ${input.updatedByUserId})
    ON CONFLICT ("restaurantId", "categoryKey") DO UPDATE SET
      "visibleFrom" = EXCLUDED."visibleFrom",
      "visibleUntil" = EXCLUDED."visibleUntil",
      "updatedAtIso" = EXCLUDED."updatedAtIso",
      "updatedByUserId" = EXCLUDED."updatedByUserId"
  `;
  try {
    await prisma.$executeRaw`
      UPDATE "MenuCategorySchedule"
      SET "alwaysVisible" = ${input.always ? 1 : 0}
      WHERE "restaurantId" = ${input.restaurantId} AND "categoryKey" = ${input.categoryKey}
    `;
  } catch {
    /* migrace sloupce ještě neproběhla — stačí sentinel ALWAYS v časech */
  }
}
