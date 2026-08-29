import { getDotykackaAccessTokenForCloud } from "../dotykacka/accessToken";
import { getDotykackaConfig } from "../dotykacka/config";
import { resolveSignalTableId } from "../dotykacka/staffSignalTable";
import { getRestaurantMenuSource, type RestaurantMenuSource } from "../menu/restaurantMenuSource";
import { fetchStoryousPlacePreview } from "../storyous/client";
import { getStoryousConfig } from "../storyous/config";

export type PosTableOption = { id: string; name: string };

export type PosTablesResult =
  | { ok: true; source: RestaurantMenuSource; tables: PosTableOption[] }
  | { ok: false; error: string; source: RestaurantMenuSource | null };

async function listDotykackaTables(restaurantId: string): Promise<PosTablesResult> {
  const cfg = await getDotykackaConfig(restaurantId);
  if (!cfg) {
    return {
      ok: false,
      source: "dotykacka",
      error: "Dotykačka není pro vaši restauraci nakonfigurovaná (OAuth + pobočka + mapa).",
    };
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
    return { ok: false, source: "dotykacka", error: `Dotykačka tables ${res.status}: ${text.slice(0, 400)}` };
  }
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return { ok: false, source: "dotykacka", error: "Dotykačka tables: neplatné JSON." };
  }
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object" && "data" in json
      ? (json as { data?: unknown }).data
      : [];
  const tables: PosTableOption[] = [];
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const idRaw = rec.id;
      const nameRaw = rec.name;
      const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
      const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
      if (!Number.isFinite(id) || !name) continue;
      tables.push({ id: String(id), name });
    }
  }
  const signalTableId = resolveSignalTableId(cfg.productMap);
  const forPairing =
    signalTableId === undefined ? tables : tables.filter((t) => t.id !== String(signalTableId));
  forPairing.sort((a, b) => a.name.localeCompare(b.name, "cs") || a.id.localeCompare(b.id, "cs", { numeric: true }));
  return { ok: true, source: "dotykacka", tables: forPairing };
}

async function listStoryousTables(restaurantId: string): Promise<PosTablesResult> {
  const cfg = await getStoryousConfig(restaurantId);
  if (!cfg) {
    return {
      ok: false,
      source: "storyous",
      error: "Storyous není pro vaši restauraci napojený — otevřete sekci Storyous a ověřte Merchant / Place.",
    };
  }
  try {
    const preview = await fetchStoryousPlacePreview(cfg, cfg.merchantId, cfg.placeId);
    const tables = preview.desks.map((d) => ({
      id: d.deskId,
      name: d.name || d.code || `Stůl ${d.deskId}`,
    }));
    return { ok: true, source: "storyous", tables };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nepodařilo se načíst stoly ze Storyous.";
    return { ok: false, source: "storyous", error: msg };
  }
}

export async function listPosTablesForRestaurant(restaurantId: string): Promise<PosTablesResult> {
  const rid = restaurantId.trim();
  if (!rid) {
    return { ok: false, source: null, error: "Nejdřív dokončete nastavení v Přehledu administrace." };
  }
  const source = await getRestaurantMenuSource(rid);
  if (source === "storyous") return listStoryousTables(rid);
  if (source === "dotykacka") return listDotykackaTables(rid);
  return {
    ok: false,
    source: null,
    error: "Pro vaši restauraci není připojená pokladna — otevřete sekci Storyous nebo Dotykačka.",
  };
}
