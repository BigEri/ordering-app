import { describe, expect, it } from "vitest";

import { secureCompareStrings } from "./secureCompare";

describe("secureCompareStrings", () => {
  it("matches equal strings", () => {
    expect(secureCompareStrings("abc", "abc")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(secureCompareStrings("abc", "abd")).toBe(false);
    expect(secureCompareStrings("abc", "ab")).toBe(false);
  });
});
