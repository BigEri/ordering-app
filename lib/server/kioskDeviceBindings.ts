import { nowIso } from "./db";
import { generateDeviceSecret } from "./deviceSecret";
import { prisma } from "./prisma";
import { isPrismaMissingColumnError } from "./prismaKnownError";

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

/** Hot path (config poll / SSR) — bez baterie, ať chybějící migrace neshazuje každou návštěvu. */
const bindingSelectCore = {
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
} as const;

const bindingSelectAdmin = {
  ...bindingSelectCore,
  batteryPercent: true,
  batteryCharging: true,
} as const;

const bindingSelectMinimal = {
  deviceId: true,
  restaurantId: true,
  tableId: true,
  tableLabel: true,
  pairingLocked: true,
  updatedAtIso: true,
  deviceSecret: true,
  reloadNonce: true,
} as const;

function asBindingRow(row: {
  deviceId: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  pairingLocked: number;
  updatedAtIso: string;
  deviceSecret: string | null;
  reloadNonce?: number;
  apkUpdateNonce?: number;
  rebootNonce?: number;
  lastSeenAtIso?: string | null;
  kioskApkVersionCode?: number | null;
  batteryPercent?: number | null;
  batteryCharging?: number | null;
}): KioskDeviceBindingRow {
  return {
    deviceId: row.deviceId,
    restaurantId: row.restaurantId,
    tableId: row.tableId,
    tableLabel: row.tableLabel,
    pairingLocked: row.pairingLocked,
    updatedAtIso: row.updatedAtIso,
    deviceSecret: row.deviceSecret,
    reloadNonce: row.reloadNonce ?? 0,
    apkUpdateNonce: row.apkUpdateNonce ?? 0,
    rebootNonce: row.rebootNonce ?? 0,
    lastSeenAtIso: row.lastSeenAtIso ?? null,
    kioskApkVersionCode: row.kioskApkVersionCode ?? null,
    batteryPercent: row.batteryPercent ?? null,
    batteryCharging: row.batteryCharging ?? null,
  };
}

export async function getKioskDeviceBinding(deviceId: string): Promise<KioskDeviceBindingRow | null> {
  const id = deviceId.trim();
  if (!id) return null;
  try {
    const row = await prisma.kioskDeviceBinding.findUnique({
      where: { deviceId: id },
      select: bindingSelectCore,
    });
    return row ? asBindingRow(row) : null;
  } catch (e) {
    if (!isPrismaMissingColumnError(e)) throw e;
    const row = await prisma.kioskDeviceBinding.findUnique({
      where: { deviceId: id },
      select: bindingSelectMinimal,
    });
    return row ? asBindingRow(row) : null;
  }
}

/** Všechna spárovaná zařízení (trvalá vazba v DB) — pro přehled v administraci i bez běžícího heartbeatu. */
export async function listAllKioskDeviceBindings(): Promise<KioskDeviceBindingRow[]> {
  try {
    const rows = await prisma.kioskDeviceBinding.findMany({
      orderBy: { tableLabel: "asc" },
      select: bindingSelectAdmin,
    });
    return (rows ?? []).map(asBindingRow);
  } catch (e) {
    if (!isPrismaMissingColumnError(e)) throw e;
    const rows = await prisma.kioskDeviceBinding.findMany({
      orderBy: { tableLabel: "asc" },
      select: bindingSelectCore,
    });
    return (rows ?? []).map(asBindingRow);
  }
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
  await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: deviceId.trim() },
    data: { deviceSecret: secret, updatedAtIso: nowIso() },
  });
  return secret;
}

async function bumpDeviceNonce(
  deviceId: string,
  field: "reloadNonce" | "apkUpdateNonce" | "rebootNonce",
): Promise<number> {
  const id = deviceId.trim();
  if (!id) return 0;
  const result = await prisma.kioskDeviceBinding.updateMany({
    where: { deviceId: id },
    data: { [field]: { increment: 1 }, updatedAtIso: nowIso() },
  });
  if (result.count === 0) return 0;
  const row = await prisma.kioskDeviceBinding.findUnique({
    where: { deviceId: id },
    select: { [field]: true },
  });
  const value = row?.[field];
  return typeof value === "number" ? value : 0;
}

async function readDeviceNonce(
  deviceId: string,
  field: "reloadNonce" | "apkUpdateNonce" | "rebootNonce",
): Promise<number> {
  const id = deviceId.trim();
  if (!id) return 0;
  try {
    const row = await prisma.kioskDeviceBinding.findUnique({
      where: { deviceId: id },
      select: { [field]: true },
    });
    const value = row?.[field];
    return typeof value === "number" ? value : 0;
  } catch (e) {
    if (!isPrismaMissingColumnError(e)) throw e;
    return 0;
  }
}

export async function bumpKioskDeviceReloadNonce(deviceId: string): Promise<number> {
  return bumpDeviceNonce(deviceId, "reloadNonce");
}

export async function getKioskDeviceReloadNonce(deviceId: string): Promise<number> {
  return readDeviceNonce(deviceId, "reloadNonce");
}

export async function bumpKioskDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  return bumpDeviceNonce(deviceId, "apkUpdateNonce");
}

export async function getKioskDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  return readDeviceNonce(deviceId, "apkUpdateNonce");
}

export async function bumpKioskDeviceRebootNonce(deviceId: string): Promise<number> {
  return bumpDeviceNonce(deviceId, "rebootNonce");
}

export async function getKioskDeviceRebootNonce(deviceId: string): Promise<number> {
  return readDeviceNonce(deviceId, "rebootNonce");
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

/** Zvýší apkUpdateNonce u všech tabletů provozovny (admin „aktualizovat APK na všech“). */
export async function bumpAllKioskDeviceApkUpdateNoncesForRestaurant(restaurantId: string): Promise<number> {
  const rid = restaurantId.trim();
  if (!rid) return 0;
  const result = await prisma.kioskDeviceBinding.updateMany({
    where: { restaurantId: rid },
    data: { apkUpdateNonce: { increment: 1 }, updatedAtIso: nowIso() },
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
  const baseData = {
    lastSeenAtIso: ts,
    ...(apk !== undefined ? { kioskApkVersionCode: apk } : {}),
  };
  try {
    await prisma.kioskDeviceBinding.updateMany({
      where: { deviceId: id },
      data: {
        ...baseData,
        ...(batteryPercent !== undefined ? { batteryPercent } : {}),
        ...(batteryCharging !== undefined ? { batteryCharging } : {}),
      },
    });
  } catch (e) {
    if (!isPrismaMissingColumnError(e)) throw e;
    await prisma.kioskDeviceBinding.updateMany({
      where: { deviceId: id },
      data: baseData,
    });
  }
}
