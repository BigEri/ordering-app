import { describe, expect, it } from "vitest";

import { extractPosErrorDetail } from "./postPosJson";

describe("extractPosErrorDetail", () => {
  it("reads Storyous till error from order-confirmed body", () => {
    expect(
      extractPosErrorDetail({
        ok: false,
        storyous: { ok: false, error: "Storyous objednávka 400: invalid deskId" },
      }),
    ).toBe("Storyous objednávka 400: invalid deskId");
  });

  it("still reads Dotykačka errors", () => {
    expect(extractPosErrorDetail({ dotykacka: { error: "pos-actions 404" } })).toBe("pos-actions 404");
  });
});
