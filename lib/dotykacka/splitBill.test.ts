import { describe, expect, it } from "vitest";

import { appendTipToSplitItems, isTipBillLine, listOpenTipOrderItems, parseXpaySplitItems, pickTipOrderItemId, resolveSplitAgainstBill } from "./splitBill";

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

  it("does not price a leftover tip as this guest's food", () => {
    const r = resolveSplitAgainstBill(
      [...lines, { name: "Spropitné", qty: 1, unitPriceCzk: 19, itemId: 9, orderId: 10 }],
      [
        { orderId: 10, itemId: 2, qty: 1 },
        { orderId: 10, itemId: 9, qty: 1 },
      ],
    );
    expect(r.ok && r.totalCzk).toBe(189);
    expect(r.ok && r.items).toEqual([{ orderId: 10, itemId: 2, qty: 1 }]);
  });
});

describe("split tip line", () => {
  it("moves the paying guest's tip with their items", () => {
    expect(isTipBillLine("Spropitné")).toBe(true);
    expect(isTipBillLine("Burger")).toBe(false);
    expect(appendTipToSplitItems([{ id: 2, qty: 1 }], 99)).toEqual([
      { id: 2, qty: 1 },
      { id: 99, qty: 1 },
    ]);
    expect(appendTipToSplitItems([{ id: 99, qty: 1 }], 99)).toEqual([{ id: 99, qty: 1 }]);
    expect(appendTipToSplitItems([{ id: 2, qty: 1 }], null)).toEqual([{ id: 2, qty: 1 }]);
  });

  it("keeps a new tip row with the guest who paid it", () => {
    const list = {
      code: 0,
      orders: [
        {
          order: { id: 10, paid: false },
          items: [
            { id: 2, name: "Burger", qty: 1, "price-with-vat": { unit: 189 } },
            { id: 9, name: "Spropitné", note: "Spropitné", qty: 1, tags: ["oa-tip"] },
          ],
        },
      ],
    };
    expect(listOpenTipOrderItems(list)).toEqual([{ itemId: 9, orderId: 10, unitPriceCzk: null }]);
    const before = [{ itemId: 5, orderId: 10, unitPriceCzk: 19 }];
    const after = [...before, { itemId: 9, orderId: 10, unitPriceCzk: 8 }];
    expect(pickTipOrderItemId(before, after, 10, 8)).toBe(9);
    expect(pickTipOrderItemId(before, before, 10, 8)).toBeNull();
    expect(pickTipOrderItemId(before, before, 10, 19)).toBe(5);
  });
});
