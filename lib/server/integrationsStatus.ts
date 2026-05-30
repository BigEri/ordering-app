import { getDotykackaConfig } from "../dotykacka/config";
import { getRestaurantDotykackaRow } from "./restaurantDotykacka";

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
      hint: "Vyberte aktivní restauraci v administraci.",
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
      hint: "Připojte Dotykačku přes OAuth v detailu restaurace (záložka Dotykačka).",
    };
  }
  if (row.disabled === 1) {
    return { syncConfigured: false, hint: "Dotykačka je pro tuto provozovnu vypnutá." };
  }
  if (row.revokedAtIso) {
    return { syncConfigured: false, hint: "Připojení Dotykačky bylo zrušeno — znovu OAuth." };
  }
  if (!row.refreshToken?.trim()) {
    return { syncConfigured: false, hint: "Chybí refresh token — dokončete OAuth v detailu restaurace." };
  }
  if (!row.branchId || row.branchId <= 0) {
    return {
      syncConfigured: false,
      hint: "Vyberte ID pobočky (branch) v detailu restaurace.",
    };
  }

  return {
    syncConfigured: false,
    hint: "Doplňte mapu produktů v detailu restaurace (nebo DOTYKACKA_PRODUCT_MAP_JSON v .env).",
  };
}

export type IntegrationsStatusPayload = {
  ok: true;
  ts: string;
  sentry: { configured: boolean };
  pos: { configured: boolean };
  dotykacka: DotykackaIntegrationStatus;
};

export async function buildIntegrationsStatus(
  restaurantId: string | null | undefined,
): Promise<IntegrationsStatusPayload> {
  const dotykacka = await getDotykackaIntegrationStatus(restaurantId);
  return {
    ok: true,
    ts: new Date().toISOString(),
    sentry: { configured: isSentryConfigured() },
    pos: { configured: isPosNotificationConfigured() },
    dotykacka,
  };
}
