import { describe, expect, it } from "vitest";

import {
  buildXpayOrderId,
  classifyXpayOperation,
  czkToHalere,
  extractXpayLinkId,
  extractXpayOrderId,
  extractXpayPayUrl,
  extractXpaySecurityToken,
  formatXpayHttpError,
  halereToCzk,
  xpayLanguageFromLocale,
  xpayLinkExpirationIso,
} from "./parse";

describe("extractXpayOrderId", () => {
  it("reads top-level orderId", () => {
    expect(extractXpayOrderId({ orderId: "tfabc" })).toBe("tfabc");
  });

  it("reads nested order.orderId", () => {
    expect(extractXpayOrderId({ order: { orderId: "nested-1" } })).toBe("nested-1");
  });
});

describe("extractXpayPayUrl / linkId", () => {
  it("reads paymentLink.link and linkId from Nexi pay-by-link payload", () => {
    const payload = {
      paymentLink: { link: "https://xpaysandbox.nexigroup.com/pay/abc", linkId: "lnk-9" },
      securityToken: "tok-1",
    };
    expect(extractXpayPayUrl(payload)).toBe("https://xpaysandbox.nexigroup.com/pay/abc");
    expect(extractXpayLinkId(payload)).toBe("lnk-9");
    expect(extractXpaySecurityToken(payload)).toBe("tok-1");
  });

  it("reads paymentLinks[] from list-style payloads", () => {
    expect(
      extractXpayPayUrl({
        paymentLinks: [{ link: "https://xpaysandbox.nexigroup.com/pay/arr", linkId: "lnk-arr" }],
      }),
    ).toBe("https://xpaysandbox.nexigroup.com/pay/arr");
    expect(
      extractXpayLinkId({
        paymentLinks: [{ link: "https://xpaysandbox.nexigroup.com/pay/arr", linkId: "lnk-arr" }],
      }),
    ).toBe("lnk-arr");
  });
});

describe("classifyXpayOperation", () => {
  it("treats AUTHORIZED / EXECUTED as paid", () => {
    expect(classifyXpayOperation({ operationResult: "AUTHORIZED" })).toBe("paid");
    expect(classifyXpayOperation({ orderStatus: "EXECUTED" })).toBe("paid");
  });

  it("treats DECLINED as failed", () => {
    expect(classifyXpayOperation({ operationResult: "DECLINED" })).toBe("failed");
  });

  it("defaults to pending", () => {
    expect(classifyXpayOperation({ status: "CREATED" })).toBe("pending");
  });
});

describe("amounts and order id", () => {
  it("converts CZK to halere and back", () => {
    expect(czkToHalere(159)).toBe(15900);
    expect(halereToCzk(15900)).toBe(159);
  });

  it("builds XPay orderId within 27 alphanumeric chars", () => {
    const id = buildXpayOrderId();
    expect(id.startsWith("tf")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(27);
    expect(id).toMatch(/^tf[0-9a-f]+$/);
  });
});

describe("xpayLanguageFromLocale", () => {
  it("maps kiosk locales", () => {
    expect(xpayLanguageFromLocale("cs")).toBe("CES");
    expect(xpayLanguageFromLocale("en")).toBe("ENG");
    expect(xpayLanguageFromLocale("ko")).toBe("KOR");
    expect(xpayLanguageFromLocale(null)).toBe("CES");
  });
});

describe("formatXpayHttpError", () => {
  it("explains CZK not supported on the Nexi demo terminal", () => {
    expect(
      formatXpayHttpError(400, "", {
        errors: [{ code: "400", description: "Currency from request is not supported by terminal" }],
      }),
    ).toMatch(/nepřijímá CZK/);
  });
});

describe("xpayLinkExpirationIso", () => {
  it("returns ISO timestamp in the future", () => {
    const from = Date.parse("2026-09-18T12:00:00.000Z");
    expect(xpayLinkExpirationIso(from, 2)).toBe("2026-09-18T14:00:00.000Z");
  });
});
