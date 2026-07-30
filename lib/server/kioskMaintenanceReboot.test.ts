import { describe, expect, it } from "vitest";

import {
  DEFAULT_KIOSK_MAINTENANCE_REBOOT_HOUR,
  DEFAULT_KIOSK_MAINTENANCE_REBOOT_MINUTE,
  normalizeKioskMaintenanceRebootHour,
  normalizeKioskMaintenanceRebootMinute,
  resolveKioskMaintenanceRebootSchedule,
} from "./kioskMaintenanceReboot";

describe("kioskMaintenanceReboot", () => {
  it("normalizes hour/minute bounds", () => {
    expect(normalizeKioskMaintenanceRebootHour(4)).toBe(4);
    expect(normalizeKioskMaintenanceRebootHour(23)).toBe(23);
    expect(normalizeKioskMaintenanceRebootHour(24)).toBeNull();
    expect(normalizeKioskMaintenanceRebootHour(-1)).toBeNull();
    expect(normalizeKioskMaintenanceRebootMinute(0)).toBe(0);
    expect(normalizeKioskMaintenanceRebootMinute(59)).toBe(59);
    expect(normalizeKioskMaintenanceRebootMinute(60)).toBeNull();
  });

  it("resolves null DB to default 4:00", () => {
    expect(resolveKioskMaintenanceRebootSchedule(null, null)).toEqual({
      hour: DEFAULT_KIOSK_MAINTENANCE_REBOOT_HOUR,
      minute: DEFAULT_KIOSK_MAINTENANCE_REBOOT_MINUTE,
    });
    expect(resolveKioskMaintenanceRebootSchedule(3, 30)).toEqual({ hour: 3, minute: 30 });
  });
});
