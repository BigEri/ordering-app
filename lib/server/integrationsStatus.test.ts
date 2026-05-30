import { afterEach, describe, expect, it } from "vitest";

import { isPosNotificationConfigured, isSentryConfigured } from "./integrationsStatus";

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
