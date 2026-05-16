import { NextResponse } from "next/server";

import { getDotykackaConfig } from "../../../lib/dotykacka/config";
import { getDefaultPublicMenuRestaurantId } from "../../../lib/server/publicRestaurantName";

export const dynamic = "force-dynamic";

/** Kontrola běhu API a konfigurace POS (bez volání externího systému). */
export async function GET() {
  const fromEnv = getDotykackaConfig();
  const def = await getDefaultPublicMenuRestaurantId();
  const fromRestaurant = def ? getDotykackaConfig(def) : null;
  const dotykackaSync = fromEnv ?? fromRestaurant;

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      pos: {
        externalUrlConfigured: Boolean(process.env.POS_NOTIFICATION_URL),
      },
      sentry: {
        configured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN),
      },
      dotykacka: {
        syncConfigured: dotykackaSync !== null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
