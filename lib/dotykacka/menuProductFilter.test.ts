import { describe, expect, it } from "vitest";

import {
  collectRecipeGraphFromIngredientRows,
  emptyRecipeGraph,
  shouldHideStandaloneDotykackaProduct,
} from "./menuProductFilter";

describe("collectRecipeGraphFromIngredientRows", () => {
  it("oddělí surovinu od jídla s recepturou", () => {
    const graph = collectRecipeGraphFromIngredientRows([
      { _parentProductId: 10, _productId: 20, deleted: false },
      { _parentProductId: 10, _productId: 21, deleted: true },
    ]);
    expect(graph.recipeParentProductIds.has(10)).toBe(true);
    expect(graph.ingredientProductIds.has(20)).toBe(true);
    expect(graph.ingredientProductIds.has(21)).toBe(false);
  });
});

describe("shouldHideStandaloneDotykackaProduct", () => {
  const graph = collectRecipeGraphFromIngredientRows([
    { _parentProductId: 100, _productId: 200 },
  ]);

  it("schová surovinu z receptury", () => {
    expect(shouldHideStandaloneDotykackaProduct({ id: 200, name: "Sůl", unit: "Piece" }, graph)).toBe(true);
  });

  it("nechá jídlo, které má recepturu", () => {
    expect(
      shouldHideStandaloneDotykackaProduct({ id: 100, name: "Svíčková", unit: "Piece" }, graph),
    ).toBe(false);
  });

  it("nechá polotovar, který je zároveň jídlem s recepturou", () => {
    const both = collectRecipeGraphFromIngredientRows([
      { _parentProductId: 400, _productId: 200 },
      { _parentProductId: 300, _productId: 400 },
    ]);
    expect(
      shouldHideStandaloneDotykackaProduct({ id: 400, name: "Hranolky", unit: "Piece" }, both),
    ).toBe(false);
  });

  it("nechá surovinu, pokud má customizace (konfigurovatelné jídlo)", () => {
    expect(
      shouldHideStandaloneDotykackaProduct(
        { id: 200, name: "Burger", unit: "Piece", customizations: [{ id: 1, _categoryId: 9 }] },
        graph,
      ),
    ).toBe(false);
  });

  it("schová položku s ruční cenou", () => {
    expect(
      shouldHideStandaloneDotykackaProduct(
        { id: 1, name: "Volná položka", requiresPriceEntry: true, unit: "Piece" },
        emptyRecipeGraph(),
      ),
    ).toBe(true);
  });

  it("schová váženou skladovou jednotku", () => {
    expect(
      shouldHideStandaloneDotykackaProduct(
        { id: 2, name: "Olej", unit: "Kilogram" },
        emptyRecipeGraph(),
      ),
    ).toBe(true);
  });

  it("nechá běžné jídlo v kusech", () => {
    expect(
      shouldHideStandaloneDotykackaProduct(
        { id: 3, name: "Pivo 0,5 l", unit: "Piece" },
        emptyRecipeGraph(),
      ),
    ).toBe(false);
  });

  it("štítek kiosk vynutí zobrazení i u suroviny", () => {
    expect(
      shouldHideStandaloneDotykackaProduct({ id: 200, name: "Sůl", tags: ["kiosk"] }, graph),
    ).toBe(false);
  });

  it("štítek sklad schová položku v běžné kategorii", () => {
    expect(
      shouldHideStandaloneDotykackaProduct(
        { id: 4, name: "Hadřík", unit: "Piece", tags: ["sklad"] },
        emptyRecipeGraph(),
      ),
    ).toBe(true);
  });
});
