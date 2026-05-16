import { describe, expect, it } from "vitest";

import { resolvePosRestaurantForOrder } from "./resolvePosRestaurantTrust";

describe("resolvePosRestaurantForOrder", () => {
  it("uses device binding and rejects client restaurantId mismatch", () => {
    const r = resolvePosRestaurantForOrder({
      deviceId: "dev-1",
      clientRestaurantId: "evil",
      effectiveRestaurantId: "bound-rid",
      restaurantRowCount: 3,
      defaultRestaurantId: null,
    });
    expect(r).toEqual({
      ok: false,
      status: 403,
      error: "Restaurant does not match device binding",
    });
  });

  it("uses device binding when client omits restaurantId", () => {
    const r = resolvePosRestaurantForOrder({
      deviceId: "dev-1",
      clientRestaurantId: "",
      effectiveRestaurantId: "bound-rid",
      restaurantRowCount: 3,
      defaultRestaurantId: null,
    });
    expect(r).toEqual({ ok: true, restaurantId: "bound-rid" });
  });

  it("with multiple restaurants and no binding, rejects even with client restaurantId", () => {
    const r = resolvePosRestaurantForOrder({
      deviceId: "",
      clientRestaurantId: "any",
      effectiveRestaurantId: null,
      restaurantRowCount: 2,
      defaultRestaurantId: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("single-tenant fallback uses default and rejects wrong client id", () => {
    const bad = resolvePosRestaurantForOrder({
      deviceId: "",
      clientRestaurantId: "wrong",
      effectiveRestaurantId: null,
      restaurantRowCount: 1,
      defaultRestaurantId: "only",
    });
    expect(bad).toEqual({ ok: false, status: 403, error: "Restaurant mismatch" });

    const ok = resolvePosRestaurantForOrder({
      deviceId: "",
      clientRestaurantId: "only",
      effectiveRestaurantId: null,
      restaurantRowCount: 1,
      defaultRestaurantId: "only",
    });
    expect(ok).toEqual({ ok: true, restaurantId: "only" });
  });
});
