/**
 * Registr tabletů: presence v paměti + trvalá vazba stůl + restaurace v SQLite (`kiosk_device_bindings`).
 */

import { getDefaultPublicMenuRestaurantIdFromEnv } from "./publicRestaurantName";
import {
  bumpKioskDeviceApkUpdateNonce,
  bumpKioskDeviceRebootNonce,
  bumpKioskDeviceReloadNonce,
  getKioskDeviceBinding,
  getKioskDeviceApkUpdateNonce,
  getKioskDeviceRebootNonce,
  getKioskDeviceReloadNonce,
  listAllKioskDeviceBindings,
  touchKioskDeviceTelemetry,
  upsertKioskDeviceBinding,
} from "./kioskDeviceBindings";

export type DeviceRecord = {
  deviceId: string;
  tableId: string;
  tableLabel: string;
  lastSeen: number;
  userAgent?: string;
  /** Z DB při párování v adminu; jinak výchozí veřejná provozovna (jedna / env). */
  restaurantId?: string | null;
  pairingLocked?: number;
  /** Nahlášené z tabletu při poll config (BuildConfig.VERSION_CODE). */
  kioskApkVersionCode?: number | null;
  /** 0–100 z kiosk APK; null = ještě nehlásilo. */
  batteryPercent?: number | null;
  batteryCharging?: boolean | null;
};

const ONLINE_THRESHOLD_MS = 120_000;

function lastSeenMsFromIso(iso: string | null | undefined): number {
  if (!iso?.trim()) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function mergeLastSeen(memoryMs: number, dbIso: string | null | undefined): number {
  return Math.max(memoryMs, lastSeenMsFromIso(dbIso));
}

function mergeBatteryCharging(
  mem: boolean | null | undefined,
  db: number | null | undefined,
): boolean | null {
  if (typeof mem === "boolean") return mem;
  if (db == null) return null;
  return db === 1;
}

const presenceByDevice = new Map<string, DeviceRecord>();
/** Přepsání z adminu (paměť; kopírované i do DB při novém bindu). */
const adminBindingByDevice = new Map<string, { tableId: string; tableLabel: string }>();
export async function bumpDeviceReloadNonce(deviceId: string): Promise<number> {
  return bumpKioskDeviceReloadNonce(deviceId);
}

export async function getDeviceReloadNonce(deviceId: string): Promise<number> {
  return getKioskDeviceReloadNonce(deviceId);
}

export async function bumpDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  return bumpKioskDeviceApkUpdateNonce(deviceId);
}

export async function getDeviceApkUpdateNonce(deviceId: string): Promise<number> {
  return getKioskDeviceApkUpdateNonce(deviceId);
}

export async function bumpDeviceRebootNonce(deviceId: string): Promise<number> {
  return bumpKioskDeviceRebootNonce(deviceId);
}

export async function getDeviceRebootNonce(deviceId: string): Promise<number> {
  return getKioskDeviceRebootNonce(deviceId);
}

export function recordKioskTelemetry(
  deviceId: string,
  input: {
    apkVersionCode?: number;
    batteryPercent?: number | null;
    batteryCharging?: boolean | null;
  },
) {
  const id = deviceId.trim();
  if (!id) return;
  const prev = presenceByDevice.get(id);
  const apk =
    input.apkVersionCode != null && Number.isFinite(input.apkVersionCode) && input.apkVersionCode > 0
      ? Math.trunc(input.apkVersionCode)
      : prev?.kioskApkVersionCode ?? null;
  const hasBattery = input.batteryPercent != null && Number.isFinite(input.batteryPercent);
  const batteryPercent = hasBattery
    ? Math.max(0, Math.min(100, Math.trunc(input.batteryPercent as number)))
    : prev?.batteryPercent ?? null;
  const batteryCharging = hasBattery ? Boolean(input.batteryCharging) : prev?.batteryCharging ?? null;
  if (apk == null && !hasBattery) return;

  presenceByDevice.set(id, {
    deviceId: id,
    tableId: prev?.tableId ?? "",
    tableLabel: prev?.tableLabel ?? "",
    lastSeen: Date.now(),
    userAgent: prev?.userAgent,
    restaurantId: prev?.restaurantId,
    pairingLocked: prev?.pairingLocked,
    kioskApkVersionCode: apk,
    batteryPercent,
    batteryCharging,
  });
  void touchKioskDeviceTelemetry(id, {
    apkVersionCode: apk,
    batteryPercent: hasBattery ? batteryPercent : undefined,
    batteryCharging: hasBattery ? batteryCharging : undefined,
  }).catch(() => {});
}

export function clearDeviceFromMemory(deviceId: string): void {
  const id = deviceId.trim();
  if (!id) return;
  presenceByDevice.delete(id);
  adminBindingByDevice.delete(id);
  // NOTE: keep reloadNonceByDevice - it is used to force refresh after admin actions.
}

export async function setAdminBinding(
  deviceId: string,
  tableId: string,
  tableLabel: string,
  restaurantId: string,
): Promise<{ deviceSecret: string }> {
  const tid = tableId.trim();
  const lbl = tableLabel.trim();
  const rid = restaurantId.trim();
  adminBindingByDevice.set(deviceId, { tableId: tid, tableLabel: lbl });
  const { deviceSecret } = await upsertKioskDeviceBinding({
    deviceId,
    restaurantId: rid,
    tableId: tid,
    tableLabel: lbl,
  });

  const prev = presenceByDevice.get(deviceId);
  if (prev) {
    presenceByDevice.set(deviceId, {
      ...prev,
      tableId: tid,
      tableLabel: lbl,
      lastSeen: Date.now(),
    });
  } else {
    presenceByDevice.set(deviceId, {
      deviceId,
      tableId: tid,
      tableLabel: lbl,
      lastSeen: Date.now(),
    });
  }
  return { deviceSecret };
}

