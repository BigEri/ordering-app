import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

/** SUPER_ADMIN: seznam všech účtů s globalRole SUPER_ADMIN. */
export async function GET(req: Request) {
  try {
    const session = await requireAdminSession(req.headers.get("cookie"));
    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const rows = await prisma.user.findMany({
      where: { globalRole: "SUPER_ADMIN" },
      orderBy: { createdAtIso: "asc" },
      select: { id: true, email: true, createdAtIso: true },
    });

    return NextResponse.json({
      ok: true,
      sessionUserId: session.userId,
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        createdAtIso: u.createdAtIso,
        isMe: u.id === session.userId,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
