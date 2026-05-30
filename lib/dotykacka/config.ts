/**
 * Konfigurace Dotykačky (API v2).
 * Priorita: řádek `restaurant_dotykacka` pro dané restaurantId → doplnění z .env při shodě cloudu →
 * jinak proměnné prostředí (.env) jen pro jednu „výchozí“ provozovnu (bez rizika cizího tenanta).
 */

import { getDefaultPublicMenuRestaurantIdFromEnv } from "../server/publicRestaurantName";
import { getRestaurantDotykackaRow } from "../server/restaurantDotykacka";

export type DotykackaConfig = {
  apiBase: string;
  refreshToken: string;
  cloudId: number;
  branchId: number;
  /** mapování ID položky v naší app → product ID v Dotyce */
  productMap: Record<string, number>;
};

function parseJsonRecord(raw: string | undefined): Record<string, number> | null {
  if (!raw?.trim()) return {};
  try {
    const o = JSON.parse(raw) as unknown;
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

function defaultApiBase(): string {
  return (process.env.DOTYKACKA_API_BASE ?? "https://api.dotykacka.cz").replace(/\/$/, "");
}

function configFromEnv(): DotykackaConfig | null {
  const refreshToken = process.env.DOTYKACKA_REFRESH_TOKEN?.trim();
  const cloudRaw = process.env.DOTYKACKA_CLOUD_ID?.trim();
  const branchRaw = process.env.DOTYKACKA_BRANCH_ID?.trim();
  if (!refreshToken || !cloudRaw || !branchRaw) return null;

  const cloudId = Number(cloudRaw);
  const branchId = Number(branchRaw);
  if (!Number.isFinite(cloudId) || !Number.isFinite(branchId)) return null;

  const productMap = parseJsonRecord(process.env.DOTYKACKA_PRODUCT_MAP_JSON);
  if (productMap === null) return null;

  return {
    apiBase: defaultApiBase(),
    refreshToken,
    cloudId,
    branchId,
    productMap,
  };
}

/**
 * Jedna provozovna shodná s .env / jediná v DB — bezpečný fallback na globální Dotykačku v .env,
 * když ještě neexistuje řádek `restaurant_dotykacka` (migrace z jednoho tenanta).
 */
function shouldUseEnvDotykackaFallbackForRestaurant(restaurantId: string): boolean {
  const rid = restaurantId.trim();
  if (!rid) return false;
  const envPublic = process.env.PUBLIC_RESTAURANT_ID?.trim();
  if (envPublic && envPublic === rid) return true;
  const def = getDefaultPublicMenuRestaurantIdFromEnv();
  return Boolean(def && def === rid);
}

async function configFromRestaurantRow(restaurantId: string): Promise<DotykackaConfig | null> {
  const row = await getRestaurantDotykackaRow(restaurantId);
  if (!row?.refreshToken?.trim() || !Number.isFinite(row.cloudId)) return null;
  if (row.disabled === 1 || row.revokedAtIso) return null;

  const env = configFromEnv();
  const cloudId = row.cloudId;

  let branchId = row.branchId;
  if (!branchId || branchId <= 0) {
    if (env && env.cloudId === cloudId) {
      branchId = env.branchId;
    } else {
      return null;
    }
  }

  let productMap = parseJsonRecord(row.productMapJson);
  if (productMap === null) return null;
  if (Object.keys(productMap).length === 0 && env && env.cloudId === cloudId) {
    productMap = env.productMap;
  }

  const apiBase = (row.apiBase?.trim() || defaultApiBase()).replace(/\/$/, "");
  return {
    apiBase,
    refreshToken: row.refreshToken.trim(),
    cloudId,
    branchId,
    productMap,
  };
}

async function menuFetchFromRestaurantRow(restaurantId: string): Promise<{
  apiBase: string;
  refreshToken: string;
  cloudId: number;
} | null> {
  const row = await getRestaurantDotykackaRow(restaurantId);
  if (!row?.refreshToken?.trim() || !Number.isFinite(row.cloudId)) return null;
  if (row.disabled === 1 || row.revokedAtIso) return null;
  const apiBase = (row.apiBase?.trim() || defaultApiBase()).replace(/\/$/, "");
  return { apiBase, refreshToken: row.refreshToken.trim(), cloudId: row.cloudId };
}

/**
 * Pro synchronizaci objednávek / účtu — vyžaduje branch a mapu.
 * DB řádek má přednost; `branchId` 0 po OAuth a prázdná mapa `{}` se doplní z `.env`, pokud
 * `DOTYKACKA_CLOUD_ID` v .env odpovídá cloudu v DB. Bez řádku v DB se pro **jednu** výchozí
 * provozovnu (PUBLIC_RESTAURANT_ID / jediná restaurace) použije celý `.env`.
 * Když `restaurantId` neznáme (`null`/undefined/„“), chová se to jako dřív: jen `.env` (jeden tenant).
 */
export async function getDotykackaConfig(restaurantId?: string | null): Promise<DotykackaConfig | null> {
  const rid = restaurantId?.trim();
  if (rid) {
    const fromRow = await configFromRestaurantRow(rid);
    if (fromRow) return fromRow;
    if (!(await getRestaurantDotykackaRow(rid)) && shouldUseEnvDotykackaFallbackForRestaurant(rid)) {
      return configFromEnv();
    }
    return null;
  }
  return configFromEnv();
}

export function getDotykackaOAuthClientConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.DOTYKACKA_CLIENT_ID?.trim();
  const clientSecret = process.env.DOTYKACKA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Pro načtení produktů stačí refresh token + cloud (branch nepotřebujete).
 * Bez řádku v DB se pro výchozí jednu provozovnu použije `.env` (stejně jako u getDotykackaConfig).
 */
export async function getDotykackaMenuFetchConfig(restaurantId?: string | null): Promise<{
  apiBase: string;
  refreshToken: string;
  cloudId: number;
} | null> {
  const rid = restaurantId?.trim();
  if (rid) {
    const fromRow = await menuFetchFromRestaurantRow(rid);
    if (fromRow) return fromRow;
    if (!(await getRestaurantDotykackaRow(rid)) && shouldUseEnvDotykackaFallbackForRestaurant(rid)) {
      const env = configFromEnv();
      if (env) return { apiBase: env.apiBase, refreshToken: env.refreshToken, cloudId: env.cloudId };
    }
    return null;
  }
  const refreshToken = process.env.DOTYKACKA_REFRESH_TOKEN?.trim();
  const cloudRaw = process.env.DOTYKACKA_CLOUD_ID?.trim();
  if (!refreshToken || !cloudRaw) return null;
  const cloudId = Number(cloudRaw);
  if (!Number.isFinite(cloudId)) return null;
  return { apiBase: defaultApiBase(), refreshToken, cloudId };
}
