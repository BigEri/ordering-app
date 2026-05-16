import { NextResponse } from "next/server";

import { getDotykackaAccessTokenForCloud } from "../../../../../lib/dotykacka/accessToken";
import { getDotykackaMenuFetchConfig } from "../../../../../lib/dotykacka/config";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export type DotyBranch = { id: number; name: string; deleted?: boolean };

/**
 * GET ?restaurantId= — seznam poboček v cloudu (GET /v2/clouds/:cloudId/branches).
 * Nečeká uložené branchId v DB — stačí OAuth + cloud (menu fetch config).
 */
export async function GET(req: Request) {
  try {
    const session = requireAdminSession(req.headers.get("cookie"));
    const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
    if (!restaurantId) {
      return NextResponse.json({ ok: false, error: "Chybí restaurantId (query)." }, { status: 400 });
    }
    const restaurantExists = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
    if (!restaurantExists) {
      return NextResponse.json({ ok: false, error: "Neznámá restaurace." }, { status: 404 });
    }
    if (session.globalRole !== "SUPER_ADMIN") {
      const access = await userHasRestaurantAccess(session.userId, restaurantId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const menuCfg = await getDotykackaMenuFetchConfig(restaurantId);
    if (!menuCfg) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dotykačka: chybí refresh token a cloud (OAuth nebo .env pro tuto provozovnu). Nejprve připojte Dotyku.",
        },
        { status: 400 },
      );
    }

    const accessToken = await getDotykackaAccessTokenForCloud(menuCfg);
    const branches: DotyBranch[] = [];
    let page = 1;
    const limit = 200;
    for (;;) {
      const url = `${menuCfg.apiBase}/v2/clouds/${menuCfg.cloudId}/branches?page=${page}&limit=${limit}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `Dotykačka branches ${res.status}: ${text.slice(0, 400)}` },
          { status: 502 },
        );
      }
      let json: unknown = null;
      try {
        json = text ? (JSON.parse(text) as unknown) : null;
      } catch {
        return NextResponse.json({ ok: false, error: "Dotykačka branches: neplatné JSON." }, { status: 502 });
      }
      const rows = Array.isArray(json)
        ? json
        : json && typeof json === "object" && "data" in json
          ? (json as { data?: unknown }).data
          : [];
      if (!Array.isArray(rows)) break;
      for (const r of rows) {
        if (!r || typeof r !== "object") continue;
        const rec = r as Record<string, unknown>;
        const idRaw = rec.id;
        const nameRaw = rec.name;
        const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
        const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
        if (!Number.isFinite(id) || !name) continue;
        const deleted = rec.deleted === true;
        branches.push({ id, name, deleted });
      }
      if (rows.length < limit) break;
      page += 1;
      if (page > 50) break;
    }

    const active = branches.filter((b) => !b.deleted);
    active.sort((a, b) => a.name.localeCompare(b.name, "cs") || a.id - b.id);
    return NextResponse.json({ ok: true, cloudId: menuCfg.cloudId, branches: active });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
