import { describe, expect, it } from "vitest";

import {
  buildKioskMenuUrl,
  isMenuOpenedFromWelcome,
  welcomeHomePathFromMenuParams,
} from "./welcomeEntry";

describe("welcomeEntry", () => {
  it("isMenuOpenedFromWelcome accepts 1 and true", () => {
    expect(isMenuOpenedFromWelcome({ fromWelcome: "1" })).toBe(true);
    expect(isMenuOpenedFromWelcome({ fromWelcome: "true" })).toBe(true);
    expect(isMenuOpenedFromWelcome({ fromWelcome: "0" })).toBe(false);
    expect(isMenuOpenedFromWelcome({})).toBe(false);
  });

  it("welcomeHomePathFromMenuParams preserves deviceId", () => {
    expect(welcomeHomePathFromMenuParams({ deviceId: "tab-1" })).toBe("/?deviceId=tab-1");
    expect(welcomeHomePathFromMenuParams({})).toBe("/");
  });

  it("buildKioskMenuUrl includes fromWelcome", () => {
    const url = buildKioskMenuUrl();
    expect(url.startsWith("/menu?")).toBe(true);
    expect(url).toContain("fromWelcome=1");
  });
});
