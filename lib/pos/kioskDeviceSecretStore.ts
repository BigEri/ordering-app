/** Tajný klíč tabletu pro POS — nastaví DeviceTableProvider po načtení /api/devices/config. */
let deviceSecret: string | null = null;

export function setKioskDeviceSecretForPos(secret: string | null | undefined): void {
  const s = secret?.trim() ?? "";
  deviceSecret = s || null;
}

export function getKioskDeviceSecretForPos(): string | null {
  return deviceSecret;
}
