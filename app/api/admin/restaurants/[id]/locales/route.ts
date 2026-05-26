import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import {
  listGlobalLocales,
  listRestaurantLocalesWithLabels,
  restaurantHasLocaleConfig,
  setRestaurantLocaleAllowlist,
  updateRestaurantLocalesEnabled,
} from "../../../../../../lib/server/restaurantLocales";

export const dynamic = "force-dynamic";

async function canManageRestaurantLocales(
  session: { userId: string; globalRole: string },
  restaurantId: string,
): Promise<boolean> {
  if (session.globalRole === "SUPER_ADMIN") return true;
  const access = await userHasRestaurantAccess(session.userId, restaurantId);
  return access.ok && access.role === "RESTAURANT_ADMIN";
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    if (!(await canManageRestaurantLocales(session, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // SUPER_ADMIN vidí všechny globální enabled locale (a může je povolit pro restauraci).
    // RESTAURANT_ADMIN vidí jen povolené locale pro tuto restauraci (a může je jen zapnout/vypnout).
    if (session.globalRole === "SUPER_ADMIN") {
      const global = (await listGlobalLocales()).filter((l) => l.enabled && l.code && l.label);
      const configured = await listRestaurantLocalesWithLabels(restaurantId);
      const configuredMap = new Map(configured.map((l) => [l.code.toLowerCase(), l.enabled]));
      const hasConfig = await restaurantHasLocaleConfig(restaurantId);
      return NextResponse.json({
        ok: true,
        hasConfig,
        locales: global.map((g) => ({
          code: g.code,
          label: g.label,
          enabled: Boolean(configuredMap.get(g.code.toLowerCase()) ?? false),
        })),
      });
    }

    const allowed = await listRestaurantLocalesWithLabels(restaurantId);
    return NextResponse.json({
      ok: true,
      hasConfig: true,
      locales: allowed.map((l) => ({ code: l.code, label: l.label, enabled: l.enabled })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const restaurantId = typeof id === "string" ? id.trim() : "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    if (!(await canManageRestaurantLocales(session, restaurantId))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const enabledLocales = Array.isArray(o.enabledLocales) ? (o.enabledLocales as unknown[]) : [];
    const codes = enabledLocales.map((x) => (typeof x === "string" ? x : "")).filter(Boolean);

    if (session.globalRole === "SUPER_ADMIN") {
      await setRestaurantLocaleAllowlist({ restaurantId, allowedLocales: codes, updatedByUserId: session.userId });
    } else {
      // Vedoucí může jen zapnout/vypnout už povolené jazyky (nesmí přidat nový).
      await updateRestaurantLocalesEnabled({ restaurantId, enabledLocales: codes, updatedByUserId: session.userId });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

