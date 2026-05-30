import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { isSentryConfigured } from "../../../../lib/server/integrationsStatus";

export const dynamic = "force-dynamic";

/** Odešle testovací událost do Sentry (jen pokud je nastavené DSN). */
export async function POST(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
    if (!isSentryConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sentry není zapnuté — na Vercelu nastavte NEXT_PUBLIC_SENTRY_DSN (a redeploy).",
        },
        { status: 400 },
      );
    }
    const eventId = Sentry.captureMessage("ordering-app: test ze administrace (Zařízení)", "info");
    await Sentry.flush(2000);
    return NextResponse.json({ ok: true, eventId: eventId ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}
