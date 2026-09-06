import { describe, expect, it } from "vitest";

import {
  parseMenuItemBadgeList,
  parseMenuItemBadgesJson,
  toggleMenuItemBadge,
} from "./menuItemBadges";

describe("menuItemBadges", () => {
  it("drží kanonické pořadí a zahodí neznámé klíče", () => {
    expect(parseMenuItemBadgeList(["popular", "nope", "vegan", "recommended"])).toEqual([
      "vegan",
      "recommended",
      "popular",
    ]);
  });

  it("toggle přidá a odebere štítek", () => {
    const withVegan = toggleMenuItemBadge([], "vegan", true);
    expect(withVegan).toEqual(["vegan"]);
    expect(toggleMenuItemBadge(withVegan, "popular", true)).toEqual(["vegan", "popular"]);
    expect(toggleMenuItemBadge(["vegan", "popular"], "vegan", false)).toEqual(["popular"]);
  });

  it("parseMenuItemBadgesJson snese neplatný JSON", () => {
    expect(parseMenuItemBadgesJson("not-json")).toEqual([]);
    expect(parseMenuItemBadgesJson('["vegan"]')).toEqual(["vegan"]);
  });
});
