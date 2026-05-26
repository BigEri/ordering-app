import { NextResponse } from "next/server";

import { hasDatabaseUrl } from "../../../lib/server/dbConfig";
import {
  getObjectStorageConfigHint,
  isObjectStorageEnabled,
  objectStorageMode,
} from "../../../lib/server/objectStorage";
import { pruneExpiredPosWebhookCallbacksAsync } from "../../../lib/server/posActionWebhookRegistry";
import { prunePosRequestDedupeAsync } from "../../../lib/server/posRequestDedupe";
import { prisma } from "../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/** Pro monitoring / ladění deploye (Vercel, Neon). */
export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing DATABASE_URL",
        hint: "Set in Vercel Environment Variables, then redeploy. See docs/DEPLOY-VERCEL.md",
      },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    void prunePosRequestDedupeAsync().catch(() => {});
    void pruneExpiredPosWebhookCallbacksAsync().catch(() => {});
    return NextResponse.json({
      ok: true,
      database: "connected",
      imageStorage: objectStorageMode(),
      imageStorageConfigured: isObjectStorageEnabled(),
      imageStorageHint: getObjectStorageConfigHint(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: "Check DATABASE_URL and run: npx prisma migrate deploy",
      },
      { status: 503 },
    );
  }
}
