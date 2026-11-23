import { describe, expect, it } from "vitest";

import { decideTableBillApply } from "./tableBillApply";

const steak = { name: "Steak", qty: 1, unitPriceCzk: 189 };

describe("decideTableBillApply", () => {
  it("applies an open till bill", () => {
    expect(
      decideTableBillApply({
        open: true,
        lines: [steak],
        totalCzk: 189,
        hadOpenBillFromTill: false,
        splitPayContinue: false,
      }),
    ).toEqual({ action: "apply", lines: [steak], totalCzk: 189 });
  });

  it("keeps local orders when Dotypos has not opened the check yet", () => {
    expect(
      decideTableBillApply({
        open: false,
        lines: [],
        totalCzk: 0,
        hadOpenBillFromTill: false,
        splitPayContinue: false,
      }),
    ).toEqual({ action: "keep-local" });
  });

  it("keeps local orders when the till is open but lines did not parse", () => {
    expect(
      decideTableBillApply({
        open: true,
        lines: [],
        totalCzk: 0,
        hadOpenBillFromTill: true,
        splitPayContinue: false,
      }),
    ).toEqual({ action: "keep-local" });
  });

  it("keeps local orders during split-pay catch-up", () => {
    expect(
      decideTableBillApply({
        open: false,
        lines: [],
        totalCzk: 0,
        hadOpenBillFromTill: true,
        splitPayContinue: true,
      }),
    ).toEqual({ action: "keep-local" });
  });

  it("closes after the till had an open bill and then reports none", () => {
    expect(
      decideTableBillApply({
        open: false,
        lines: [],
        totalCzk: 0,
        hadOpenBillFromTill: true,
        splitPayContinue: false,
      }),
    ).toEqual({ action: "close-issued" });
  });
});
