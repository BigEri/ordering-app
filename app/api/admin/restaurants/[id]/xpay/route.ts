import { NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import { prisma } from "../../../../../../lib/server/prisma";
import { isPrismaMissingTableError } from "../../../../../../lib/server/prismaKnownError";
import {
  getRestaurantXpayRow,
  setRestaurantXpayDisabled,
  upsertRestaurantXpaySettings,
} from "../../../../../../lib/server/restaurantXpay";
import { shouldUseEnvXpayFallback } from "../../../../../../lib/xpay/config";
import { parseXpayEnvironment, xpayEnvApiKey } from "../../../../../../lib/xpay/env";

export const dynamic = "force-dynamic";

async function assertRestaurantAccess(session: AdminSession, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok) throw new Error("FORBIDDEN");
}

function routeError(e: unknown): NextResponse {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (isPrismaMissingTableError(e)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Na databázi chybí tabulka XPay. Z PC spusťte migraci: npx prisma migrate deploy.",
      },
      { status: 503 },
    );
  }
  const msg = e instanceof Error && e.message.trim() ? e.message : "Chyba XPay.";
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);
    const exists = await prisma.restaurant.findUnique({ where: { id: id.trim() }, select: { id: true } });
    if (!exists) return NextResponse.json({ ok: false, error: "Neznámá restaurace." }, { status: 404 });
    const row = await getRestaurantXpayRow(id);
    return NextResponse.json({
      ok: true,
      hasRow: Boolean(row),
      hasEnvFallback: Boolean(xpayEnvApiKey()) && shouldUseEnvXpayFallback(id),
      hasApiKey: row?.hasApiKey ?? false,
      environment: row?.environment ?? "sandbox",
      disabled: row?.disabled ?? false,
      lastOkAtIso: row?.lastOkAtIso ?? null,
      lastError: row?.lastError ?? null,
    });
  } catch (e) {
    return routeError(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);

    const body = (await req.json().catch(() => null)) as { apiKey?: unknown; environment?: unknown } | null;
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";
    const environment = parseXpayEnvironment(typeof body?.environment === "string" ? body.environment : "sandbox");
    const row = await upsertRestaurantXpaySettings({
      restaurantId: id.trim(),
      apiKey: apiKey.trim() || null,
      environment,
      actorUserId: session.userId,
    });
    return NextResponse.json({ ok: true, ...row, apiKeySet: row.hasApiKey });
  } catch (e) {
    return routeError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);
    const body = (await req.json().catch(() => null)) as { disabled?: unknown } | null;
    if (typeof body?.disabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "Missing disabled" }, { status: 400 });
    }
    const result = await setRestaurantXpayDisabled({
      restaurantId: id.trim(),
      disabled: body.disabled,
      actorUserId: session.userId,
    });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return routeError(e);
  }
}
