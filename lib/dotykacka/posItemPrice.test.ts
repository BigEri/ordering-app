import { describe, expect, it } from "vitest";

import { priceCzkFromDotykackaProduct, unitPriceCzkFromPosOrderItem } from "./posItemPrice";

describe("unitPriceCzkFromPosOrderItem", () => {
  it("reads unit-billed from price-with-vat object", () => {
    expect(
      unitPriceCzkFromPosOrderItem({
        name: "Kola",
        qty: 1,
        "price-with-vat": { "unit-billed": 29.6 },
      }),
    ).toBe(30);
  });

  it("reads scalar price-with-vat", () => {
    expect(
      unitPriceCzkFromPosOrderItem({
        name: "Kola",
        qty: 1,
        "price-with-vat": 29.6,
      }),
    ).toBe(30);
  });

  it("reads camelCase unitPriceWithVat on item", () => {
    expect(
      unitPriceCzkFromPosOrderItem({
        name: "Polévka",
        qty: 1,
        unitPriceWithVat: 45,
      }),
    ).toBe(45);
  });
});

describe("priceCzkFromDotykackaProduct", () => {
  it("uses priceWithVat when set", () => {
    expect(priceCzkFromDotykackaProduct({ priceWithVat: 29.6 })).toBe(30);
  });

  it("uses product vat multiplier for net price", () => {
    expect(
      priceCzkFromDotykackaProduct({
        priceWithoutVat: 26.428571,
        vat: 1.12,
      }),
    ).toBe(30);
  });
});
