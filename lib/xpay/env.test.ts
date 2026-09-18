import { afterEach, describe, expect, it } from "vitest";

import { parseXpayEnvironment, XPAY_PRODUCTION_API_BASE, XPAY_SANDBOX_API_BASE, xpayApiBaseFor } from "./env";

describe("parseXpayEnvironment", () => {
  it("defaults to sandbox", () => {
    expect(parseXpayEnvironment(undefined)).toBe("sandbox");
    expect(parseXpayEnvironment("production")).toBe("production");
  });
});

describe("xpayApiBaseFor", () => {
  const prev = process.env.XPAY_API_BASE;

  afterEach(() => {
    if (prev === undefined) delete process.env.XPAY_API_BASE;
    else process.env.XPAY_API_BASE = prev;
  });

  it("picks sandbox vs production hosts", () => {
    delete process.env.XPAY_API_BASE;
    expect(xpayApiBaseFor("sandbox")).toBe(XPAY_SANDBOX_API_BASE);
    expect(xpayApiBaseFor("production")).toBe(XPAY_PRODUCTION_API_BASE);
  });
});
