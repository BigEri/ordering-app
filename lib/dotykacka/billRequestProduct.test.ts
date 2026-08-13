import { afterEach, describe, expect, it } from "vitest";

import {
  DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY,
  buildBillRequestItemNote,
  resolveBillRequestProductId,
} from "./billRequestProduct";

describe("billRequestProduct", () => {
  afterEach(() => {
    delete process.env.DOTYKACKA_BILL_REQUEST_PRODUCT_ID;
  });

  it("resolves product id from product map key", () => {
    expect(
      resolveBillRequestProductId({ [DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY]: -12345 }),
    ).toBe(-12345);
  });

  it("falls back to DOTYKACKA_BILL_REQUEST_PRODUCT_ID", () => {
    process.env.DOTYKACKA_BILL_REQUEST_PRODUCT_ID = "998877";
    expect(resolveBillRequestProductId({})).toBe(998877);
  });

  it("prefers map over env", () => {
    process.env.DOTYKACKA_BILL_REQUEST_PRODUCT_ID = "1";
    expect(resolveBillRequestProductId({ [DOTYKACKA_BILL_REQUEST_PRODUCT_MAP_KEY]: 2 })).toBe(2);
  });

  it("returns undefined when unset", () => {
    expect(resolveBillRequestProductId({})).toBeUndefined();
  });

  it("builds item note with table, payment and totals", () => {
    expect(
      buildBillRequestItemNote({
        tableLabelOrId: "Stůl 12",
        paymentMethodRaw: "CARD",
        ordersTotal: 250,
        tipPct: 10,
        tipAmount: 25,
        billTotal: 275,
        timeLabel: "18:30",
      }),
    ).toBe("CHCE ZAPLATIT: 18:30 · STŮL - 12 · platba Karta · subtotal 250 Kč · tip 10% (25 Kč) · total 275 Kč");
  });
});
