import { describe, expect, it } from "vitest";

import { resolveHiddenMenuCategoryIds } from "./menuCategoryFilter";

describe("resolveHiddenMenuCategoryIds", () => {
  it("skryje kategorii Přílohy podle názvu", () => {
    const hidden = resolveHiddenMenuCategoryIds([
      { id: 487038182532739, name: "Přílohy", display: true, deleted: false },
      { id: 1, name: "Hlavní jídla", display: true, deleted: false },
    ]);
    expect(hidden.has(487038182532739)).toBe(true);
    expect(hidden.has(1)).toBe(false);
  });

  it("skryje ingredience jako dříve", () => {
    const hidden = resolveHiddenMenuCategoryIds([
      { id: 99, name: "Ingredience", display: true, deleted: false },
    ]);
    expect(hidden.has(99)).toBe(true);
  });
});
