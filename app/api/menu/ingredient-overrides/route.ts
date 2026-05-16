import { NextResponse } from "next/server";

import { readMenuIngredientOverridesForRestaurantLocale } from "../../../../lib/server/menuIngredientOverrides";
import { prisma } from "../../../../lib/server/prisma";
import { resolvePublicMenuApiRestaurantIdAsync } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

/** Veřejné načtení ručních ingrediencí pro aktuální jazyk zobrazení. */
export async function GET(req: Request) {
  const ctx = await resolvePublicMenuApiRestaurantIdAsync(req);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }
  const { restaurantId } = ctx;

  const url = new URL(req.url);
  const localeRaw = url.searchParams.get("locale")?.trim() ?? "cs";

  const localeCandidate = localeRaw.trim().toLowerCase() || "cs";
  const isEnabled = await prisma.appLocale.findFirst({ where: { code: localeCandidate, enabled: 1 }, select: { code: true } });
  const locale = isEnabled?.code ? localeCandidate : "cs";
  const payload = await readMenuIngredientOverridesForRestaurantLocale(restaurantId, locale);
  return NextResponse.json({ ok: true, restaurantId, locale, ...payload });
}
