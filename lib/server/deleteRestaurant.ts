import { tryDeleteStoredMenuImage } from "./menuImageStorage";
import { prisma } from "./prisma";
import { tryDeleteStoredWelcomeImage } from "./welcomeImageStorage";
import { invalidateWelcomeShowcaseCache } from "./welcomeShowcaseCached";

function parseWelcomeImageUrls(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type DeleteRestaurantResult =
  | { ok: true; deletedId: string; deletedName: string }
  | { ok: false; error: string; status: number };

/** SUPER_ADMIN — smaže provozovnu a související záznamy (cascade). Best-effort úklid uploadů. */
export async function deleteRestaurantBySuperAdmin(restaurantId: string): Promise<DeleteRestaurantResult> {
  const rid = restaurantId.trim();
  if (!rid) return { ok: false, error: "Missing id", status: 400 };

  const envPublic = process.env.PUBLIC_RESTAURANT_ID?.trim();
  if (envPublic && envPublic === rid) {
    return {
      ok: false,
      error:
        "Tuto provozovnu nelze smazat — je nastavená jako PUBLIC_RESTAURANT_ID na serveru. Nejdřív změňte nebo odstraňte tuto proměnnou na Vercelu.",
      status: 409,
    };
  }

  const row = await prisma.restaurant.findUnique({
    where: { id: rid },
    select: { id: true, name: true },
  });
  if (!row) return { ok: false, error: "Not found", status: 404 };

  const [welcome, menuImages] = await Promise.all([
    prisma.restaurantWelcome.findUnique({
      where: { restaurantId: rid },
      select: { imageUrlsJson: true },
    }),
    prisma.menuImage.findMany({
      where: { restaurantId: rid },
      select: { imageUrl: true },
    }),
  ]);

  const welcomeUrls = parseWelcomeImageUrls(welcome?.imageUrlsJson);
  const menuUrls = menuImages.map((m) => m.imageUrl.trim()).filter(Boolean);

  await prisma.restaurant.delete({ where: { id: rid } });

  invalidateWelcomeShowcaseCache(rid);

  for (const url of welcomeUrls) {
    await tryDeleteStoredWelcomeImage(url).catch(() => {});
  }
  for (const url of menuUrls) {
    await tryDeleteStoredMenuImage(url).catch(() => {});
  }

  return { ok: true, deletedId: row.id, deletedName: row.name };
}
