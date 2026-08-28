import { describe, expect, it } from "vitest";

import { countMenuItems, parseDesks, parseMerchantPlaces } from "./parse";

describe("parseMerchantPlaces", () => {
  it("reads merchant name and places", () => {
    const { merchantName, places } = parseMerchantPlaces({
      name: "Pickup merchant",
      places: [
        { placeId: "abc", name: "TableFlow", state: "active" },
        { id: "def", name: "Other" },
      ],
    });
    expect(merchantName).toBe("Pickup merchant");
    expect(places).toEqual([
      { placeId: "abc", name: "TableFlow", state: "active" },
      { placeId: "def", name: "Other", state: null },
    ]);
  });
});

describe("parseDesks", () => {
  it("reads desks from data[]", () => {
    expect(
      parseDesks({
        data: [
          { deskId: "132", name: "Stůl 1", code: "1", type: "desk" },
          { deskId: "133", name: "Stůl 2", code: "2", _removed: true },
        ],
      }),
    ).toEqual([{ deskId: "132", name: "Stůl 1", code: "1" }]);
  });

  it("falls back to deskView sections", () => {
    expect(
      parseDesks({
        sections: [{ name: "defaultSection", desks: [{ deskId: "134", name: "Stůl 3", code: "3" }] }],
      }),
    ).toEqual([{ deskId: "134", name: "Stůl 3", code: "3" }]);
  });
});

describe("countMenuItems", () => {
  it("counts items array", () => {
    expect(countMenuItems({ items: [{}, {}, {}] })).toBe(3);
  });
});
