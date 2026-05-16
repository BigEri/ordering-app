import { describe, expect, it } from "vitest";

import { cookieValueFromHeader } from "./httpCookie";

describe("cookieValueFromHeader", () => {
  it("parses cookie value", () => {
    expect(cookieValueFromHeader("a=1; oa_rid=rest-1; b=2", "oa_rid")).toBe("rest-1");
  });

  it("returns empty when missing", () => {
    expect(cookieValueFromHeader("a=1", "oa_rid")).toBe("");
    expect(cookieValueFromHeader(null, "oa_rid")).toBe("");
  });
});
