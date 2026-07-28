import { describe, expect, it } from "vitest";

import { assignWelcomeShowcaseSlots, uniqueWelcomeImageUrls, welcomeLayoutVisibleSlotCount } from "./welcomeShowcaseSlots";

describe("assignWelcomeShowcaseSlots", () => {
  it("mosaic with 2 unique falls back to split_half without empty panels", () => {
    const a = assignWelcomeShowcaseSlots(["/a.jpg", "/b.jpg"], "mosaic", 0);
    expect(a.layoutPreset).toBe("split_half");
    expect(a.slots).toHaveLength(2);
    expect(a.slots[0]).toBe("/a.jpg");
    expect(a.slots[1]).toBe("/b.jpg");
    expect(a.sufficient).toBe(false);
    const urls = a.slots.filter(Boolean);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("mosaic with 1 unique falls back to fade", () => {
    const a = assignWelcomeShowcaseSlots(["/a.jpg"], "mosaic", 0);
    expect(a.layoutPreset).toBe("fade");
    expect(a.slots).toEqual(["/a.jpg"]);
  });

  it("mosaic with 3 unique uses three different slots", () => {
    const a = assignWelcomeShowcaseSlots(["/a.jpg", "/b.jpg", "/c.jpg"], "mosaic", 0);
    expect(new Set(a.slots).size).toBe(3);
    expect(a.sufficient).toBe(true);
  });

  it("dedupes duplicate URLs in input", () => {
    expect(uniqueWelcomeImageUrls(["/x", "/x", "/y"])).toEqual(["/x", "/y"]);
  });

  it("grid_four requires 4", () => {
    expect(welcomeLayoutVisibleSlotCount("grid_four")).toBe(4);
  });
});
