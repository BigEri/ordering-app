import { NextResponse } from "next/server";

import { getPublicRestaurantDisplayNameForRestaurantId } from "../../../../lib/server/publicRestaurantName";
import { resolvePublicMenuRestaurantIdFromRequestUrl } from "../../../../lib/server/publicMenuRestaurantResolve";

export const dynamic = "force-dynamic";

/**
 * Název provozovny podle stejného kontextu jako `/menu` a `menu-context`
 * (kiosk cookie, důvěryhodné `rid`, admin + `oa_rid`, jediná výchozí provozovna).
 */
export async function GET(req: Request) {
  const restaurantId = await resolvePublicMenuRestaurantIdFromRequestUrl(req);
  if (!restaurantId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Chybí kontext provozovny. Otevřete menu z párovaného tabletu, nebo se přihlaste do administrace a zvolte restauraci.",
      },
      { status: 400 },
    );
  }
  const name = await getPublicRestaurantDisplayNameForRestaurantId(restaurantId);
  return NextResponse.json({ ok: true, restaurantId, name });
}
