import { describe, expect, it } from "vitest";

import { parseXpaySplitItems, resolveSplitAgainstBill } from "./splitBill";

const lines = [
  { name: "Rajská", qty: 1, unitPriceCzk: 55, itemId: 1, orderId: 10 },
  { name: "Burger", qty: 1, unitPriceCzk: 189, itemId: 2, orderId: 10 },
  { name: "Pivo", qty: 2, unitPriceCzk: 45, itemId: 3, orderId: 10 },
  { name: "Řízek", qty: 1, unitPriceCzk: 160, itemId: 4, orderId: 10 },
];

describe("parseXpaySplitItems", () => {
  it("reads orderId/itemId/qty", () => {
    expect(parseXpaySplitItems([{ orderId: 10, itemId: 1, qty: 1 }])).toEqual([
      { orderId: 10, itemId: 1, qty: 1 },
    ]);
  });

  it("rejects empty or invalid", () => {
    expect(parseXpaySplitItems([])).toBeNull();
    expect(parseXpaySplitItems([{ orderId: 10, itemId: 1, qty: 0 }])).toBeNull();
  });
});

describe("resolveSplitAgainstBill", () => {
  it("totals selected items for the first guest", () => {
    const r = resolveSplitAgainstBill(lines, [
      { orderId: 10, itemId: 1, qty: 1 },
      { orderId: 10, itemId: 2, qty: 1 },
      { orderId: 10, itemId: 3, qty: 1 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalCzk).toBe(55 + 189 + 45);
      expect(r.coversFullBill).toBe(false);
    }
  });

  it("allows paying one of two beers", () => {
    const r = resolveSplitAgainstBill(lines, [{ orderId: 10, itemId: 3, qty: 1 }]);
    expect(r.ok && r.totalCzk).toBe(45);
  });

  it("flags a full-bill selection", () => {
    const r = resolveSplitAgainstBill(lines, [
      { orderId: 10, itemId: 1, qty: 1 },
      { orderId: 10, itemId: 2, qty: 1 },
      { orderId: 10, itemId: 3, qty: 2 },
      { orderId: 10, itemId: 4, qty: 1 },
    ]);
    expect(r.ok && r.coversFullBill).toBe(true);
  });

  it("rejects qty above the till line", () => {
    const r = resolveSplitAgainstBill(lines, [{ orderId: 10, itemId: 3, qty: 3 }]);
    expect(r.ok).toBe(false);
  });
});
