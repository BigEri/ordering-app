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
  apkUpdateNonce: number;
  rebootNonce: number;
  lastSeenAtIso: string | null;
  kioskApkVersionCode: number | null;
  batteryPercent: number | null;
  batteryCharging: number | null;
};

const bindingSelect = {
  deviceId: true,
  restaurantId: true,
  tableId: true,
  tableLabel: true,
  pairingLocked: true,
  updatedAtIso: true,
  deviceSecret: true,
  reloadNonce: true,
  apkUpdateNonce: true,
  rebootNonce: true,
  lastSeenAtIso: true,
  kioskApkVersionCode: true,
  batteryPercent: true,
  batteryCharging: true,
} as const;

export async function getKioskDeviceBinding(deviceId: string): Promise<KioskDeviceBindingRow | null> {
  const id = deviceId.trim();
  if (!id) return null;
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: id },
    select: bindingSelect,
  });
  return row ?? null;
}

/** Všechna spárovaná zařízení (trvalá vazba v DB) — pro přehled v administraci i bez běžícího heartbeatu. */
export async function listAllKioskDeviceBindings(): Promise<KioskDeviceBindingRow[]> {
  const rows = await prisma.kioskDeviceBinding.findMany({
    orderBy: { tableLabel: "asc" },
    select: bindingSelect,
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
      apkUpdateNonce: 0,
      rebootNonce: 0,
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

export async function bumpKioskDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  const id = deviceId.trim();
  if (!id) return 0;
  const row = await prisma.kioskDeviceBinding.update({
    where: { deviceId: id },
    data: { apkUpdateNonce: { increment: 1 }, updatedAtIso: nowIso() },
    select: { apkUpdateNonce: true },
  });
  return row.apkUpdateNonce;
}

export async function getKioskDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: deviceId.trim() },
    select: { apkUpdateNonce: true },
  });
  return row?.apkUpdateNonce ?? 0;
}

export async function bumpKioskDeviceRebootNonce(deviceId: string): Promise<number> {
  const id = deviceId.trim();
  if (!id) return 0;
  const row = await prisma.kioskDeviceBinding.update({
    where: { deviceId: id },
    data: { rebootNonce: { increment: 1 }, updatedAtIso: nowIso() },
    select: { rebootNonce: true },
  });
  return row.rebootNonce;
}

export async function getKioskDeviceRebootNonce(deviceId: string): Promise<number> {
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: deviceId.trim() },
    select: { rebootNonce: true },
  });
  return row?.rebootNonce ?? 0;
}

export async function bumpAllKioskDeviceRebootNoncesForRestaurant(restaurantId: string): Promise<number> {
  const rid = restaurantId.trim();
  if (!rid) return 0;
  const result = await prisma.kioskDeviceBinding.updateMany({
    where: { restaurantId: rid },
    data: { rebootNonce: { increment: 1 }, updatedAtIso: nowIso() },
  });
  return result.count;
}

/** Zvýší reloadNonce u všech tabletů provozovny (admin „vynutit obnovení všech“). */
export async function bumpAllKioskDeviceReloadNoncesForRestaurant(restaurantId: string): Promise<number> {
  const rid = restaurantId.trim();
  if (!rid) return 0;
  const result = await prisma.kioskDeviceBinding.updateMany({
    where: { restaurantId: rid },
    data: { reloadNonce: { increment: 1 }, updatedAtIso: nowIso() },
  });
  return result.count;
}

export async function setKioskDevicePairingLocked(deviceId: string, locked: boolean): Promise<void> {
  const id = deviceId.trim();
  if (!id) return;
  await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: id },
    data: { pairingLocked: locked ? 1 : 0, updatedAtIso: nowIso() },
  });
}

/** Zapíše lastSeen a volitelně verzi APK / baterii do DB (spolehlivý přehled v adminu na Vercelu). */
export async function touchKioskDeviceTelemetry(
  deviceId: string,
  input: {
    apkVersionCode?: number | null;
    userAgent?: string | null;
    batteryPercent?: number | null;
    batteryCharging?: boolean | null;
  },
): Promise<void> {
  const id = deviceId.trim();
  if (!id) return;
  const ts = nowIso();
  const apk =
    input.apkVersionCode != null && Number.isFinite(input.apkVersionCode) && input.apkVersionCode > 0
      ? Math.trunc(input.apkVersionCode)
      : undefined;
  const hasBattery = input.batteryPercent != null && Number.isFinite(input.batteryPercent);
  const batteryPercent = hasBattery ? Math.trunc(input.batteryPercent as number) : undefined;
  const batteryCharging = hasBattery ? (input.batteryCharging ? 1 : 0) : undefined;
  await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: id },
    data: {
      lastSeenAtIso: ts,
      ...(apk !== undefined ? { kioskApkVersionCode: apk } : {}),
      ...(batteryPercent !== undefined ? { batteryPercent } : {}),
      ...(batteryCharging !== undefined ? { batteryCharging } : {}),
    },
  });
}
