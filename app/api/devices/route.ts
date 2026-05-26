import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../lib/server/adminGuard";
import {
  activeRestaurantCookieName,
  userHasRestaurantAccess,
} from "../../../lib/server/auth";
import { listDeviceRecordsForRestaurant } from "../../../lib/server/deviceRegistry";
import { cookieValueFromHeader } from "../../../lib/server/httpCookie";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);
    const rid = cookieValueFromHeader(cookieHeader, activeRestaurantCookieName()).trim();
    if (!rid) {
      return NextResponse.json(
        { ok: false, error: "Vyberte aktivní provozovnu (cookie oa_rid)." },
        { status: 400 },
      );
    }
    if (session.globalRole !== "SUPER_ADMIN" && !(await userHasRestaurantAccess(session.userId, rid)).ok) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const devices = await listDeviceRecordsForRestaurant(rid);
    return NextResponse.json(
      { ok: true, devices },
      { headers: { "Cache-Control": "private, no-store, no-cache, must-revalidate" } },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
