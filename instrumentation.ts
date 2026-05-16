import type { InstrumentationOnRequestError } from "next/dist/server/instrumentation/types";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: InstrumentationOnRequestError = async (error, errorRequest, errorContext) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(error, errorRequest, {
    routerKind: errorContext.routerKind,
    routePath: errorContext.routePath,
    routeType: errorContext.routeType,
  });
};
