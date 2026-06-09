import { describe, expect, it, beforeEach } from "vitest";

import {
  getMenuUiOverridesFromCache,
  putMenuUiOverridesInCache,
  resetMenuUiOverridesCache,
  seedMenuUiOverridesCache,
} from "./menuUiOverridesCache";

describe("menuUiOverridesCache", () => {
  beforeEach(() => {
    resetMenuUiOverridesCache(null);
  });

  it("stores and retrieves by locale", () => {
    putMenuUiOverridesInCache("en", {
      text: { items: { "1": { name: "Soup" } }, categories: {} },
      ingredients: { items: {} },
      dotykacka: { groups: {}, options: {} },
    });
    const hit = getMenuUiOverridesFromCache("en");
    expect(hit?.text.items["1"]?.name).toBe("Soup");
  });

  it("clears cache when restaurant changes", () => {
    seedMenuUiOverridesCache("r1", "cs", {
      text: { items: {}, categories: { x: { name: "Polévky" } } },
      ingredients: { items: {} },
      dotykacka: { groups: {}, options: {} },
    });
    seedMenuUiOverridesCache("r2", "cs", {
      text: { items: {}, categories: {} },
      ingredients: { items: {} },
      dotykacka: { groups: {}, options: {} },
    });
    expect(getMenuUiOverridesFromCache("cs")?.text.categories.x).toBeUndefined();
  });
});
