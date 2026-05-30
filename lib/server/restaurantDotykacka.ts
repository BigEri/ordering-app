import { nowIso } from "./db";
import { recordIntegrationAuditEvent } from "./integrationAudit";
import { decryptDotykackaSecret, encryptDotykackaSecret, isEncryptedDotykackaSecret } from "./secretBox";
import { prisma } from "./prisma";

/** Pokud v .env sedí stejný cloud jako po OAuth, doplníme pobočku a mapu (stejné jako dřív jen v .env). */
function dotykackaSeedFromEnvForCloud(cloudId: number): { branchId: number; productMapJson: string } | null {
  const cloudRaw = process.env.DOTYKACKA_CLOUD_ID?.trim();
  const branchRaw = process.env.DOTYKACKA_BRANCH_ID?.trim();
  if (!cloudRaw || !branchRaw) return null;
  if (Number(cloudRaw) !== cloudId) return null;
  const branchId = Number.parseInt(branchRaw, 10);
  if (!Number.isFinite(branchId) || branchId <= 0) return null;
  const productMapJson = process.env.DOTYKACKA_PRODUCT_MAP_JSON?.trim() || "{}";
  return { branchId, productMapJson };
}

export type RestaurantDotykackaRow = {
  restaurantId: string;
  refreshToken: string;
  cloudId: number;
  branchId: number;
  productMapJson: string;
  apiBase: string | null;
  createdAtIso: string | null;
  updatedAtIso: string;
  disabled: 0 | 1;
  revokedAtIso: string | null;
  lastTokenRefreshAtIso: string | null;
  lastOkAtIso: string | null;
  lastError: string | null;
};

export async function getRestaurantDotykackaRow(restaurantId: string): Promise<RestaurantDotykackaRow | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurantDotykacka.findUnique({
    where: { restaurantId: rid },
    select: {
      restaurantId: true,
      refreshToken: true,
      cloudId: true,
      branchId: true,
      productMapJson: true,
      apiBase: true,
      createdAtIso: true,
      updatedAtIso: true,
      disabled: true,
      revokedAtIso: true,
      lastTokenRefreshAtIso: true,
      lastOkAtIso: true,
      lastError: true,
    },
  });
  if (!row) return null;
  const out: RestaurantDotykackaRow = {
    ...row,
    disabled: (row.disabled ?? 0) as 0 | 1,
    branchId: row.branchId ?? 0,
    productMapJson: row.productMapJson ?? "{}",
    apiBase: row.apiBase ?? null,
    createdAtIso: row.createdAtIso ?? null,
    revokedAtIso: row.revokedAtIso ?? null,
    lastTokenRefreshAtIso: row.lastTokenRefreshAtIso ?? null,
    lastOkAtIso: row.lastOkAtIso ?? null,
    lastError: row.lastError ?? null,
  };
  try {
    const rt = out.refreshToken?.trim() ?? "";
    out.refreshToken = rt ? decryptDotykackaSecret(rt) : "";
  } catch {
    // If decryption fails (e.g., key missing), keep raw so caller can error meaningfully later.
  }
  return out;
}

