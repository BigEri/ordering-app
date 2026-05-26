import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { PASSWORD_MIN_LENGTH, isPasswordLongEnough } from "../../../../../lib/server/passwordPolicy";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);

    if (session.globalRole !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = (await req.json()) as unknown;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const userId = typeof o.userId === "string" ? o.userId.trim() : "";
    const newPassword = typeof o.newPassword === "string" ? o.newPassword : "";
    if (!userId || !newPassword) {
      return NextResponse.json({ ok: false, error: "Missing userId/password" }, { status: 400 });
    }
    if (!isPasswordLongEnough(newPassword)) {
      return NextResponse.json(
        { ok: false, error: `Password too short (min. ${PASSWORD_MIN_LENGTH} characters)` },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const r = await prisma.user.updateMany({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (r.count === 0) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

