import { describe, expect, it } from "vitest";

import { formatRestaurantLocalHhmm } from "./restaurantLocalTime";

describe("restaurantLocalTime", () => {
  it("formats Europe/Prague in summer (CEST)", () => {
    expect(formatRestaurantLocalHhmm(new Date("2026-06-14T15:46:00.000Z"))).toBe("17:46");
  });

  it("formats Europe/Prague in winter (CET)", () => {
    expect(formatRestaurantLocalHhmm(new Date("2026-01-14T15:46:00.000Z"))).toBe("16:46");
  });
});
