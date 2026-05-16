import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { prisma } from "../../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const session = requireAdminSession(cookieHeader);

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
    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: "Password too short" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 });
  }
}

