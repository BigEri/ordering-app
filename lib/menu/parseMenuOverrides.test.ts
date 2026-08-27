import { describe, expect, it } from "vitest";

import { menuOverridesFromApiJson } from "./parseMenuOverrides";

describe("menuOverridesFromApiJson", () => {
  it("oddělí Pořád od časového okna u stejné sekce", () => {
    const parsed = menuOverridesFromApiJson({
      categoryHours: { lunch: { visibleFrom: "12:00", visibleUntil: "14:00" }, drinks: { visibleFrom: "10:00", visibleUntil: "22:00" } },
      alwaysVisibleCategoryKeys: ["drinks", " drinks ", "drinks"],
    });
    expect(parsed.alwaysVisibleCategoryKeys).toEqual(["drinks"]);
    expect(parsed.categoryHours.lunch).toEqual({ visibleFrom: "12:00", visibleUntil: "14:00" });
    expect(parsed.categoryHours.drinks).toBeUndefined();
  });

  it("pozná Pořád ze sentinel ALWAYS v časech", () => {
    const parsed = menuOverridesFromApiJson({
      categoryHours: {
        lunch: { visibleFrom: "12:00", visibleUntil: "14:00" },
        drinks: { visibleFrom: "ALWAYS", visibleUntil: "ALWAYS" },
      },
    });
    expect(parsed.alwaysVisibleCategoryKeys).toEqual(["drinks"]);
    expect(parsed.categoryHours.drinks).toBeUndefined();
    expect(parsed.categoryHours.lunch).toEqual({ visibleFrom: "12:00", visibleUntil: "14:00" });
  });
});
