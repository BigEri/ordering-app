import { describe, expect, it } from "vitest";

import { storyousPaidLookupSinceMs } from "./paidBill";

const NOW = Date.parse("2026-11-22T20:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

describe("storyousPaidLookupSinceMs", () => {
  it("looks a few minutes before the session start", () => {
    expect(storyousPaidLookupSinceMs(NOW - HOUR, NOW)).toBe(NOW - HOUR - 5 * MIN);
  });

  it("caps very old sessions at eight hours", () => {
    expect(storyousPaidLookupSinceMs(NOW - 2 * 24 * HOUR, NOW)).toBe(NOW - 8 * HOUR);
  });

  it("falls back to eight hours without a session start", () => {
    expect(storyousPaidLookupSinceMs(undefined, NOW)).toBe(NOW - 8 * HOUR);
    expect(storyousPaidLookupSinceMs("abc", NOW)).toBe(NOW - 8 * HOUR);
    expect(storyousPaidLookupSinceMs(0, NOW)).toBe(NOW - 8 * HOUR);
  });

  it("never looks into the future", () => {
    expect(storyousPaidLookupSinceMs(NOW + HOUR, NOW)).toBe(NOW);
  });
});
