import { describe, expect, it } from "vitest";

import { parseKioskBatteryQuery } from "./kioskBatteryTelemetry";

describe("parseKioskBatteryQuery", () => {
  it("reads percent and charging flag", () => {
    expect(parseKioskBatteryQuery({ batteryPercent: "47", batteryCharging: "1" })).toEqual({
      percent: 47,
      charging: true,
    });
    expect(parseKioskBatteryQuery({ batteryPercent: "8", batteryCharging: "0" })).toEqual({
      percent: 8,
      charging: false,
    });
  });

  it("rejects missing or invalid percent", () => {
    expect(parseKioskBatteryQuery({})).toBeNull();
    expect(parseKioskBatteryQuery({ batteryPercent: "", batteryCharging: "1" })).toBeNull();
    expect(parseKioskBatteryQuery({ batteryPercent: "-1", batteryCharging: "1" })).toBeNull();
    expect(parseKioskBatteryQuery({ batteryPercent: "101", batteryCharging: "1" })).toBeNull();
    expect(parseKioskBatteryQuery({ batteryPercent: "abc", batteryCharging: "1" })).toBeNull();
  });

  it("treats true/yes as charging", () => {
    expect(parseKioskBatteryQuery({ batteryPercent: "50", batteryCharging: "true" })?.charging).toBe(true);
    expect(parseKioskBatteryQuery({ batteryPercent: "50", batteryCharging: "yes" })?.charging).toBe(true);
    expect(parseKioskBatteryQuery({ batteryPercent: "50", batteryCharging: "false" })?.charging).toBe(false);
  });
});
