import { describe, expect, it } from "vitest";

import { isDotykackaAccountLockedError } from "./dotykackaGuestError";

describe("isDotykackaAccountLockedError", () => {
  it("detects the Czech lock message", () => {
    expect(
      isDotykackaAccountLockedError(
        "Dotykačka dočasně zamkla účet u stolu (právě ho někdo otevřel na pokladně).",
      ),
    ).toBe(true);
  });

  it("detects code 2001", () => {
    expect(isDotykackaAccountLockedError("Dotykačka order/add-item selhal (code 2001)")).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isDotykackaAccountLockedError("Chybí produkt pro přivolání obsluhy")).toBe(false);
    expect(isDotykackaAccountLockedError(undefined)).toBe(false);
  });
});