export function getAdminBinding(deviceId: string) {
  return adminBindingByDevice.get(deviceId) ?? null;
}

export async function getEffectiveTable(
  deviceId: string,
  opts?: { allowFallback?: boolean },
): Promise<{ tableId: string; tableLabel: string; restaurantId: string } | null> {
  const id = deviceId.trim();
  const allowFallback = opts?.allowFallback !== false;
  const kb = await getKioskDeviceBinding(id);
  if (kb) {
    return { tableId: kb.tableId, tableLabel: kb.tableLabel, restaurantId: kb.restaurantId };
  }
  if (!allowFallback) return null;
  const admin = adminBindingByDevice.get(id);
  if (admin) {
    const def = getDefaultPublicMenuRestaurantIdFromEnv() ?? "";
    return { ...admin, restaurantId: def };
  }
  const p = presenceByDevice.get(id);
  if (p) {
    const def = getDefaultPublicMenuRestaurantIdFromEnv() ?? "";
    return { tableId: p.tableId, tableLabel: p.tableLabel, restaurantId: def };
  }
  return null;
}

export function recordPresenceFromPosPayload(payload: unknown, userAgent?: string | null) {
  if (!payload || typeof payload !== "object") return;
  const o = payload as Record<string, unknown>;
  const deviceId = typeof o.deviceId === "string" ? o.deviceId.trim() : "";
  if (!deviceId) return;
  const tableId = typeof o.tableId === "string" ? o.tableId : "";
  const tableLabel = typeof o.tableLabel === "string" ? o.tableLabel : "";
  recordPresence(deviceId, tableId, tableLabel, userAgent);
}

export function recordPresence(
  deviceId: string,
  clientTableId: string,
  clientTableLabel: string,
  userAgent?: string | null,
) {
  const mem = adminBindingByDevice.get(deviceId);
  const bound = mem;
  const tableId = bound?.tableId ?? clientTableId.trim();
  const tableLabel = bound?.tableLabel ?? clientTableLabel.trim();
  const prev = presenceByDevice.get(deviceId);
  presenceByDevice.set(deviceId, {
    deviceId,
    tableId,
    tableLabel,
    lastSeen: Date.now(),
    userAgent: userAgent ?? prev?.userAgent,
    kioskApkVersionCode: prev?.kioskApkVersionCode ?? null,
    batteryPercent: prev?.batteryPercent ?? null,
    batteryCharging: prev?.batteryCharging ?? null,
  });
  void touchKioskDeviceTelemetry(deviceId, { userAgent }).catch(() => {});
}

export async function listDeviceRecords(): Promise<Array<DeviceRecord & { online: boolean }>> {
  const now = Date.now();
  const merged = new Map<string, DeviceRecord>();
  const bindings = await listAllKioskDeviceBindings();
  const bindingById = new Map(bindings.map((kb) => [kb.deviceId, kb]));

  for (const kb of bindings) {
    const p = presenceByDevice.get(kb.deviceId);
    const lastSeen = mergeLastSeen(p?.lastSeen ?? 0, kb.lastSeenAtIso);
    merged.set(kb.deviceId, {
      deviceId: kb.deviceId,
      tableId: kb.tableId,
      tableLabel: kb.tableLabel,
      lastSeen,
      userAgent: p?.userAgent,
      restaurantId: kb.restaurantId,
      pairingLocked: kb.pairingLocked,
      kioskApkVersionCode: p?.kioskApkVersionCode ?? kb.kioskApkVersionCode ?? null,
      batteryPercent: p?.batteryPercent ?? kb.batteryPercent ?? null,
      batteryCharging: mergeBatteryCharging(p?.batteryCharging, kb.batteryCharging),
    });
  }

  for (const [id, p] of presenceByDevice) {
    if (merged.has(id)) continue;
    const kb = bindingById.get(id);
    const fallbackRid = kb?.restaurantId ?? getDefaultPublicMenuRestaurantIdFromEnv();
    const lastSeen = mergeLastSeen(p.lastSeen, kb?.lastSeenAtIso);
    merged.set(id, {
      ...p,
      lastSeen,
      restaurantId: kb?.restaurantId ?? fallbackRid ?? undefined,
      pairingLocked: kb?.pairingLocked ?? undefined,
      kioskApkVersionCode: p.kioskApkVersionCode ?? kb?.kioskApkVersionCode ?? null,
      batteryPercent: p.batteryPercent ?? kb?.batteryPercent ?? null,
      batteryCharging: mergeBatteryCharging(p.batteryCharging, kb?.batteryCharging),
    });
  }

  const out = [...merged.values()].map((r) => ({
    ...r,
    restaurantId: r.restaurantId ?? undefined,
    online: r.lastSeen > 0 && now - r.lastSeen < ONLINE_THRESHOLD_MS,
  }));
  out.sort((a, b) => a.tableLabel.localeCompare(b.tableLabel, "cs"));
  return out;
}

/** Zařízení jen pro danou provozovnu (multi-tenant přehled v administraci). */
export async function listDeviceRecordsForRestaurant(
  restaurantId: string,
): Promise<Array<DeviceRecord & { online: boolean }>> {
  const rid = restaurantId.trim();
  if (!rid) return [];
  return (await listDeviceRecords()).filter((d) => (d.restaurantId ?? "").trim() === rid);
}

export { ONLINE_THRESHOLD_MS };
