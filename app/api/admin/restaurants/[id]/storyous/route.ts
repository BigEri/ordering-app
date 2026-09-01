import { NextResponse } from "next/server";

import { fetchStoryousPlacePreview } from "../../../../../../lib/storyous/client";
import { getStoryousAppCredentials, storyousEnvMerchantId, storyousEnvPlaceId } from "../../../../../../lib/storyous/env";
import { requireAdminSession, type AdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import { invalidateDotykackaMenuCache } from "../../../../../../lib/dotykacka/menuCache";
import { bumpAllKioskDeviceReloadNoncesForRestaurant } from "../../../../../../lib/server/kioskDeviceBindings";
import {
  getRestaurantStoryousRow,
  markRestaurantStoryousError,
  setRestaurantStoryousDisabled,
  upsertRestaurantStoryousConnection,
} from "../../../../../../lib/server/restaurantStoryous";
import { prisma } from "../../../../../../lib/server/prisma";
import { isPrismaMissingColumnError, isPrismaMissingTableError } from "../../../../../../lib/server/prismaKnownError";

export const dynamic = "force-dynamic";

async function assertRestaurantAccess(session: AdminSession, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok) throw new Error("FORBIDDEN");
}

async function loadRestaurant(id: string) {
  return prisma.restaurant.findUnique({ where: { id }, select: { id: true } });
}

function storyousRouteError(e: unknown): NextResponse {
  if (e instanceof Error && e.message === "UNAUTHORIZED") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (isPrismaMissingTableError(e) || isPrismaMissingColumnError(e)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Na databázi chybí tabulka Storyous. Z PC spusťte migraci: npx prisma migrate deploy (direct URL z Neonu, viz docs/DEPLOY-VERCEL.md).",
      },
      { status: 503 },
    );
  }
  const msg = e instanceof Error && e.message.trim() ? e.message : "Chyba Storyous API.";
  return NextResponse.json({ ok: false, error: msg }, { status: 500 });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);
    const exists = await loadRestaurant(id.trim());
    if (!exists) return NextResponse.json({ ok: false, error: "Neznámá restaurace." }, { status: 404 });

    const creds = getStoryousAppCredentials();
    const row = await getRestaurantStoryousRow(id);
    let preview: {
      deskCount: number;
      desks: { deskId: string; name: string; code: string }[];
      menuItemCount: number;
      placeState: string | null;
    } | null = null;
    if (creds && row && row.disabled !== 1) {
      try {
        const live = await fetchStoryousPlacePreview(creds, row.merchantId, row.placeId);
        preview = {
          deskCount: live.desks.length,
          desks: live.desks,
          menuItemCount: live.menuItemCount,
          placeState: live.placeState,
        };
      } catch {
        preview = null;
      }
    }
    return NextResponse.json({
      ok: true,
      hasAppCredentials: Boolean(creds),
      hasRow: Boolean(row),
      merchantId: row?.merchantId ?? "",
      placeId: row?.placeId ?? "",
      merchantName: row?.merchantName ?? null,
      placeName: row?.placeName ?? null,
      disabled: row?.disabled === 1,
      lastOkAtIso: row?.lastOkAtIso ?? null,
      lastError: row?.lastError ?? null,
      envDefaults: {
        merchantId: storyousEnvMerchantId(),
        placeId: storyousEnvPlaceId(),
      },
      preview,
    });
  } catch (e) {
    return storyousRouteError(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);
    const exists = await loadRestaurant(id.trim());
    if (!exists) return NextResponse.json({ ok: false, error: "Neznámá restaurace." }, { status: 404 });

    const creds = getStoryousAppCredentials();
    if (!creds) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Na serveru chybí STORYOUS_CLIENT_ID a STORYOUS_CLIENT_SECRET (Vercel → Environment Variables, lokálně .env.local).",
        },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const merchantId = typeof o?.merchantId === "string" ? o.merchantId.trim() : "";
    const placeId = typeof o?.placeId === "string" ? o.placeId.trim() : "";
    if (!merchantId || !placeId) {
      return NextResponse.json({ ok: false, error: "Vyplňte Merchant ID i Place ID." }, { status: 400 });
    }

    try {
      const preview = await fetchStoryousPlacePreview(creds, merchantId, placeId);
      const row = await upsertRestaurantStoryousConnection({
        restaurantId: id,
        merchantId,
        placeId,
        merchantName: preview.merchantName,
        placeName: preview.placeName,
        actorUserId: session.userId,
      });
      invalidateDotykackaMenuCache(id);
      await bumpAllKioskDeviceReloadNoncesForRestaurant(id);
      return NextResponse.json({
        ok: true,
        merchantId: row.merchantId,
        placeId: row.placeId,
        merchantName: preview.merchantName,
        placeName: preview.placeName,
        disabled: false,
        lastOkAtIso: row.lastOkAtIso,
        lastError: null,
        preview: {
          deskCount: preview.desks.length,
          desks: preview.desks,
          menuItemCount: preview.menuItemCount,
          placeState: preview.placeState,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ověření Storyous selhalo.";
      try {
        await markRestaurantStoryousError(id, msg);
      } catch {
        /* tabulka může chybět — hlášku stejně vrátíme */
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }
  } catch (e) {
    return storyousRouteError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    if (typeof o?.disabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "disabled musí být boolean." }, { status: 400 });
    }
    const res = await setRestaurantStoryousDisabled({
      restaurantId: id,
      disabled: o.disabled,
      actorUserId: session.userId,
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storyousRouteError(e);
  }
}
