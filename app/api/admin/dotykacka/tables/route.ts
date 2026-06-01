import { NextResponse } from "next/server";

import { getDotykackaAccessTokenForCloud } from "../../../../../lib/dotykacka/accessToken";
import { getDotykackaConfig } from "../../../../../lib/dotykacka/config";
import { requireActiveRestaurantId, requireAdminSession } from "../../../../../lib/server/adminGuard";

export const dynamic = "force-dynamic";

type DotyTable = { id: number; name: string; enabled?: boolean; display?: boolean; seats?: number };

export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    const rid = await requireActiveRestaurantId(session, req.headers.get("cookie"));
    if (!rid) {
      return NextResponse.json(
        { ok: false, error: "Nejdřív dokončete nastavení v Přehledu administrace." },
        { status: 400 },
      );
    }
    const cfg = await getDotykackaConfig(rid);
    if (!cfg) {
      return NextResponse.json(
        { ok: false, error: "Dotykačka není pro vaši restauraci nakonfigurovaná (OAuth + pobočka + mapa)." },
        { status: 400 },
      );
    }
    const accessToken = await getDotykackaAccessTokenForCloud(cfg);
    const filter = encodeURIComponent(`_branchId|eq|${cfg.branchId}`);
    const url = `${cfg.apiBase}/v2/clouds/${cfg.cloudId}/tables?filter=${filter}&page=1&limit=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Dotykačka tables ${res.status}: ${text.slice(0, 400)}` },
        { status: 502 },
      );
    }
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return NextResponse.json({ ok: false, error: "Dotykačka tables: neplatné JSON." }, { status: 502 });
    }

    const rows = Array.isArray(json) ? json : json && typeof json === "object" && "data" in json ? (json as { data?: unknown }).data : [];
    const tables: DotyTable[] = [];
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (!r || typeof r !== "object") continue;
        const rec = r as Record<string, unknown>;
        const idRaw = rec.id;
        const nameRaw = rec.name;
        const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
        const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
        if (!Number.isFinite(id) || !name) continue;
        tables.push({
          id,
          name,
          enabled: rec.enabled as boolean | undefined,
          display: rec.display as boolean | undefined,
          seats: typeof rec.seats === "number" ? rec.seats : undefined,
        });
      }
    }
    tables.sort((a, b) => a.name.localeCompare(b.name, "cs") || a.id - b.id);
    return NextResponse.json({ ok: true, tables });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
