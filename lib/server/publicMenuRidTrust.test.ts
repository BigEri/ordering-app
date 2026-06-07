import { describe, expect, it } from "vitest";

import { isPublicMenuRidQueryTrusted } from "./publicMenuRidTrust";

describe("isPublicMenuRidQueryTrusted", () => {
  it("allows rid matching kiosk cookie", () => {
    expect(
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: "r-a",
        kioskRestaurantId: "r-a",
        adminRestaurantId: null,
        defaultSingletonRestaurantId: null,
      }),
    ).toBe(true);
  });

  it("allows rid matching device binding", () => {
    expect(
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: "r-device",
        kioskRestaurantId: "",
        adminRestaurantId: null,
        deviceBoundRestaurantId: "r-device",
        defaultSingletonRestaurantId: null,
      }),
    ).toBe(true);
  });

  it("allows rid matching admin active restaurant", () => {
    expect(
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: "r-b",
        kioskRestaurantId: "",
        adminRestaurantId: "r-b",
        defaultSingletonRestaurantId: null,
      }),
    ).toBe(true);
  });

  it("allows rid matching default singleton (single-tenant / env)", () => {
    expect(
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: "only-one",
        kioskRestaurantId: "",
        adminRestaurantId: null,
        defaultSingletonRestaurantId: "only-one",
      }),
    ).toBe(true);
  });

  it("rejects rid that does not match any trusted context (tenant B cannot be opened by URL alone)", () => {
    expect(
      isPublicMenuRidQueryTrusted({
        ridQueryTrimmed: "tenant-b-secret",
        kioskRestaurantId: "tenant-a",
        adminRestaurantId: null,
        defaultSingletonRestaurantId: null,
      }),
    ).toBe(false);
  });
});
