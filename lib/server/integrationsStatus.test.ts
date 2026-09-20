import { afterEach, describe, expect, it } from "vitest";

import {
  isPosNotificationConfigured,
  isSentryConfigured,
  STORYOUS_CONNECT_HINT,
  storyousIntegrationFromRow,
} from "./integrationsStatus";

describe("integrationsStatus env helpers", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function setEnv(key: string, value: string | undefined) {
    if (!(key in prev)) prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("isSentryConfigured is false without DSN", () => {
    setEnv("SENTRY_DSN", undefined);
    setEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    expect(isSentryConfigured()).toBe(false);
  });

  it("isSentryConfigured is true with public DSN", () => {
    setEnv("SENTRY_DSN", undefined);
    setEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@o0.ingest.sentry.io/0");
    expect(isSentryConfigured()).toBe(true);
  });

  it("isPosNotificationConfigured follows POS_NOTIFICATION_URL", () => {
    setEnv("POS_NOTIFICATION_URL", undefined);
    expect(isPosNotificationConfigured()).toBe(false);
    setEnv("POS_NOTIFICATION_URL", "https://example.com/hook");
    expect(isPosNotificationConfigured()).toBe(true);
  });
});

describe("storyousIntegrationFromRow", () => {
  it("asks to finish setup without restaurant id", () => {
    expect(storyousIntegrationFromRow("", null).hint).toMatch(/Přehledu administrace/);
  });

  it("asks to connect Storyous when there is no row", () => {
    expect(storyousIntegrationFromRow("rid-1", null)).toEqual({
      syncConfigured: false,
      hint: STORYOUS_CONNECT_HINT,
    });
  });

  it("is ready when merchant and place are set", () => {
    expect(
      storyousIntegrationFromRow("rid-1", { disabled: 0, merchantId: "m", placeId: "p" }),
    ).toEqual({ syncConfigured: true, hint: null });
  });
});
