import { describe, expect, it } from "vitest";

import type { RestaurantOverviewItem } from "./restaurantOverview";

function deriveFlags(input: {
  syncConfigured: boolean;
  deviceCount: number;
  menuImageCount: number;
  hasWelcome: boolean;
}): Pick<RestaurantOverviewItem, "onboarding" | "operationalReady" | "fullyOnboarded"> {
  const onboarding = {
    dotykacka: input.syncConfigured,
    device: input.deviceCount >= 1,
    welcome: input.hasWelcome,
    menuPhoto: input.menuImageCount >= 1,
  };
  const operationalReady = onboarding.dotykacka && onboarding.device;
  const fullyOnboarded =
    onboarding.dotykacka && onboarding.device && onboarding.welcome && onboarding.menuPhoto;
  return { onboarding, operationalReady, fullyOnboarded };
}

describe("restaurant overview readiness", () => {
  it("operational requires dotykacka and device only", () => {
    const f = deriveFlags({ syncConfigured: true, deviceCount: 1, menuImageCount: 0, hasWelcome: false });
    expect(f.operationalReady).toBe(true);
    expect(f.fullyOnboarded).toBe(false);
  });

  it("incomplete without dotykacka", () => {
    const f = deriveFlags({ syncConfigured: false, deviceCount: 2, menuImageCount: 5, hasWelcome: true });
    expect(f.operationalReady).toBe(false);
  });
});