/** Po OAuth: refresh + cloud; ponechá branch a mapu, pokud už v DB jsou; jinak doplnění z .env při shodě cloudu. */
export async function upsertRestaurantDotykackaOAuth(input: {
  restaurantId: string;
  refreshToken: string;
  cloudId: number;
  apiBase: string | null;
}): Promise<void> {
  const ts = nowIso();
  const existing = await getRestaurantDotykackaRow(input.restaurantId);
  const seed = dotykackaSeedFromEnvForCloud(input.cloudId);
  let branchId = existing?.branchId && existing.branchId > 0 ? existing.branchId : 0;
  if (branchId <= 0 && seed) branchId = seed.branchId;
  let productMapJson = existing?.productMapJson?.trim() || "{}";
  if (productMapJson === "{}" && seed) productMapJson = seed.productMapJson;
  const apiBase =
    input.apiBase?.trim() ||
    (existing?.apiBase?.trim() ? existing.apiBase.trim() : null);

  const plain = input.refreshToken.trim();
  const refreshTokenToStore = isEncryptedDotykackaSecret(plain) ? plain : encryptDotykackaSecret(plain);

  const rid = input.restaurantId.trim();
  await prisma.restaurantDotykacka.upsert({
    where: { restaurantId: rid },
    update: {
      refreshToken: refreshTokenToStore,
      cloudId: input.cloudId,
      apiBase: apiBase ?? undefined,
      disabled: 0,
      revokedAtIso: null,
      lastError: null,
      updatedAtIso: ts,
      // keep existing branch/map unless missing
      branchId,
      productMapJson,
    },
    create: {
      restaurantId: rid,
      refreshToken: refreshTokenToStore,
      cloudId: input.cloudId,
      branchId,
      productMapJson,
      apiBase,
      createdAtIso: existing?.createdAtIso ?? existing?.updatedAtIso ?? ts,
      updatedAtIso: ts,
      disabled: 0,
      revokedAtIso: null,
      lastError: null,
      lastOkAtIso: null,
      lastTokenRefreshAtIso: null,
    },
  });

  await recordIntegrationAuditEvent({
    type: "dotykacka_connected",
    restaurantId: rid,
    actorUserId: null,
    deviceId: null,
    details: { cloudId: input.cloudId },
  });
}

export async function updateRestaurantDotykackaSettings(input: {
  restaurantId: string;
  branchId: number;
  productMapJson: string;
  apiBase: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getRestaurantDotykackaRow(input.restaurantId);
  if (!row) return { ok: false, error: "Nejdřív připojte Dotykačku přes OAuth (chybí záznam pro tuto restauraci)." };
  if (!Number.isFinite(input.branchId) || input.branchId <= 0) {
    return { ok: false, error: "Zadejte platné ID pobočky (kladné číslo)." };
  }
  await prisma.restaurantDotykacka.update({
    where: { restaurantId: input.restaurantId.trim() },
    data: {
      branchId: input.branchId,
      productMapJson: input.productMapJson.trim(),
      apiBase: input.apiBase?.trim() || null,
      updatedAtIso: nowIso(),
    },
  });
  return { ok: true };
}

export async function setRestaurantDotykackaDisabled(input: {
  restaurantId: string;
  disabled: boolean;
  actorUserId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getRestaurantDotykackaRow(input.restaurantId);
  if (!row) return { ok: false, error: "Dotykačka není pro tuto restauraci připojena." };
  const ts = nowIso();
  const disabled = input.disabled ? 1 : 0;
  await prisma.restaurantDotykacka.update({
    where: { restaurantId: input.restaurantId.trim() },
    data: {
      disabled,
      revokedAtIso: input.disabled ? ts : null,
      updatedAtIso: ts,
    },
  });

  await recordIntegrationAuditEvent({
    type: input.disabled ? "dotykacka_disconnected" : "dotykacka_connected",
    restaurantId: input.restaurantId,
    actorUserId: input.actorUserId?.trim() || null,
    deviceId: null,
    details: { disabled: input.disabled },
  });

  return { ok: true };
}

export function markRestaurantDotykackaSyncOk(input: {
  restaurantId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const ts = nowIso();
  return prisma.restaurantDotykacka
    .updateMany({
      where: { restaurantId: input.restaurantId.trim() },
      data: { lastOkAtIso: ts, lastError: null, updatedAtIso: ts },
    })
    .then(async () => {
      await recordIntegrationAuditEvent({
    type: "dotykacka_sync_ok",
    restaurantId: input.restaurantId,
    actorUserId: null,
    deviceId: null,
    details: input.details,
  });
    });
}

export function markRestaurantDotykackaSyncFailed(input: {
  restaurantId: string;
  error: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const ts = nowIso();
  const err = input.error.trim().slice(0, 2000);
  return prisma.restaurantDotykacka
    .updateMany({
      where: { restaurantId: input.restaurantId.trim() },
      data: { lastError: err, updatedAtIso: ts },
    })
    .then(async () => {
      await recordIntegrationAuditEvent({
    type: "dotykacka_sync_failed",
    restaurantId: input.restaurantId,
    actorUserId: null,
    deviceId: null,
    details: { ...input.details, error: err },
  });
    });
}
