import { NextResponse } from "next/server";

import { requireActiveRestaurantId, requireAdminSession } from "../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { listPosTablesForRestaurant } from "../../../../../lib/pos/listPosTables";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("restaurantId")?.trim() ?? "";
    let restaurantId = fromQuery;
    if (!restaurantId) {
      restaurantId = (await requireActiveRestaurantId(session, req.headers.get("cookie"))) ?? "";
    }
    if (!restaurantId) {
      return NextResponse.json(
        { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
        { status: 400 },
      );
    }
    if (session.globalRole !== "SUPER_ADMIN") {
      const access = await userHasRestaurantAccess(session.userId, restaurantId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await listPosTablesForRestaurant(restaurantId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, source: result.source }, { status: 400 });
    }
    return NextResponse.json({ ok: true, source: result.source, tables: result.tables });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
