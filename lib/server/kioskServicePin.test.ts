import { describe, expect, it } from "vitest";

import {
  buildKioskServicePinCredentials,
  hashKioskServicePin,
  normalizeKioskServicePin,
} from "./kioskServicePin";

describe("kioskServicePin", () => {
  it("normalizeKioskServicePin accepts 4–12 digits", () => {
    expect(normalizeKioskServicePin("2580")).toBe("2580");
    expect(normalizeKioskServicePin(" 123456 ")).toBe("123456");
    expect(normalizeKioskServicePin("12")).toBeNull();
    expect(normalizeKioskServicePin("abcd")).toBeNull();
    expect(normalizeKioskServicePin(1234)).toBeNull();
  });

  it("hash matches pin+salt sha256 hex", () => {
    const hash = hashKioskServicePin("2580", "abc");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashKioskServicePin("2580", "abc"));
    expect(hash).not.toBe(hashKioskServicePin("2581", "abc"));
  });

  it("buildKioskServicePinCredentials returns salt+hash", () => {
    const c = buildKioskServicePinCredentials("2580");
    expect(c.kioskServicePinSalt.length).toBeGreaterThan(8);
    expect(c.kioskServicePinHash).toBe(hashKioskServicePin("2580", c.kioskServicePinSalt));
  });
});
