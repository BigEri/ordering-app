import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createSessionToken, sessionCookieName } from "../../../../../lib/server/auth";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { PASSWORD_MIN_LENGTH, isPasswordLongEnough } from "../../../../../lib/server/passwordPolicy";
import { prisma } from "../../../../../lib/server/prisma";
import { bumpUserSessionVersion } from "../../../../../lib/server/sessionVersion";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = await requireAdminSession(cookieHeader);

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
    const oldPassword = typeof o.oldPassword === "string" ? o.oldPassword : "";
    const newPassword = typeof o.newPassword === "string" ? o.newPassword : "";
    const newPassword2 = typeof o.newPassword2 === "string" ? o.newPassword2 : "";

    if (!oldPassword || !newPassword || !newPassword2) {
      return NextResponse.json({ ok: false, error: "Missing password" }, { status: 400 });
    }
    if (newPassword !== newPassword2) {
      return NextResponse.json({ ok: false, error: "Passwords do not match" }, { status: 400 });
    }
    if (!isPasswordLongEnough(newPassword)) {
      return NextResponse.json(
        { ok: false, error: `Password too short (min. ${PASSWORD_MIN_LENGTH} characters)` },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, passwordHash: true, globalRole: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (user.globalRole !== "SUPER_ADMIN" && user.globalRole !== "USER") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const sv = await bumpUserSessionVersion(user.id);
    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      globalRole: user.globalRole,
      sv,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(sessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}
