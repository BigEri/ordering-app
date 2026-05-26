import { describe, expect, it } from "vitest";

import { resolveImageMime, sniffImageMime } from "./imageMime";

describe("imageMime", () => {
  it("sniffs jpeg from magic bytes", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffImageMime(buf)).toBe("image/jpeg");
  });

  it("prefers sniff when browser sends octet-stream", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(resolveImageMime(buf, "application/octet-stream")).toBe("image/jpeg");
  });

  it("keeps declared jpeg when valid", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(resolveImageMime(buf, "image/jpeg")).toBe("image/jpeg");
  });
});
