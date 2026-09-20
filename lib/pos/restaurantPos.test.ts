import { describe, expect, it } from "vitest";

import { workspaceNavForRestaurant } from "../../components/admin/restaurantWorkspaceNav";
import { parseRestaurantPos, restaurantPosTab } from "./restaurantPos";

describe("parseRestaurantPos", () => {
  it("accepts only Dotykačka and Storyous", () => {
    expect(parseRestaurantPos("dotykacka")).toBe("dotykacka");
    expect(parseRestaurantPos("storyous")).toBe("storyous");
    expect(parseRestaurantPos("xpay")).toBeNull();
    expect(parseRestaurantPos("")).toBeNull();
  });

  it("maps pos to the admin till tab", () => {
    expect(restaurantPosTab("dotykacka")).toBe("dotykacka");
    expect(restaurantPosTab("storyous")).toBe("storyous");
  });
});

describe("workspaceNavForRestaurant", () => {
  it("shows Dotykačka and XPay, hides Storyous", () => {
    const ids = workspaceNavForRestaurant(true, "dotykacka").map((x) => x.id);
    expect(ids).toContain("dotykacka");
    expect(ids).toContain("xpay");
    expect(ids).not.toContain("storyous");
  });

  it("shows Storyous, hides Dotykačka and XPay", () => {
    const ids = workspaceNavForRestaurant(true, "storyous").map((x) => x.id);
    expect(ids).toContain("storyous");
    expect(ids).not.toContain("dotykacka");
    expect(ids).not.toContain("xpay");
  });

  it("hides till tabs until pos is known", () => {
    const ids = workspaceNavForRestaurant(true, null).map((x) => x.id);
    expect(ids).not.toContain("dotykacka");
    expect(ids).not.toContain("xpay");
    expect(ids).not.toContain("storyous");
    expect(ids).toContain("menu");
  });
});
