import { afterEach, describe, expect, it } from "vitest";

import {
  DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY,
  buildStaffCallItemNote,
  resolveStaffCallProductId,
} from "./staffCallProduct";

describe("staffCallProduct", () => {
  afterEach(() => {
    delete process.env.DOTYKACKA_STAFF_CALL_PRODUCT_ID;
  });

  it("resolves product id from product map key", () => {
    expect(
      resolveStaffCallProductId({ [DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY]: -12345 }),
    ).toBe(-12345);
  });

  it("falls back to DOTYKACKA_STAFF_CALL_PRODUCT_ID", () => {
    process.env.DOTYKACKA_STAFF_CALL_PRODUCT_ID = "998877";
    expect(resolveStaffCallProductId({})).toBe(998877);
  });

  it("prefers map over env", () => {
    process.env.DOTYKACKA_STAFF_CALL_PRODUCT_ID = "1";
    expect(resolveStaffCallProductId({ [DOTYKACKA_STAFF_CALL_PRODUCT_MAP_KEY]: 2 })).toBe(2);
  });

  it("returns undefined when unset", () => {
    expect(resolveStaffCallProductId({})).toBeUndefined();
  });

  it("builds item note with table number", () => {
    expect(buildStaffCallItemNote("Stůl 12")).toBe("STŮL - 12 · VOLÁ OBSLUHU");
    expect(buildStaffCallItemNote("7")).toBe("STŮL - 7 · VOLÁ OBSLUHU");
  });
});
