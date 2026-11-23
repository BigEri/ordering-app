import { describe, expect, it } from "vitest";

import { BILL_EMPTY_CODE, tillErrorCodeFromBody } from "./tillErrorCodes";

describe("tillErrorCodeFromBody", () => {
  it("reads the code from the till failure", () => {
    expect(tillErrorCodeFromBody({ ok: false, till: { ok: false, code: BILL_EMPTY_CODE } })).toBe(BILL_EMPTY_CODE);
    expect(tillErrorCodeFromBody({ storyous: { code: BILL_EMPTY_CODE } })).toBe(BILL_EMPTY_CODE);
    expect(tillErrorCodeFromBody({ code: BILL_EMPTY_CODE })).toBe(BILL_EMPTY_CODE);
  });

  it("ignores other failures", () => {
    expect(tillErrorCodeFromBody({ ok: false, till: { ok: false, error: "502" } })).toBeUndefined();
    expect(tillErrorCodeFromBody({ code: "OTHER" })).toBeUndefined();
    expect(tillErrorCodeFromBody(null)).toBeUndefined();
    expect(tillErrorCodeFromBody([BILL_EMPTY_CODE])).toBeUndefined();
  });
});
