import { nowIso } from "./db";
import { generateDeviceSecret } from "./deviceSecret";
import { prisma } from "./prisma";

export type KioskDeviceBindingRow = {
  deviceId: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  pairingLocked: number;
  updatedAtIso: string;
  deviceSecret: string | null;
  reloadNonce: number;
};

export async function getKioskDeviceBinding(deviceId: string): Promise<KioskDeviceBindingRow | null> {
  const id = deviceId.trim();
  if (!id) return null;
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: id },
    select: {
      deviceId: true,
      restaurantId: true,
      tableId: true,
      tableLabel: true,
      pairingLocked: true,
      updatedAtIso: true,
      deviceSecret: true,
      reloadNonce: true,
    },
  });
  return row ?? null;
}

/** Všechna spárovaná zařízení (trvalá vazba v DB) — pro přehled v administraci i bez běžícího heartbeatu. */
export async function listAllKioskDeviceBindings(): Promise<KioskDeviceBindingRow[]> {
  const rows = await prisma.kioskDeviceBinding.findMany({
    orderBy: { tableLabel: "asc" },
    select: {
      deviceId: true,
      restaurantId: true,
      tableId: true,
      tableLabel: true,
      pairingLocked: true,
      updatedAtIso: true,
      deviceSecret: true,
      reloadNonce: true,
    },
  });
  return rows ?? [];
}

export async function upsertKioskDeviceBinding(input: {
  deviceId: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  deviceSecret?: string | null;
}): Promise<{ deviceSecret: string }> {
  const ts = nowIso();
  const id = input.deviceId.trim();
  const secret = input.deviceSecret?.trim() || generateDeviceSecret();

  await prisma.kioskDeviceBinding.upsert({
    where: { deviceId: id },
    update: {
      restaurantId: input.restaurantId.trim(),
      tableId: input.tableId.trim(),
      tableLabel: input.tableLabel.trim(),
      updatedAtIso: ts,
      deviceSecret: secret,
    },
    create: {
      deviceId: id,
      restaurantId: input.restaurantId.trim(),
      tableId: input.tableId.trim(),
      tableLabel: input.tableLabel.trim(),
      pairingLocked: 1,
      updatedAtIso: ts,
      deviceSecret: secret,
      reloadNonce: 0,
    },
  });
  return { deviceSecret: secret };
}

/** Doplní tajný klíč u starých vazeb bez něj (jednorázově při config poll). */
export async function ensureKioskDeviceSecret(deviceId: string): Promise<string | null> {
  const row = await getKioskDeviceBinding(deviceId);
  if (!row) return null;
  if (row.deviceSecret?.trim()) return row.deviceSecret.trim();
  const secret = generateDeviceSecret();
  await prisma.kioskDeviceBinding.update({
    where: { deviceId: deviceId.trim() },
    data: { deviceSecret: secret, updatedAtIso: nowIso() },
  });
  return secret;
}

export async function bumpKioskDeviceReloadNonce(deviceId: string): Promise<number> {
  const id = deviceId.trim();
  if (!id) return 0;
  const row = await prisma.kioskDeviceBinding.update({
    where: { deviceId: id },
    data: { reloadNonce: { increment: 1 }, updatedAtIso: nowIso() },
    select: { reloadNonce: true },
  });
  return row.reloadNonce;
}

export async function getKioskDeviceReloadNonce(deviceId: string): Promise<number> {
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: deviceId.trim() },
    select: { reloadNonce: true },
  });
  return row?.reloadNonce ?? 0;
}

export async function setKioskDevicePairingLocked(deviceId: string, locked: boolean): Promise<void> {
  const id = deviceId.trim();
  if (!id) return;
  await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: id },
    data: { pairingLocked: locked ? 1 : 0, updatedAtIso: nowIso() },
  });
}
