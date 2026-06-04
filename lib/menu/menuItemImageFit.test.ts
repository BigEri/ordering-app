import { describe, expect, it } from "vitest";

import { MENU_ITEM_IMAGE_FRAMED } from "./menuItemImageFit";

describe("MENU_ITEM_IMAGE_FRAMED", () => {
  it("always uses contain with blur backdrop for menu cards", () => {
    expect(MENU_ITEM_IMAGE_FRAMED).toEqual({
      objectFit: "contain",
      objectPosition: "center",
      useBlurBackdrop: true,
    });
  });
});
