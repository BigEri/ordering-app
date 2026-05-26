import { NextResponse } from "next/server";

import { requireAdminSession, type AdminSession } from "../../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../../lib/server/auth";
import {
  getRestaurantDotykackaRow,
  setRestaurantDotykackaDisabled,
  updateRestaurantDotykackaSettings,
} from "../../../../../../lib/server/restaurantDotykacka";

export const dynamic = "force-dynamic";

async function assertRestaurantAccess(session: AdminSession, restaurantId: string) {
  if (session.globalRole === "SUPER_ADMIN") return;
  const a = await userHasRestaurantAccess(session.userId, restaurantId);
  if (!a.ok) throw new Error("FORBIDDEN");
}

function parseProductMapJson(raw: string): Record<string, number> | null {
  const t = raw.trim();
  if (!t) return {};
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return null;
      out[k] = n;
    }
    return out;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const { id } = await ctx.params;
    if (!id?.trim()) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    await assertRestaurantAccess(session, id);
    const row = await getRestaurantDotykackaRow(id);
    if (!row) {
      return NextResponse.json({
        ok: true,
        hasRow: false,
        cloudId: null,
        branchId: 0,
        productMapJson: "{}",
        apiBase: "",
        hasRefreshToken: false,
        disabled: false,
        revokedAtIso: null,
        lastOkAtIso: null,
        lastError: null,
      });
    }
    return NextResponse.json({
      ok: true,
      hasRow: true,
      cloudId: row.cloudId,
      branchId: row.branchId,
      productMapJson: row.productMapJson,
      apiBase: row.apiBase ?? "",
      hasRefreshToken: Boolean(row.refreshToken?.trim()),
      disabled: row.disabled === 1,
      revokedAtIso: row.revokedAtIso ?? null,
      lastOkAtIso: row.lastOkAtIso ?? null,
      lastError: row.lastError ?? null,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;

    // Allow toggling integration without deleting secrets.
    if ("disabled" in o) {
      const d = o.disabled;
      if (typeof d !== "boolean") {
        return NextResponse.json({ ok: false, error: "disabled musí být boolean." }, { status: 400 });
      }
      const res = await setRestaurantDotykackaDisabled({
        restaurantId: id,
        disabled: d,
        actorUserId: session.userId,
      });
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const branchRaw = o.branchId;
    const branchId =
      typeof branchRaw === "number"
        ? branchRaw
        : typeof branchRaw === "string"
          ? Number.parseInt(branchRaw, 10)
          : NaN;
    let productMapStr = "";
    if (typeof o.productMapJson === "string") productMapStr = o.productMapJson;
    else if (o.productMapJson && typeof o.productMapJson === "object" && !Array.isArray(o.productMapJson)) {
      productMapStr = JSON.stringify(o.productMapJson);
    } else {
      return NextResponse.json({ ok: false, error: "productMapJson musí být řetězec nebo objekt." }, { status: 400 });
    }
    const parsed = parseProductMapJson(productMapStr);
    if (parsed === null) {
      return NextResponse.json({ ok: false, error: "Neplatný productMapJson (očekává se objekt id→číslo)." }, { status: 400 });
    }
    const apiBaseRaw = o.apiBase;
    const apiBase =
      typeof apiBaseRaw === "string" && apiBaseRaw.trim() ? apiBaseRaw.trim().replace(/\/$/, "") : null;

    const upd = await updateRestaurantDotykackaSettings({
      restaurantId: id,
      branchId,
      productMapJson: JSON.stringify(parsed),
      apiBase,
    });
    if (!upd.ok) {
      return NextResponse.json({ ok: false, error: upd.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
