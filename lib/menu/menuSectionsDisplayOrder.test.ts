import { describe, expect, it } from "vitest";

import { isSupplementMenuCategorySection, orderMenuSectionsLikeKiosk } from "./menuSectionsDisplayOrder";
import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

function sec(
  partial: Partial<DotykackaMenuSection> & { name: string; items: DotykackaMenuSection["items"] },
): DotykackaMenuSection {
  return {
    categoryId: partial.categoryId ?? 1,
    name: partial.name,
    sortOrder: partial.sortOrder ?? 0,
    items: partial.items,
    labelKey: partial.labelKey,
  };
}

describe("orderMenuSectionsLikeKiosk", () => {
  it("řadí položky podle orderByCategory a doplňky za hlavní jídla", () => {
    const sections = [
      sec({
        categoryId: 10,
        name: "Doplňky",
        sortOrder: 1,
        items: [{ id: "d1", name: "Omáčka", priceCzk: 10 }],
      }),
      sec({
        categoryId: 20,
        name: "Hlavní",
        sortOrder: 2,
        items: [
          { id: "b", name: "Burger", priceCzk: 100 },
          { id: "a", name: "Řízek", priceCzk: 120 },
        ],
      }),
    ];

    const out = orderMenuSectionsLikeKiosk(sections, {
      orderByCategory: { "20": ["a", "b"] },
    });

    expect(out.map((s) => s.name)).toEqual(["Hlavní", "Doplňky"]);
    expect(out[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("skryje hidden kategorie a položky", () => {
    const sections = [
      sec({
        categoryId: 1,
        name: "Skrytá",
        sortOrder: 0,
        items: [{ id: "x", name: "X", priceCzk: 1 }],
      }),
      sec({
        categoryId: 2,
        name: "Viditelná",
        sortOrder: 1,
        items: [
          { id: "h", name: "Hidden", priceCzk: 1 },
          { id: "v", name: "Vidět", priceCzk: 2 },
        ],
      }),
    ];

    const out = orderMenuSectionsLikeKiosk(sections, {
      hiddenCategoryKeys: ["1"],
      hiddenItemIds: ["h"],
    });

    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("Viditelná");
    expect(out[0]!.items.map((i) => i.id)).toEqual(["v"]);
  });
});

describe("isSupplementMenuCategorySection", () => {
  it("rozpozná Doplňky", () => {
    expect(isSupplementMenuCategorySection(sec({ name: "Doplňky", items: [] }))).toBe(true);
    expect(isSupplementMenuCategorySection(sec({ name: "Polévky", items: [] }))).toBe(false);
  });
});
