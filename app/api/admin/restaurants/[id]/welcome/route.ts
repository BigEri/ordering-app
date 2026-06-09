import { NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import { parseWelcomeLayoutPreset } from "../../../../../../lib/menu/welcomeLayoutPreset";
import { getRestaurantWelcomeForAdmin, upsertRestaurantWelcome } from "../../../../../../lib/server/restaurantWelcome";
import { invalidateWelcomeShowcaseCache } from "../../../../../../lib/server/welcomeShowcaseCached";
import { prisma } from "../../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

async function assertWelcomeRead(session: AdminSession, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok) throw new Error("FORBIDDEN");
}

async function assertWelcomeWrite(session: AdminSession, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok || a.role !== "RESTAURANT_ADMIN") throw new Error("FORBIDDEN");
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const rid = id?.trim() ?? "";
    if (!rid) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertWelcomeRead(session, rid);
    const exists = await prisma.restaurant.findUnique({ where: { id: rid }, select: { id: true } });
    if (!exists?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    const data = await getRestaurantWelcomeForAdmin(rid);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    const rid = id?.trim() ?? "";
    if (!rid) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertWelcomeWrite(session, rid);

    const exists = await prisma.restaurant.findUnique({ where: { id: rid }, select: { id: true } });
    if (!exists?.id) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

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
    const layoutRaw = typeof o.layoutPreset === "string" ? o.layoutPreset : "";
    const layoutPreset = parseWelcomeLayoutPreset(layoutRaw);
    const urlsRaw = o.imageUrls;
    const imageUrls = Array.isArray(urlsRaw)
      ? urlsRaw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)
      : [];

    const { savedUrls, rejectedUrls } = await upsertRestaurantWelcome({
      restaurantId: rid,
      layoutPreset,
      imageUrls,
      updatedByUserId: session.userId,
    });

    invalidateWelcomeShowcaseCache(rid);
    const data = await getRestaurantWelcomeForAdmin(rid);
    return NextResponse.json({ ok: true, ...data, rejectedUrls, savedCount: savedUrls.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
