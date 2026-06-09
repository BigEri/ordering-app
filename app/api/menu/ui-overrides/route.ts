import { NextResponse } from "next/server";

import { readMenuUiBundleForLocaleCached } from "../../../../lib/server/menuOverridesCached";
import { isEnabledLocale } from "../../../../lib/server/menuTextOverrides";
import { resolvePublicMenuApiRestaurantIdAsync } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

/** Veřejné načtení všech textových úprav pro aktuální jazyk (texty + ingredience + Dotyka labels). */
export async function GET(req: Request) {
  const ctx = await resolvePublicMenuApiRestaurantIdAsync(req);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }
  const { restaurantId } = ctx;

  const url = new URL(req.url);
  const localeRaw = url.searchParams.get("locale")?.trim() ?? "cs";

  const locale = (await isEnabledLocale(localeRaw)) ? localeRaw.trim().toLowerCase() : "cs";

  const { text, ingredients, dotykacka } = await readMenuUiBundleForLocaleCached(restaurantId, locale);

  // Pro hosty můžeme krátce cachovat (a SWR), aby to bylo rychlé, ale změny se do pár minut projeví.
  return NextResponse.json(
    { ok: true, restaurantId, locale, text, ingredients, dotykacka },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}

