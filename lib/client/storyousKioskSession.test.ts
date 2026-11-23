import { describe, expect, it } from "vitest";

import { dropDeclinedStoryousOrders, isStoryousPaidBillForSession, TILL_BILL_ORDER_ID } from "./storyousKioskSession";

describe("dropDeclinedStoryousOrders", () => {
  it("removes the order with the declined Storyous id", () => {
    expect(
      dropDeclinedStoryousOrders(
        [
          { id: "new", storyousOrderId: "ord-2" },
          { id: "old", storyousOrderId: "ord-1" },
        ],
        "ord-2",
      ),
    ).toEqual([{ id: "old", storyousOrderId: "ord-1" }]);
  });

  it("drops the newest untracked order when the till id is missing locally", () => {
    expect(
      dropDeclinedStoryousOrders(
        [
          { id: "new" },
          { id: "old", storyousOrderId: "ord-1" },
        ],
        "ord-unknown",
      ),
    ).toEqual([{ id: "old", storyousOrderId: "ord-1" }]);
  });

  it("leaves identified orders when nothing matches", () => {
    expect(
      dropDeclinedStoryousOrders(
        [
          { id: "a", storyousOrderId: "ord-1" },
          { id: "b", storyousOrderId: "ord-2" },
        ],
        "ord-9",
      ),
    ).toEqual([
      { id: "a", storyousOrderId: "ord-1" },
      { id: "b", storyousOrderId: "ord-2" },
    ]);
  });

  it("never drops the bill mirrored from the till", () => {
    expect(dropDeclinedStoryousOrders([{ id: TILL_BILL_ORDER_ID }], "ord-unknown")).toEqual([{ id: TILL_BILL_ORDER_ID }]);
  });
});

describe("isStoryousPaidBillForSession", () => {
  const base = { sessionSinceMs: 1_000_000, firstOpenSeenAtMs: 0, lastPaidBillId: "" };

  it("accepts a bill paid after the session started", () => {
    expect(isStoryousPaidBillForSession({ billId: "B1", paidAtMs: 1_200_000 }, base)).toBe(true);
  });

  it("rejects the bill already handled by the previous session", () => {
    expect(isStoryousPaidBillForSession({ billId: "B1", paidAtMs: 1_200_000 }, { ...base, lastPaidBillId: "B1" })).toBe(
      false,
    );
  });

  it("rejects a bill paid well before the session", () => {
    expect(isStoryousPaidBillForSession({ billId: "B0", paidAtMs: 500_000 }, base)).toBe(false);
  });

  it("anchors on the first open check when the tablet has no own order", () => {
    expect(
      isStoryousPaidBillForSession(
        { billId: "B2", paidAtMs: 2_000_000 },
        { sessionSinceMs: 0, firstOpenSeenAtMs: 1_900_000, lastPaidBillId: "" },
      ),
    ).toBe(true);
  });

  it("needs an anchor", () => {
    expect(
      isStoryousPaidBillForSession(
        { billId: "B3", paidAtMs: 2_000_000 },
        { sessionSinceMs: 0, firstOpenSeenAtMs: 0, lastPaidBillId: "" },
      ),
    ).toBe(false);
  });
});
