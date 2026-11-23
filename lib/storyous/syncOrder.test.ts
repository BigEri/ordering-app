import { describe, expect, it } from "vitest";

import { findStoryousSignalProductId } from "./mapMenu";
import { buildStoryousDeliveryItems } from "./syncOrder";

describe("buildStoryousDeliveryItems", () => {
  it("maps menu lines to delivery items", () => {
    expect(
      buildStoryousDeliveryItems([
        { menuItemId: "p:of", name: "Old Fashioned", qty: 2, unitPriceCzk: 180 },
        { menuItemId: "  ", name: "skip", qty: 1, unitPriceCzk: 10 },
      ]),
    ).toEqual([{ itemId: "p:of", count: 2, unitPriceWithVat: 180, note: "Old Fashioned" }]);
  });
});

describe("findStoryousSignalProductId", () => {
  it("picks a 0 Kč variable item", () => {
    expect(
      findStoryousSignalProductId({
        items: [
          {
            categoryId: "c:x",
            name: "X",
            items: [
              {
                productId: "p:dummy",
                name: "Variabilní položka 0%",
                isPriceVariable: true,
                placeValues: { priceLevels: { default: { price: 0 } }, showInPos: true },
              },
              {
                productId: "p:of",
                name: "Old Fashioned",
                placeValues: { priceLevels: { default: { price: 180 } }, showInPos: true },
              },
            ],
          },
        ],
      }),
    ).toBe("p:dummy");
  });

  it("does not pick a sold-out dish instead of the 0 Kč dummy", () => {
    expect(
      findStoryousSignalProductId({
        items: [
          {
            categoryId: "c:x",
            name: "X",
            items: [
              {
                productId: "p:gone",
                name: "Vyprodané",
                placeValues: { priceLevels: { default: { price: 80 } }, showInPos: true, quantity: 0 },
              },
              {
                productId: "p:dummy",
                name: "Variabilní položka 0%",
                isPriceVariable: true,
                placeValues: { priceLevels: { default: { price: 0 } }, showInPos: true },
              },
            ],
          },
        ],
      }),
    ).toBe("p:dummy");
  });

  it("returns null when the menu has no 0 Kč dummy", () => {
    expect(
      findStoryousSignalProductId({
        items: [
          {
            categoryId: "c:x",
            name: "X",
            items: [
              {
                productId: "p:gone",
                name: "Vyprodané",
                placeValues: { priceLevels: { default: { price: 80 } }, showInPos: true, quantity: 0 },
              },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("still picks a 0 Kč dummy that has quantity 0", () => {
    expect(
      findStoryousSignalProductId({
        items: [
          {
            categoryId: "c:x",
            name: "X",
            items: [
              {
                productId: "p:dummy",
                name: "Variabilní položka 0%",
                isPriceVariable: true,
                placeValues: { priceLevels: { default: { price: 0 } }, showInPos: true, quantity: 0 },
              },
            ],
          },
        ],
      }),
    ).toBe("p:dummy");
  });
});
