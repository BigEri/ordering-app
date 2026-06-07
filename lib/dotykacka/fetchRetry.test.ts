import { describe, expect, it } from "vitest";

import { isTransientFetchError, userFacingDotykackaMenuError } from "./fetchRetry";

describe("fetchRetry", () => {
  it("detects transient fetch errors", () => {
    expect(isTransientFetchError(new Error("fetch failed"))).toBe(true);
    expect(isTransientFetchError(new Error("Dotykačka products 401: x"))).toBe(false);
  });

  it("maps fetch failed to Czech user message", () => {
    expect(userFacingDotykackaMenuError("fetch failed")).toContain("Dočasně se nepodařilo");
    expect(userFacingDotykackaMenuError("Dotykačka products 401: x")).toBe("Dotykačka products 401: x");
  });
});
