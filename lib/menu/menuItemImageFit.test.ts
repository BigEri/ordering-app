import { describe, expect, it } from "vitest";

import { resolveMenuItemImageFit } from "./menuItemImageFit";

describe("resolveMenuItemImageFit", () => {
  it("uses contain for tall product photos", () => {
    expect(resolveMenuItemImageFit(800, 1200)).toEqual({ objectFit: "contain", objectPosition: "center" });
  });

  it("uses cover with upper bias for slightly tall photos", () => {
    expect(resolveMenuItemImageFit(1000, 1050)).toEqual({ objectFit: "cover", objectPosition: "center 30%" });
  });

  it("uses cover centered for landscape food shots", () => {
    expect(resolveMenuItemImageFit(1200, 800)).toEqual({ objectFit: "cover", objectPosition: "center" });
  });
});
