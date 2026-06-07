import { describe, expect, it } from "vitest";

import { pickPublicMenuRestaurantId } from "./publicMenuRestaurantResolve";

describe("pickPublicMenuRestaurantId", () => {
  it("device binding beats admin active restaurant", () => {
    expect(
      pickPublicMenuRestaurantId({
        fromAdmin: false,
        deviceBoundRestaurantId: "device-rid",
        adminActiveRestaurantId: "admin-rid",
        staffGuestRestaurantId: null,
        trustedRidQuery: null,
        kioskCookieRestaurantId: null,
        defaultRestaurantId: "default-rid",
      }),
    ).toBe("device-rid");
  });

  it("admin active only applies with from=admin when no device binding", () => {
    expect(
      pickPublicMenuRestaurantId({
        fromAdmin: true,
        deviceBoundRestaurantId: null,
        adminActiveRestaurantId: "admin-rid",
        staffGuestRestaurantId: "staff-rid",
        trustedRidQuery: null,
        kioskCookieRestaurantId: "cookie-rid",
        defaultRestaurantId: null,
      }),
    ).toBe("admin-rid");
  });

  it("ignores admin active on guest routes without device binding", () => {
    expect(
      pickPublicMenuRestaurantId({
        fromAdmin: false,
        deviceBoundRestaurantId: null,
        adminActiveRestaurantId: "admin-rid",
        staffGuestRestaurantId: "staff-rid",
        trustedRidQuery: null,
        kioskCookieRestaurantId: "cookie-rid",
        defaultRestaurantId: null,
      }),
    ).toBe("staff-rid");
  });

  it("falls back to kiosk cookie before default", () => {
    expect(
      pickPublicMenuRestaurantId({
        fromAdmin: false,
        deviceBoundRestaurantId: null,
        adminActiveRestaurantId: null,
        staffGuestRestaurantId: null,
        trustedRidQuery: null,
        kioskCookieRestaurantId: "cookie-rid",
        defaultRestaurantId: "default-rid",
      }),
    ).toBe("cookie-rid");
  });
});
