import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchMenuCacheFromWelcome, resetMenuCacheWarmStateForTests } from "./warmMenuCache";

describe("prefetchMenuCacheFromWelcome", () => {
  afterEach(() => {
    resetMenuCacheWarmStateForTests();
    vi.unstubAllGlobals();
  });

  it("dedupes warm requests per deviceId in one page session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { origin: "http://localhost" } });

    prefetchMenuCacheFromWelcome("tablet-1");
    prefetchMenuCacheFromWelcome("tablet-1");

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/public/warm-menu-cache");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("deviceId=tablet-1");
  });
});
