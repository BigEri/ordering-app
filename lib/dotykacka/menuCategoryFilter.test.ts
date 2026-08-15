import { describe, expect, it } from "vitest";

import { isInternalDotykackaCategoryName, resolveHiddenMenuCategoryIds } from "./menuCategoryFilter";

describe("isInternalDotykackaCategoryName", () => {
  it("skryje přesné i odvozené názvy pool / skladu", () => {
    expect(isInternalDotykackaCategoryName("Přílohy")).toBe(true);
    expect(isInternalDotykackaCategoryName("Přílohy burger")).toBe(true);
    expect(isInternalDotykackaCategoryName("Ingredience")).toBe(true);
    expect(isInternalDotykackaCategoryName("Suroviny")).toBe(true);
    expect(isInternalDotykackaCategoryName("Sklad")).toBe(true);
    expect(isInternalDotykackaCategoryName("Sklad suroviny")).toBe(true);
    expect(isInternalDotykackaCategoryName("Interní položky")).toBe(true);
    expect(isInternalDotykackaCategoryName("Obaly")).toBe(true);
    expect(isInternalDotykackaCategoryName("Spotřební materiál")).toBe(true);
    expect(isInternalDotykackaCategoryName("Warehouse")).toBe(true);
    expect(isInternalDotykackaCategoryName("Sides")).toBe(true);
  });

  it("neskryje běžné sekce jídel a nápojů", () => {
    expect(isInternalDotykackaCategoryName("Hlavní jídla")).toBe(false);
    expect(isInternalDotykackaCategoryName("Nápoje")).toBe(false);
    expect(isInternalDotykackaCategoryName("Piva")).toBe(false);
    expect(isInternalDotykackaCategoryName("Dezerty")).toBe(false);
    expect(isInternalDotykackaCategoryName("Obalené řízky")).toBe(false);
    expect(isInternalDotykackaCategoryName("International beers")).toBe(false);
  });
});

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

  it("skryje kategorii se štítkem sklad", () => {
    const hidden = resolveHiddenMenuCategoryIds([
      { id: 7, name: "Ostatní", display: true, deleted: false, tags: ["sklad"] },
    ]);
    expect(hidden.has(7)).toBe(true);
  });
});
