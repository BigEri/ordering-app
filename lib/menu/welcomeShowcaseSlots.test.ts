import { describe, expect, it } from "vitest";

import { assignWelcomeShowcaseSlots, uniqueWelcomeImageUrls, welcomeLayoutVisibleSlotCount } from "./welcomeShowcaseSlots";

describe("assignWelcomeShowcaseSlots", () => {
  it("mosaic with 2 unique never duplicates in one frame", () => {
    const a = assignWelcomeShowcaseSlots(["/a.jpg", "/b.jpg"], "mosaic", 0);
    expect(a.slots).toHaveLength(3);
    expect(a.slots[0]).toBe("/a.jpg");
    expect(a.slots[1]).toBe("/b.jpg");
    expect(a.slots[2]).toBe("");
    expect(a.sufficient).toBe(false);
    const urls = a.slots.filter(Boolean);
    expect(new Set(urls).size).toBe(urls.length);
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
