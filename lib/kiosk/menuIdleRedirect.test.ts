import { afterEach, describe, expect, it } from "vitest";

import {
  getMenuIdleRedirectMs,
  MENU_IDLE_REDIRECT_MS_DEFAULT,
  shouldPauseMenuIdleRedirect,
} from "./menuIdleRedirect";

describe("menuIdleRedirect", () => {
  const prev = process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS;
    else process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS = prev;
  });

  describe("getMenuIdleRedirectMs", () => {
    it("returns default when env unset", () => {
      delete process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS;
      expect(getMenuIdleRedirectMs()).toBe(MENU_IDLE_REDIRECT_MS_DEFAULT);
    });

    it("reads valid env override", () => {
      process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS = "10000";
      expect(getMenuIdleRedirectMs()).toBe(10_000);
    });

    it("ignores invalid env values", () => {
      process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS = "999";
      expect(getMenuIdleRedirectMs()).toBe(MENU_IDLE_REDIRECT_MS_DEFAULT);
    });
  });

  describe("shouldPauseMenuIdleRedirect", () => {
    it("pauses when cart has items (guest kiosk)", () => {
      expect(
        shouldPauseMenuIdleRedirect({
          menuVariant: "guest",
          cartHasItems: true,
        }),
      ).toBe(true);
    });

    it("does not pause when only Dotykacka table bill is open", () => {
      expect(
        shouldPauseMenuIdleRedirect({
          menuVariant: "guest",
          cartHasItems: false,
        }),
      ).toBe(false);
    });

    it("does not pause with empty cart (scenario 3A)", () => {
      expect(
        shouldPauseMenuIdleRedirect({
          menuVariant: "guest",
          cartHasItems: false,
        }),
      ).toBe(false);
    });

    it("does not pause in admin preview", () => {
      expect(
        shouldPauseMenuIdleRedirect({
          adminPreview: true,
          menuVariant: "guest",
          cartHasItems: true,
        }),
      ).toBe(false);
    });

    it("does not pause in editor variant", () => {
      expect(
        shouldPauseMenuIdleRedirect({
          menuVariant: "editor",
          cartHasItems: true,
        }),
      ).toBe(false);
    });
  });
});
