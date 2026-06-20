/**
 * Registr tabletů: presence v paměti + trvalá vazba stůl + restaurace v SQLite (`kiosk_device_bindings`).
 */

import { getDefaultPublicMenuRestaurantIdFromEnv } from "./publicRestaurantName";
import {
  bumpKioskDeviceApkUpdateNonce,
  bumpKioskDeviceReloadNonce,
  getKioskDeviceBinding,
  getKioskDeviceApkUpdateNonce,
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

export function recordKioskApkVersion(deviceId: string, versionCode: number) {
  const id = deviceId.trim();
  if (!id || !Number.isFinite(versionCode) || versionCode < 1) return;
  const prev = presenceByDevice.get(id);
  if (prev) {
    presenceByDevice.set(id, { ...prev, kioskApkVersionCode: versionCode, lastSeen: Date.now() });
  } else {
    presenceByDevice.set(id, {
      deviceId: id,
      tableId: "",
      tableLabel: "",
      lastSeen: Date.now(),
      kioskApkVersionCode: versionCode,
    });
  }
  void touchKioskDeviceTelemetry(id, { apkVersionCode: versionCode }).catch(() => {});
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
