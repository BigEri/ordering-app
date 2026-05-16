import { NextResponse } from "next/server";

import { hasDatabaseUrl } from "../../../lib/server/dbConfig";
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
    return NextResponse.json({
      ok: true,
      database: "connected",
      appAuthSecret: Boolean(process.env.APP_AUTH_SECRET?.trim()),
      publicAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
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
