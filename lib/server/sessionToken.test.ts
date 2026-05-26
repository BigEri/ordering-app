import { afterEach, describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "./sessionToken";

describe("sessionToken", () => {
  const prev = process.env.APP_AUTH_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.APP_AUTH_SECRET;
    else process.env.APP_AUTH_SECRET = prev;
  });

  it("round-trips a valid token", () => {
    process.env.APP_AUTH_SECRET = "test-secret-for-unit-tests-only";
    const token = createSessionToken({
      userId: "u1",
      email: "a@b.cz",
      globalRole: "USER",
      sv: 0,
    });
    const payload = verifySessionToken(token);
    expect(payload?.userId).toBe("u1");
    expect(payload?.email).toBe("a@b.cz");
  });

  it("rejects tampered signature", () => {
    process.env.APP_AUTH_SECRET = "test-secret-for-unit-tests-only";
    const token = createSessionToken({
      userId: "u1",
      email: "a@b.cz",
      globalRole: "USER",
      sv: 0,
    });
    const bad = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(bad)).toBeNull();
  });
});
