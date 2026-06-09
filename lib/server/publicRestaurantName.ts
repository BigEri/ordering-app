import { cache } from "react";

import { prisma } from "./prisma";

/** Jen `.env` / jediná restaurace — bez URL a cookie (pro admin fallback apod.). */
export async function getDefaultPublicMenuRestaurantId(): Promise<string | null> {
  const envId = process.env.PUBLIC_RESTAURANT_ID?.trim();
  if (envId) {
    const row = await prisma.restaurant.findUnique({ where: { id: envId }, select: { id: true } });
    if (row?.id) return row.id;
  }
  const rows = await prisma.restaurant.findMany({
    orderBy: { createdAtIso: "asc" },
    select: { id: true },
  });
  if (rows.length === 1) return rows[0].id;
  return null;
}

/** Sync helper (env-only) for places that must stay sync. */
export function getDefaultPublicMenuRestaurantIdFromEnv(): string | null {
  const envId = process.env.PUBLIC_RESTAURANT_ID?.trim();
  return envId || null;
}

/** @deprecated Pro veřejné stránky použijte `resolvePublicMenuRestaurantIdSync` — stejné jako výchozí bez cookie. */
export async function getPublicMenuRestaurantId(): Promise<string | null> {
  return await getDefaultPublicMenuRestaurantId();
}

/** Veřejný název — jedna restaurace / PUBLIC_RESTAURANT_ID, jinak obecný text. */
export const getPublicRestaurantDisplayName = cache(async function getPublicRestaurantDisplayName(): Promise<string> {
  const envId = process.env.PUBLIC_RESTAURANT_ID?.trim();
  if (envId) {
    const row = await prisma.restaurant.findUnique({ where: { id: envId }, select: { name: true } });
    const n = row?.name?.trim();
    if (n) return n;
  }
  const rows = await prisma.restaurant.findMany({
    orderBy: { createdAtIso: "asc" },
    select: { name: true },
  });
  if (rows.length === 1) {
    const n = rows[0]?.name?.trim();
    if (n) return n;
  }
  return "Restaurace";
});

/** Název provozovny podle ID (např. po rozlišení menu z cookie). */
export const getPublicRestaurantDisplayNameForRestaurantId = cache(async function getPublicRestaurantDisplayNameForRestaurantId(
  restaurantId: string | null,
): Promise<string> {
  if (!restaurantId?.trim()) return await getPublicRestaurantDisplayName();
  const row = await prisma.restaurant.findUnique({
    where: { id: restaurantId.trim() },
    select: { name: true },
  });
  const n = row?.name?.trim();
  if (n) return n;
  return await getPublicRestaurantDisplayName();
});
