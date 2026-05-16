import { NextResponse } from "next/server";

import { sessionCookieName, activeRestaurantCookieName } from "../../../../lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName(), "", { path: "/", maxAge: 0 });
  res.cookies.set(activeRestaurantCookieName(), "", { path: "/", maxAge: 0 });
  return res;
}

