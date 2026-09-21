import { describe, expect, it } from "vitest";

import { orderIdFromPosPayData, pickMoneyLogForTip, pickRecentPaidOrderId } from "./recordPaidTip";

describe("pickMoneyLogForTip", () => {
  it("picks the sale payment for the order", () => {
    expect(
      pickMoneyLogForTip(
        [
          { id: 1, _orderId: 10, transactionType: "SALE", tipAmount: 0, amount: 189 },
          { id: 2, _orderId: 99, transactionType: "SALE", tipAmount: 0, amount: 40 },
        ],
        10,
      ),
    ).toEqual({ id: 1, tipAmount: 0 });
  });

  it("prefers the newest sale when there are several", () => {
    expect(
      pickMoneyLogForTip(
        [
          { id: 4, _orderId: 10, transactionType: "SALE", tipAmount: 0 },
          { id: 8, _orderId: 10, transactionType: "SALE", tipAmount: 15 },
        ],
        10,
      ),
    ).toEqual({ id: 8, tipAmount: 15 });
  });

  it("reads orderId when the cloud omits _orderId", () => {
    expect(pickMoneyLogForTip([{ id: 3, orderId: 10, transactionType: "SALE", tipAmount: 0 }], 10)).toEqual({
      id: 3,
      tipAmount: 0,
    });
  });
});

describe("orderIdFromPosPayData", () => {
  it("reads the paid order from a pos-action response", () => {
    expect(orderIdFromPosPayData({ order: { id: 44, paid: true } })).toBe(44);
  });

  it("prefers the newly paid split order over the original open bill", () => {
    expect(
      orderIdFromPosPayData({
        order: { id: 10, paid: false },
        orders: [{ order: { id: 10, paid: false } }, { order: { id: 81, paid: true } }],
      }),
    ).toBe(81);
  });
});

describe("pickRecentPaidOrderId", () => {
  it("picks the newest paid order on the table", () => {
    expect(
      pickRecentPaidOrderId(
        [
          { id: 3, _tableId: 5, paid: true },
          { id: 9, _tableId: 5, paid: true },
          { id: 12, _tableId: 8, paid: true },
          { id: 11, _tableId: 5, paid: false },
        ],
        5,
      ),
    ).toBe(9);
  });
});
