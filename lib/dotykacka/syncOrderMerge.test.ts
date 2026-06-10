import { describe, expect, it } from "vitest";

import {
  pickTargetOpenOrdersForMerge,
  shouldRelistOrdersAfterCreateFailure,
  shouldTryNextOpenOrder,
} from "./syncOrderMerge";

describe("pickTargetOpenOrdersForMerge", () => {
  const session = "ordering-app-1-2-dev-table-5";

  it("returns empty for no orders", () => {
    expect(pickTargetOpenOrdersForMerge([], session)).toEqual([]);
  });

  it("prefers session external-id", () => {
    const orders = [
      { orderId: 10, externalId: "other" },
      { orderId: 20, externalId: session },
    ];
    expect(pickTargetOpenOrdersForMerge(orders, session)).toEqual([{ orderId: 20, externalId: session }]);
  });

  it("uses sole open order when session id missing", () => {
    const orders = [{ orderId: 99, externalId: "staff-manual" }];
    expect(pickTargetOpenOrdersForMerge(orders, session)).toEqual(orders);
  });

  it("prefers order without external-id when multiple on table", () => {
    const orders = [
      { orderId: 1, externalId: "a" },
      { orderId: 2 },
      { orderId: 3, externalId: "b" },
    ];
    expect(pickTargetOpenOrdersForMerge(orders, session)).toEqual([{ orderId: 2 }]);
  });

  it("falls back to first when all have external-id", () => {
    const orders = [
      { orderId: 1, externalId: "a" },
      { orderId: 2, externalId: "b" },
    ];
    expect(pickTargetOpenOrdersForMerge(orders, session)).toEqual([{ orderId: 1, externalId: "a" }]);
  });
});

describe("shouldRelistOrdersAfterCreateFailure", () => {
  it("relists on lock and not-empty", () => {
    expect(shouldRelistOrdersAfterCreateFailure(2001)).toBe(true);
    expect(shouldRelistOrdersAfterCreateFailure(2009)).toBe(true);
    expect(shouldRelistOrdersAfterCreateFailure(undefined)).toBe(true);
  });

  it("skips relist on hard product errors", () => {
    expect(shouldRelistOrdersAfterCreateFailure(1002)).toBe(false);
  });
});

describe("shouldTryNextOpenOrder", () => {
  it("tries next on lock and not found", () => {
    expect(shouldTryNextOpenOrder(2001)).toBe(true);
    expect(shouldTryNextOpenOrder(2002)).toBe(true);
    expect(shouldTryNextOpenOrder(2009)).toBe(false);
  });
});
