import { describe, expect, it } from "vitest";

import { buildXpaySandboxCzkDemo, isXpaySandboxDemoPayUrl } from "./sandboxDemo";

describe("sandbox CZK demo URL", () => {
  it("builds a Tableflow demo checkout in CZK", () => {
    const built = buildXpaySandboxCzkDemo({ appBase: "https://app.tableflow.cz", paymentId: "tfabc" });
    expect(built.linkId).toBeNull();
    expect(built.securityToken.length).toBeGreaterThan(8);
    expect(built.payUrl).toContain("/pay/xpay/demo?");
    expect(built.payUrl).toContain("pid=tfabc");
    expect(isXpaySandboxDemoPayUrl(built.payUrl)).toBe(true);
  });
});
