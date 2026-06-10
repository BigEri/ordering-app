import { describe, expect, it } from "vitest";

import { parseTableOpenBillFromPosListData } from "./tableOpenBill";

describe("parseTableOpenBillFromPosListData", () => {
  it("returns empty for invalid payload", () => {
    expect(parseTableOpenBillFromPosListData(null)).toEqual({
      open: false,
      lines: [],
      totalCzk: 0,
      orderIds: [],
    });
  });

  it("aggregates open orders and items on table", () => {
    const data = {
      code: 0,
      orders: [
        {
          order: {
            id: 10,
            paid: false,
            "price-total": 250,
          },
          items: [
            {
              name: "Pivo 12°",
              qty: 2,
              "price-with-vat": { "unit-billed": 45 },
            },
            {
              name: "Chlebíček",
              qty: 1,
              "price-with-vat": { unit: 160 },
            },
          ],
        },
      ],
    };
    expect(parseTableOpenBillFromPosListData(data)).toEqual({
      open: true,
      lines: [
        { name: "Pivo 12°", qty: 2, unitPriceCzk: 45 },
        { name: "Chlebíček", qty: 1, unitPriceCzk: 160 },
      ],
      totalCzk: 250,
      orderIds: [10],
    });
  });

  it("skips paid or canceled orders", () => {
    const data = {
      code: 0,
      orders: [
        {
          order: { id: 1, paid: true, "price-total": 100 },
          items: [{ name: "X", qty: 1, "price-with-vat": { unit: 100 } }],
        },
        {
          order: { id: 2, paid: false, "canceled-date": "2026-01-01", "price-total": 50 },
          items: [{ name: "Y", qty: 1, "price-with-vat": { unit: 50 } }],
        },
      ],
    };
    expect(parseTableOpenBillFromPosListData(data).open).toBe(false);
  });

  it("falls back line sum when order total missing", () => {
    const data = {
      code: 0,
      orders: [
        {
          order: { id: 3, paid: false },
          items: [{ name: "Káva", qty: 3, "price-with-vat": { "unit-billed": 55 } }],
        },
      ],
    };
    expect(parseTableOpenBillFromPosListData(data).totalCzk).toBe(165);
  });
});
