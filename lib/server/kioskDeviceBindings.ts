import { nowIso } from "./db";
import { prisma } from "./prisma";

export type KioskDeviceBindingRow = {
  deviceId: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  pairingLocked: number;
  updatedAtIso: string;
};

export async function getKioskDeviceBinding(deviceId: string): Promise<KioskDeviceBindingRow | null> {
  const id = deviceId.trim();
  if (!id) return null;
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: id },
    select: { deviceId: true, restaurantId: true, tableId: true, tableLabel: true, pairingLocked: true, updatedAtIso: true },
  });
  return row ?? null;
}

/** Všechna spárovaná zařízení (trvalá vazba v DB) — pro přehled v administraci i bez běžícího heartbeatu. */
export async function listAllKioskDeviceBindings(): Promise<KioskDeviceBindingRow[]> {
  const rows = await prisma.kioskDeviceBinding.findMany({
    orderBy: { tableLabel: "asc" },
    select: { deviceId: true, restaurantId: true, tableId: true, tableLabel: true, pairingLocked: true, updatedAtIso: true },
  });
  return rows ?? [];
}

export async function upsertKioskDeviceBinding(input: {
  deviceId: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
}): Promise<void> {
  const ts = nowIso();
  await prisma.kioskDeviceBinding.upsert({
    where: { deviceId: input.deviceId.trim() },
    update: {
      restaurantId: input.restaurantId.trim(),
      tableId: input.tableId.trim(),
      tableLabel: input.tableLabel.trim(),
      updatedAtIso: ts,
    },
    create: {
      deviceId: input.deviceId.trim(),
      restaurantId: input.restaurantId.trim(),
      tableId: input.tableId.trim(),
      tableLabel: input.tableLabel.trim(),
      pairingLocked: 1,
      updatedAtIso: ts,
    },
  });
}

export async function setKioskDevicePairingLocked(deviceId: string, locked: boolean): Promise<void> {
  const id = deviceId.trim();
  if (!id) return;
  await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: id },
    data: { pairingLocked: locked ? 1 : 0, updatedAtIso: nowIso() },
  });
}
