import * as Sentry from "@sentry/nextjs";

import { SENTRY_IGNORE_ERRORS } from "./lib/sentryIgnoreErrors";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.05,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  ignoreErrors: SENTRY_IGNORE_ERRORS,
});
