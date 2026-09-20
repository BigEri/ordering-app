import { getDotykackaConfig } from "../dotykacka/config";
import { getRestaurantPos } from "../menu/restaurantMenuSource";
import { getRestaurantDotykackaRow } from "./restaurantDotykacka";
import { getRestaurantStoryousRow } from "./restaurantStoryous";

export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());
}

export function isPosNotificationConfigured(): boolean {
  return Boolean(process.env.POS_NOTIFICATION_URL?.trim());
}

export type DotykackaIntegrationStatus = {
  syncConfigured: boolean;
  hint: string | null;
};

/** Stav synchronizace objednávek do Dotykačky pro danou provozovnu. */
export async function getDotykackaIntegrationStatus(
  restaurantId: string | null | undefined,
): Promise<DotykackaIntegrationStatus> {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) {
    return {
      syncConfigured: false,
      hint: "Nejdřív dokončete nastavení v Přehledu administrace.",
    };
  }

  const cfg = await getDotykackaConfig(rid);
  if (cfg) {
    return { syncConfigured: true, hint: null };
  }

  const row = await getRestaurantDotykackaRow(rid);
  if (!row) {
    return {
      syncConfigured: false,
      hint: "Připojte Dotykačku přes OAuth v administraci (sekce Dotykačka).",
    };
  }
  if (row.disabled === 1) {
    return { syncConfigured: false, hint: "Dotykačka je pro vaši restauraci vypnutá." };
  }
  if (row.revokedAtIso) {
    return { syncConfigured: false, hint: "Připojení Dotykačky bylo zrušeno — znovu OAuth." };
  }
  if (!row.refreshToken?.trim()) {
    return { syncConfigured: false, hint: "Chybí refresh token — dokončete OAuth v administraci." };
  }
  if (!row.branchId || row.branchId <= 0) {
    return {
      syncConfigured: false,
      hint: "Vyberte ID pobočky (branch) v administraci v sekci Dotykačka.",
    };
  }

  return {
    syncConfigured: false,
    hint: "Doplňte mapu produktů v administraci (nebo DOTYKACKA_PRODUCT_MAP_JSON v .env).",
  };
}

export const STORYOUS_CONNECT_HINT =
  "V administraci dokončete napojení Storyous (Merchant ID a Place ID).";

/** Stav napojení Storyous bez databáze — pro testy i API. */
export function storyousIntegrationFromRow(
  restaurantId: string | null | undefined,
  row: { disabled: number; merchantId: string; placeId: string } | null,
): DotykackaIntegrationStatus {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) {
    return {
      syncConfigured: false,
      hint: "Nejdřív dokončete nastavení v Přehledu administrace.",
    };
  }
  if (!row) {
    return { syncConfigured: false, hint: STORYOUS_CONNECT_HINT };
  }
  if (row.disabled === 1) {
    return { syncConfigured: false, hint: "Storyous je pro vaši restauraci odpojený." };
  }
  if (!row.merchantId.trim() || !row.placeId.trim()) {
    return { syncConfigured: false, hint: "Doplňte Merchant ID a Place ID v záložce Storyous." };
  }
  return { syncConfigured: true, hint: null };
}

export async function getStoryousIntegrationStatus(
  restaurantId: string | null | undefined,
): Promise<DotykackaIntegrationStatus> {
  const rid = restaurantId?.trim() ?? "";
  if (!rid) return storyousIntegrationFromRow(rid, null);
  return storyousIntegrationFromRow(rid, await getRestaurantStoryousRow(rid));
}

export type TillIntegrationStatus = DotykackaIntegrationStatus & {
  source: "storyous" | "dotykacka";
};

export async function getTillIntegrationStatus(
  restaurantId: string | null | undefined,
): Promise<TillIntegrationStatus> {
  const pos = (await getRestaurantPos(restaurantId ?? "")) ?? "dotykacka";
  if (pos === "storyous") {
    const storyous = await getStoryousIntegrationStatus(restaurantId);
    return { ...storyous, source: "storyous" };
  }
  const dotykacka = await getDotykackaIntegrationStatus(restaurantId);
  return { ...dotykacka, source: "dotykacka" };
}

export type IntegrationsStatusPayload = {
  ok: true;
  ts: string;
  sentry: { configured: boolean };
  pos: { configured: boolean };
  till: TillIntegrationStatus;
  /** Stejný stav jako `till` — starší klienti čtou jen `dotykacka`. */
  dotykacka: DotykackaIntegrationStatus;
};

export async function buildIntegrationsStatus(
  restaurantId: string | null | undefined,
): Promise<IntegrationsStatusPayload> {
  const till = await getTillIntegrationStatus(restaurantId);
  return {
    ok: true,
    ts: new Date().toISOString(),
    sentry: { configured: isSentryConfigured() },
    pos: { configured: isPosNotificationConfigured() },
    till,
    dotykacka: { syncConfigured: till.syncConfigured, hint: till.hint },
  };
}
