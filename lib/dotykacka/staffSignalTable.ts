/**
 * Oddělený stůl v Dotykačce pro přivolání obsluhy a žádost o platbu.
 * Položky 0 Kč jdou sem, ne na účet stolu hosta.
 */

/** Klíč v `productMap` / `DOTYKACKA_PRODUCT_MAP_JSON`. */
export const DOTYKACKA_SIGNAL_TABLE_MAP_KEY = "oa-signal-table";

export const DOTYKACKA_SIGNAL_TABLE_NAME = "Tableflow obsluha";

export function resolveSignalTableId(productMap: Record<string, number>): number | undefined {
  const fromMap = productMap[DOTYKACKA_SIGNAL_TABLE_MAP_KEY];
  if (typeof fromMap === "number" && Number.isFinite(fromMap)) return fromMap;

  const envRaw = process.env.DOTYKACKA_SIGNAL_TABLE_ID?.trim();
  if (envRaw) {
    const n = Number(envRaw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function buildSignalSessionExternalId(cfg: { cloudId: number; branchId: number }): string {
  return `ordering-app-${cfg.cloudId}-${cfg.branchId}-oa-signals`;
}
