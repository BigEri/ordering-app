import { describe, expect, it } from "vitest";

import { welcomeShowcaseCacheTag } from "./welcomeShowcaseCached";

describe("welcomeShowcaseCached tags", () => {
  it("welcomeShowcaseCacheTag trims restaurant id", () => {
    expect(welcomeShowcaseCacheTag("  rid-1  ")).toBe("welcome-showcase-rid-1");
  });
});
