import crypto from "crypto";

import { nowIso } from "./db";
import { prisma } from "./prisma";

const CODE_TTL_MS = 60 * 60 * 1000;
const PAIRING_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPairingCode(): string {
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += PAIRING_CODE_CHARS[bytes[i]! % PAIRING_CODE_CHARS.length];
  }
  return s;
}

/**
 * Nový kód pro zařízení bez serverové vazby — staré nevyužité kódy pro stejné zařízení smaže.
 */
export function upsertDevicePairingCode(deviceId: string): { code: string; expiresAtIso: string } {
  const id = deviceId.trim();
  if (!id || id.length > 200) throw new Error("Invalid deviceId");

  void deviceId;
  throw new Error("Use upsertDevicePairingCodeAsync");
}

export async function upsertDevicePairingCodeAsync(
  deviceId: string,
): Promise<{ code: string; expiresAtIso: string }> {
  const id = deviceId.trim();
  if (!id || id.length > 200) throw new Error("Invalid deviceId");

  const createdAtIso = nowIso();
  const expiresAtIso = new Date(Date.now() + CODE_TTL_MS).toISOString();

  await prisma.devicePairingCode.deleteMany({ where: { deviceId: id, usedAtIso: null } });

  for (let attempt = 0; attempt < 30; attempt++) {
    const code = randomPairingCode();
    try {
      await prisma.devicePairingCode.create({
        data: { code, deviceId: id, createdAtIso, expiresAtIso, usedAtIso: null },
      });
      return { code, expiresAtIso };
    } catch {
      // collision, retry
    }
  }
  throw new Error("Could not allocate pairing code");
}

export type PairingRow = {
  deviceId: string;
  expiresAtIso: string;
};

/** Aktivní nevyužitý kód pro zařízení (bez mazání / generování nového). */
export function getUnusedPairingCodeForDevice(deviceId: string): { code: string; expiresAtIso: string } | null {
  void deviceId;
  throw new Error("Use getUnusedPairingCodeForDeviceAsync");
}

export async function getUnusedPairingCodeForDeviceAsync(
  deviceId: string,
): Promise<{ code: string; expiresAtIso: string } | null> {
  const id = deviceId.trim();
  if (!id || id.length > 200) return null;
  const now = nowIso();
  const row = await prisma.devicePairingCode.findFirst({
    where: { deviceId: id, usedAtIso: null, expiresAtIso: { gt: now } },
    orderBy: { createdAtIso: "desc" },
    select: { code: true, expiresAtIso: true },
  });
  if (!row?.code || !row.expiresAtIso) return null;
  return { code: row.code, expiresAtIso: row.expiresAtIso };
}

export function getActivePairingCodeRow(code: string): PairingRow | null {
  void code;
  throw new Error("Use getActivePairingCodeRowAsync");
}

export async function getActivePairingCodeRowAsync(code: string): Promise<PairingRow | null> {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  const row = await prisma.devicePairingCode.findUnique({
    where: { code: c },
    select: { deviceId: true, expiresAtIso: true, usedAtIso: true },
  });
  if (!row?.deviceId || !row.expiresAtIso) return null;
  if (row.usedAtIso) return null;
  if (new Date(row.expiresAtIso).getTime() <= Date.now()) return null;
  return { deviceId: row.deviceId, expiresAtIso: row.expiresAtIso };
}

export function markPairingCodeUsed(code: string): void {
  void code;
  throw new Error("Use markPairingCodeUsedAsync");
}

export async function markPairingCodeUsedAsync(code: string): Promise<void> {
  const c = code.trim().toUpperCase();
  await prisma.devicePairingCode.updateMany({
    where: { code: c, usedAtIso: null },
    data: { usedAtIso: nowIso() },
  });
}
