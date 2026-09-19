import { describe, expect, it } from "vitest";

import { billLineTitleAndDetail, detailAfterTitle } from "./billLineDisplay";
import type { MenuItemData } from "../../components/MenuItem";

const burger = {
  id: "b1",
  name: "Burger",
  priceCzk: 189,
  description: "",
  imageUrl: "",
  category: "x",
  allergens: [],
  ingredients: [],
  addons: [],
} as unknown as MenuItemData;

describe("detailAfterTitle", () => {
  it("keeps dish name and leftover customizations", () => {
    expect(detailAfterTitle("Burger", "Burger (Přílohy: Batátové hranolky)")).toBe("Přílohy: Batátové hranolky");
  });

  it("joins several parenthetical groups", () => {
    expect(detailAfterTitle("Burger", "Burger (bez: cibule) (Přílohy: Salátek)")).toBe("bez: cibule · Přílohy: Salátek");
  });

  it("returns undefined when there is no extra text", () => {
    expect(detailAfterTitle("Pivo", "Pivo")).toBeUndefined();
  });
});

describe("billLineTitleAndDetail", () => {
  it("uses stored detail from the till", () => {
    expect(billLineTitleAndDetail({ name: "Burger", detail: "Batátové hranolky" }, "cs")).toEqual({
      title: "Burger",
      detail: "Batátové hranolky",
    });
  });

  it("reads customizations from a cart snapshot", () => {
    const item = {
      ...burger,
      name: "Burger",
      names: { en: "Burger", ko: "버거" },
      dotykackaCustomizationGroups: [
        {
          id: "g1",
          customizationId: 1,
          sectionLabel: "Přílohy",
          minPick: 1,
          maxPick: 1,
          defaultOptionIds: [],
          options: [{ id: "o1", productId: 9, label: "Batátové hranolky", priceCzk: 0 }],
        },
      ],
    } as unknown as MenuItemData;
    expect(
      billLineTitleAndDetail(
        {
          name: "Burger",
          snapshot: { item, excludedIngredients: [], selectedAddonIds: [], dotykackaPicks: { g1: ["o1"] } },
        },
        "cs",
      ),
    ).toEqual({
      title: "Burger",
      detail: "Přílohy: Batátové hranolky",
    });
  });
});
