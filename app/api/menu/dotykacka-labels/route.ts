import { NextResponse } from "next/server";

import { isEnabledLocale } from "../../../../lib/server/menuTextOverrides";
import { resolvePublicMenuApiRestaurantIdAsync } from "../../../../lib/server/publicMenuRestaurantResolve";
import { readDotykackaLabelsForRestaurantLocale } from "../../../../lib/server/menuDotykackaLabels";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await resolvePublicMenuApiRestaurantIdAsync(req);
  if (!ctx.ok) {
    return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status });
  }
  const { restaurantId } = ctx;

  const url = new URL(req.url);
  const localeRaw = url.searchParams.get("locale")?.trim() ?? "cs";

  const locale = (await isEnabledLocale(localeRaw)) ? localeRaw.trim().toLowerCase() : "cs";
  const payload = await readDotykackaLabelsForRestaurantLocale(restaurantId, locale);
  return NextResponse.json({ ok: true, restaurantId, locale, ...payload });
}

