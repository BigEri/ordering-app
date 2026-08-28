import { describe, expect, it } from "vitest";

import { mapStoryousMenuTree, mapStoryousProductToMenuItem, storyousCategoryNumber } from "./mapMenu";

const priced = {
  placeValues: { priceLevels: { default: { price: 180 } }, showInPos: true },
};

describe("storyousCategoryNumber", () => {
  it("is stable and non-zero", () => {
    expect(storyousCategoryNumber("c:saThrc2dm")).toBe(storyousCategoryNumber("c:saThrc2dm"));
    expect(storyousCategoryNumber("c:saThrc2dm")).toBeGreaterThan(0);
  });
});

describe("mapStoryousProductToMenuItem", () => {
  it("maps a visible product", () => {
    expect(
      mapStoryousProductToMenuItem({
        productId: "p:abc",
        name: "Old Fashioned",
        ...priced,
      }),
    ).toEqual({ id: "p:abc", name: "Old Fashioned", priceCzk: 180 });
  });

  it("skips hidden and dummy variable items", () => {
    expect(
      mapStoryousProductToMenuItem({
        productId: "p:1",
        name: "Hidden",
        placeValues: { priceLevels: { default: { price: 10 } }, showInPos: false },
      }),
    ).toBeNull();
    expect(
      mapStoryousProductToMenuItem({
        productId: "p:2",
        name: "Variabilní položka 21%",
        isPriceVariable: true,
        ...priced,
        placeValues: { priceLevels: { default: { price: 0 } }, showInPos: true },
      }),
    ).toBeNull();
  });
});

describe("mapStoryousMenuTree", () => {
  it("flattens nested categories with products", () => {
    const sections = mapStoryousMenuTree({
      items: [
        {
          categoryId: "c:pivo",
          name: "Pivo",
          items: [],
        },
        {
          categoryId: "c:dezerty",
          name: "Dezerty",
          items: [
            {
              categoryId: "g:muffins",
              name: "Muffins",
              items: [
                { productId: "p:m1", name: "Čoko muffin", ...priced },
              ],
            },
          ],
        },
      ],
    });
    expect(sections.map((s) => s.name)).toEqual(["Muffins"]);
    expect(sections[0]?.items).toEqual([{ id: "p:m1", name: "Čoko muffin", priceCzk: 180 }]);
  });

  it("reads categories/products and placesValues map", () => {
    const sections = mapStoryousMenuTree({
      categories: [
        {
          categoryId: "c:cocktails",
          name: "Cocktails",
          products: [
            {
              productId: "p:of",
              name: "Old Fashioned",
              placesValues: {
                "place-1": { priceLevels: { default: { price: 190 } }, showInPos: true },
              },
            },
          ],
        },
      ],
    });
    expect(sections).toEqual([
      {
        categoryId: storyousCategoryNumber("c:cocktails"),
        name: "Cocktails",
        sortOrder: 0,
        items: [{ id: "p:of", name: "Old Fashioned", priceCzk: 190 }],
      },
    ]);
  });
});
