import { describe, expect, it } from "vitest";

import { restaurantMenuCacheKeyParts } from "./fetchRestaurantMenu";

describe("restaurantMenuCacheKeyParts", () => {
  it("includes Storyous place id so switching venues misses cache", () => {
    expect(restaurantMenuCacheKeyParts("  rid-1  ", "storyous", "place-a")).toEqual([
      "restaurant-menu-v2",
      "rid-1",
      "storyous",
      "place-a",
    ]);
    expect(restaurantMenuCacheKeyParts("rid-1", "storyous", "place-a")).not.toEqual(
      restaurantMenuCacheKeyParts("rid-1", "storyous", "place-b"),
    );
  });

  it("does not use place id for Dotykačka", () => {
    expect(restaurantMenuCacheKeyParts("rid-1", "dotykacka")).toEqual([
      "restaurant-menu-v2",
      "rid-1",
      "dotykacka",
    ]);
  });
});
