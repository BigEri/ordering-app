import { NextResponse, type NextRequest } from "next/server";

import { verifySessionToken } from "./lib/server/sessionToken";

const ADMIN_LOGIN_PATH = "/admin/login";
const SESSION_COOKIE = "oa_session";
const ACTIVE_RESTAURANT_COOKIE = "oa_rid";

function isAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/virtual-pos" ||
    pathname.startsWith("/virtual-pos/")
  );
}

function isAdminApi(pathname: string) {
  return pathname.startsWith("/api/admin/");
}

function isLegacyAdminApi(pathname: string) {
  return (
    pathname === "/api/devices" ||
    pathname.startsWith("/api/devices/bind") ||
    pathname.startsWith("/api/devices/reload") ||
    pathname === "/api/pos/virtual-log" ||
    pathname.startsWith("/api/pos/virtual-log/")
  );
}

/** Jednorázové založení prvního účtu — musí projít bez session cookie (slepý kruh jinak). */
function isBootstrapApi(pathname: string) {
  return pathname === "/api/admin/bootstrap" || pathname === "/api/admin/boots";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isAdminPath(pathname) && !isAdminApi(pathname) && !isLegacyAdminApi(pathname)) {
    return NextResponse.next();
  }

  if (isBootstrapApi(pathname)) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const session = sessionToken ? verifySessionToken(sessionToken) : null;
  if (!session) {
    if (isAdminApi(pathname) || isLegacyAdminApi(pathname)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = ADMIN_LOGIN_PATH;
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    if (sessionToken) {
      res.cookies.delete(SESSION_COOKIE);
    }
    return res;
  }

  // Lightweight guard in Edge runtime: if no active restaurant cookie, push user to /admin
  // (server-side APIs still enforce exact roles & access).
  const rid = req.cookies.get(ACTIVE_RESTAURANT_COOKIE)?.value;
  if (!rid && pathname.startsWith("/admin/") && pathname !== ADMIN_LOGIN_PATH && pathname !== "/admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/virtual-pos",
    "/virtual-pos/:path*",
    "/api/admin/:path*",
    "/api/devices",
    "/api/devices/bind",
    "/api/devices/reload",
    "/api/pos/virtual-log",
    "/api/pos/virtual-log/:path*",
  ],
};

