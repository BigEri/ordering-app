import { nowIso } from "./db";
import { recordIntegrationAuditEvent } from "./integrationAudit";
import { prisma } from "./prisma";

export type RestaurantStoryousRow = {
  restaurantId: string;
  merchantId: string;
  placeId: string;
  merchantName: string | null;
  placeName: string | null;
  disabled: 0 | 1;
  createdAtIso: string | null;
  updatedAtIso: string;
  lastOkAtIso: string | null;
  lastError: string | null;
};

export async function getRestaurantStoryousRow(restaurantId: string): Promise<RestaurantStoryousRow | null> {
  const rid = restaurantId.trim();
  if (!rid) return null;
  const row = await prisma.restaurantStoryous.findUnique({
    where: { restaurantId: rid },
    select: {
      restaurantId: true,
      merchantId: true,
      placeId: true,
      merchantName: true,
      placeName: true,
      disabled: true,
      createdAtIso: true,
      updatedAtIso: true,
      lastOkAtIso: true,
      lastError: true,
    },
  });
  if (!row) return null;
  return {
    ...row,
    disabled: (row.disabled ?? 0) as 0 | 1,
  };
}

export async function upsertRestaurantStoryousConnection(input: {
  restaurantId: string;
  merchantId: string;
  placeId: string;
  merchantName: string;
  placeName: string;
  actorUserId: string | null;
}): Promise<RestaurantStoryousRow> {
  const rid = input.restaurantId.trim();
  const ts = nowIso();
  const existing = await getRestaurantStoryousRow(rid);
  const row = await prisma.restaurantStoryous.upsert({
    where: { restaurantId: rid },
    update: {
      merchantId: input.merchantId.trim(),
      placeId: input.placeId.trim(),
      merchantName: input.merchantName.trim() || null,
      placeName: input.placeName.trim() || null,
      disabled: 0,
      lastOkAtIso: ts,
      lastError: null,
      updatedAtIso: ts,
    },
    create: {
      restaurantId: rid,
      merchantId: input.merchantId.trim(),
      placeId: input.placeId.trim(),
      merchantName: input.merchantName.trim() || null,
      placeName: input.placeName.trim() || null,
      disabled: 0,
      createdAtIso: existing?.createdAtIso ?? ts,
      updatedAtIso: ts,
      lastOkAtIso: ts,
      lastError: null,
    },
  });
  await recordIntegrationAuditEvent({
    type: "storyous_connected",
    restaurantId: rid,
    actorUserId: input.actorUserId?.trim() || null,
    deviceId: null,
    details: { merchantId: input.merchantId.trim(), placeId: input.placeId.trim() },
  });
  return {
    ...row,
    disabled: (row.disabled ?? 0) as 0 | 1,
  };
}

export async function setRestaurantStoryousDisabled(input: {
  restaurantId: string;
  disabled: boolean;
  actorUserId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await getRestaurantStoryousRow(input.restaurantId);
  if (!row) return { ok: false, error: "Storyous u této restaurace není napojený." };
  const ts = nowIso();
  await prisma.restaurantStoryous.update({
    where: { restaurantId: input.restaurantId.trim() },
    data: {
      disabled: input.disabled ? 1 : 0,
      updatedAtIso: ts,
    },
  });
  await recordIntegrationAuditEvent({
    type: input.disabled ? "storyous_disconnected" : "storyous_connected",
    restaurantId: input.restaurantId,
    actorUserId: input.actorUserId?.trim() || null,
    deviceId: null,
    details: { disabled: input.disabled },
  });
  return { ok: true };
}

export async function markRestaurantStoryousOk(restaurantId: string): Promise<void> {
  const ts = nowIso();
  await prisma.restaurantStoryous.updateMany({
    where: { restaurantId: restaurantId.trim() },
    data: { lastOkAtIso: ts, lastError: null, updatedAtIso: ts },
  });
}

export async function markRestaurantStoryousError(restaurantId: string, error: string): Promise<void> {
  const ts = nowIso();
  await prisma.restaurantStoryous.updateMany({
    where: { restaurantId: restaurantId.trim() },
    data: { lastError: error.trim().slice(0, 2000), updatedAtIso: ts },
  });
}
