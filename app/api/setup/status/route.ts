import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/** Veřejné: zda je potřeba prvotní nastavení (žádný uživatel). */
export async function GET() {
  const cnt = await prisma.user.count();
  const needsSetup = cnt === 0;
  const bootstrapConfigured = Boolean(process.env.BOOTSTRAP_TOKEN?.trim());
  return NextResponse.json({ ok: true, needsSetup, bootstrapConfigured });
}
