import { describe, expect, it } from "vitest";

import { menuOverridesCacheTag, menuUiCacheTag } from "./menuOverridesCached";

describe("menuOverridesCached tags", () => {
  it("menuOverridesCacheTag trims restaurant id", () => {
    expect(menuOverridesCacheTag("  rid-1  ")).toBe("menu-overrides-rid-1");
  });

  it("menuUiCacheTag trims restaurant id", () => {
    expect(menuUiCacheTag("  rid-1  ")).toBe("menu-ui-rid-1");
  });
});
