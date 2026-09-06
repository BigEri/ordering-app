import { describe, expect, it } from "vitest";

import { applyMenuItemBadges } from "./applyMenuItemBadges";
import type { DotykackaMenuSection } from "../dotykacka/dotykackaMenuSections";

function sec(items: DotykackaMenuSection["items"]): DotykackaMenuSection {
  return { categoryId: 1, name: "Hlavní", sortOrder: 0, items };
}

describe("applyMenuItemBadges", () => {
  it("připojí štítky k položkám podle id", () => {
    const out = applyMenuItemBadges(
      [
        sec([
          { id: "a", name: "Burger", priceCzk: 100 },
          { id: "b", name: "Salat", priceCzk: 80 },
        ]),
      ],
      { a: ["popular"], b: ["vegan", "recommended"] },
    );
    expect(out[0]!.items[0]!.badges).toEqual(["popular"]);
    expect(out[0]!.items[1]!.badges).toEqual(["vegan", "recommended"]);
  });

  it("prázdná mapa nechá sekce beze změny", () => {
    const sections = [sec([{ id: "a", name: "Burger", priceCzk: 100 }])];
    expect(applyMenuItemBadges(sections, {})).toBe(sections);
  });
});
