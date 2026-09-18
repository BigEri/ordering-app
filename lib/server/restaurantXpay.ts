import { nowIso } from "./db";
import { recordIntegrationAuditEvent } from "./integrationAudit";
import { prisma } from "./prisma";
import { withPrismaTransientRetry } from "./prismaRetry";
import { decryptDotykackaSecret, encryptDotykackaSecret, isEncryptedDotykackaSecret } from "./secretBox";
import { parseXpayEnvironment, type XpayEnvironment } from "../xpay/env";

export type RestaurantXpayPublic = {
  restaurantId: string;
  hasApiKey: boolean;
  environment: XpayEnvironment;
  disabled: boolean;
  createdAtIso: string | null;
  updatedAtIso: string;
  lastOkAtIso: string | null;
  lastError: string | null;
};

function toPublic(row: {
  restaurantId: string;
  apiKeyEnc: string;
  environment: string;
  disabled: number;
  createdAtIso: string | null;
  updatedAtIso: string;
  lastOkAtIso: string | null;
  lastError: string | null;
}): RestaurantXpayPublic {
  return {
    restaurantId: row.restaurantId,
    hasApiKey: Boolean(row.apiKeyEnc?.trim()),
    environment: parseXpayEnvironment(row.environment),
    disabled: row.disabled === 1,
    createdAtIso: row.createdAtIso,
    updatedAtIso: row.updatedAtIso,
    lastOkAtIso: row.lastOkAtIso,
    lastError: row.lastError,
  };
}

export async function getRestaurantXpayRow(restaurantId: string): Promise<RestaurantXpayPublic | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurantXpay.findUnique({ where: { restaurantId: rid } });
  return row ? toPublic(row) : null;
}

export async function getRestaurantXpayApiKey(restaurantId: string): Promise<string | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurantXpay.findUnique({
    where: { restaurantId: rid },
    select: { apiKeyEnc: true, disabled: true },
  });
  if (!row || row.disabled === 1) return null;
  const raw = row.apiKeyEnc?.trim();
  if (!raw) return null;
  try {
    return isEncryptedDotykackaSecret(raw) ? decryptDotykackaSecret(raw) : raw;
  } catch {
    return null;
  }
}

export async function upsertRestaurantXpaySettings(input: {
  restaurantId: string;
  apiKey?: string | null;
  environment: XpayEnvironment;
  actorUserId: string | null;
}): Promise<RestaurantXpayPublic> {
  const rid = input.restaurantId.trim();
  const ts = nowIso();
  const existing = await prisma.restaurantXpay.findUnique({ where: { restaurantId: rid } });
  const nextKey = input.apiKey?.trim()
    ? encryptDotykackaSecret(input.apiKey.trim())
    : existing?.apiKeyEnc;
  if (!nextKey) {
    throw new Error("Zadejte XPay API klíč.");
  }
  const row = await prisma.restaurantXpay.upsert({
    where: { restaurantId: rid },
    update: {
      apiKeyEnc: nextKey,
      environment: input.environment,
      disabled: 0,
      lastError: null,
      updatedAtIso: ts,
    },
    create: {
      restaurantId: rid,
      apiKeyEnc: nextKey,
      environment: input.environment,
      disabled: 0,
      createdAtIso: existing?.createdAtIso ?? ts,
      updatedAtIso: ts,
    },
  });
  await recordIntegrationAuditEvent({
    type: "xpay_connected",
    restaurantId: rid,
    actorUserId: input.actorUserId?.trim() || null,
    deviceId: null,
    details: { environment: input.environment, apiKeySet: Boolean(input.apiKey?.trim()) },
  });
  return toPublic(row);
}

export async function setRestaurantXpayDisabled(input: {
  restaurantId: string;
  disabled: boolean;
  actorUserId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getRestaurantXpayRow(input.restaurantId);
  if (!row) return { ok: false, error: "XPay u této restaurace není nastavený." };
  const ts = nowIso();
  await prisma.restaurantXpay.update({
    where: { restaurantId: input.restaurantId.trim() },
    data: { disabled: input.disabled ? 1 : 0, updatedAtIso: ts },
  });
  await recordIntegrationAuditEvent({
    type: input.disabled ? "xpay_disconnected" : "xpay_connected",
    restaurantId: input.restaurantId,
    actorUserId: input.actorUserId?.trim() || null,
    deviceId: null,
    details: { disabled: input.disabled },
  });
  return { ok: true };
}

export async function markRestaurantXpayOk(restaurantId: string): Promise<void> {
  const ts = nowIso();
  try {
    await withPrismaTransientRetry(() =>
      prisma.restaurantXpay.updateMany({
        where: { restaurantId: restaurantId.trim() },
        data: { lastOkAtIso: ts, lastError: null, updatedAtIso: ts },
      }),
    );
  } catch {
    /* stav v adminu */
  }
}

export async function markRestaurantXpayError(restaurantId: string, error: string): Promise<void> {
  const ts = nowIso();
  try {
    await withPrismaTransientRetry(() =>
      prisma.restaurantXpay.updateMany({
        where: { restaurantId: restaurantId.trim() },
        data: { lastError: error.trim().slice(0, 2000), updatedAtIso: ts },
      }),
    );
  } catch {
    /* stav v adminu */
  }
}
