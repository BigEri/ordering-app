import { describe, expect, it } from "vitest";

import {
  formatSandboxEurFromTillMajor,
  isNexiSandboxPayUrl,
  tillMajorToSandboxEurCents,
} from "./sandboxEur";

describe("tillMajorToSandboxEurCents", () => {
  it("converts a typical CZK lunch so Nexi shows a meal-sized euro amount", () => {
    expect(tillMajorToSandboxEurCents(189)).toBe(756);
    expect(tillMajorToSandboxEurCents(250)).toBe(1000);
  });

  it("keeps small till totals 1:1 as euro cents (test cloud already in EUR)", () => {
    expect(tillMajorToSandboxEurCents(12)).toBe(1200);
    expect(tillMajorToSandboxEurCents(8.5)).toBe(850);
  });

  it("never sends less than 1 EUR", () => {
    expect(tillMajorToSandboxEurCents(0)).toBe(100);
    expect(tillMajorToSandboxEurCents(1)).toBe(100);
  });
});

describe("formatSandboxEurFromTillMajor", () => {
  it("formats converted CZK as euros", () => {
    expect(formatSandboxEurFromTillMajor(250)).toMatch(/10[,.]00/);
  });
});

describe("isNexiSandboxPayUrl", () => {
  it("detects Nexi hosted sandbox checkout", () => {
    expect(isNexiSandboxPayUrl("https://xpaysandbox.nexigroup.com/pay/abc")).toBe(true);
    expect(isNexiSandboxPayUrl("https://app.tableflow.cz/pay/xpay/demo?pid=1")).toBe(false);
  });
});
