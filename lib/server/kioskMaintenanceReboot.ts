/** Výchozí místní čas týdenního údržbového restartu kiosk tabletu. */
export const DEFAULT_KIOSK_MAINTENANCE_REBOOT_HOUR = 4;
export const DEFAULT_KIOSK_MAINTENANCE_REBOOT_MINUTE = 0;

export type KioskMaintenanceRebootSchedule = {
  hour: number;
  minute: number;
};

export function normalizeKioskMaintenanceRebootHour(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 23) return raw;
  if (typeof raw === "string" && /^\d{1,2}$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10);
    if (n >= 0 && n <= 23) return n;
  }
  return null;
}

export function normalizeKioskMaintenanceRebootMinute(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 59) return raw;
  if (typeof raw === "string" && /^\d{1,2}$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10);
    if (n >= 0 && n <= 59) return n;
  }
  return null;
}

/** DB null → výchozí 4:00 pro sync na tablety. */
export function resolveKioskMaintenanceRebootSchedule(
  hour: number | null | undefined,
  minute: number | null | undefined,
): KioskMaintenanceRebootSchedule {
  return {
    hour:
      typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23
        ? hour
        : DEFAULT_KIOSK_MAINTENANCE_REBOOT_HOUR,
    minute:
      typeof minute === "number" && Number.isInteger(minute) && minute >= 0 && minute <= 59
        ? minute
        : DEFAULT_KIOSK_MAINTENANCE_REBOOT_MINUTE,
  };
}
