import { describe, expect, it } from "vitest";

import { dotykackaMenuCacheTag, invalidateDotykackaMenuCache } from "./menuCache";

describe("menuCache", () => {
  it("dotykackaMenuCacheTag trims restaurant id", () => {
    expect(dotykackaMenuCacheTag("  rid-1  ")).toBe("menu-products-rid-1");
  });

  it("invalidateDotykackaMenuCache ignores empty id", () => {
    expect(() => invalidateDotykackaMenuCache("")).not.toThrow();
  });
});
