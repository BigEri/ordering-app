import { NextResponse } from "next/server";

import { requireAdminSession } from "../../../../lib/server/adminGuard";
import { nowIso } from "../../../../lib/server/db";
import { prisma } from "../../../../lib/server/prisma";
import { secureCompareStrings } from "../../../../lib/server/secureCompare";

function normalizeCode(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!s) return "";
  if (!/^[a-z]{2}$/.test(s)) return "";
  return s;
}

function normalizeLabel(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return "";
  return s.slice(0, 60);
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
    const rows = await prisma.appLocale.findMany({
      orderBy: [{ createdAtIso: "asc" }, { code: "asc" }],
      select: { code: true, label: true, enabled: true, createdAtIso: true },
    });
    return NextResponse.json({
      ok: true,
      locales: rows.map((r) => ({
        code: r.code,
        label: r.label,
        enabled: r.enabled === 1,
        createdAtIso: r.createdAtIso,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    // Locale provisioning is intentionally NOT exposed to admin UI.
    // Use a shared secret (e.g. at installation / vendor remote support).
    const token = process.env.PROVISION_TOKEN?.trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "PROVISION_TOKEN not configured" }, { status: 500 });
    }
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "").trim();
    if (!secureCompareStrings(bearer, token)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

    const code = normalizeCode(o.code);
    const label = normalizeLabel(o.label);
    if (!code || !label) {
      return NextResponse.json({ ok: false, error: "Missing/invalid code/label" }, { status: 400 });
    }
    if (code === "cs" || code === "en" || code === "ko") {
      return NextResponse.json({ ok: false, error: "Core locales already exist" }, { status: 409 });
    }

    const createdAtIso = nowIso();
    const updatedAtIso = createdAtIso;

    const existing = await prisma.appLocale.findUnique({ where: { code }, select: { code: true } });
    if (existing?.code) {
      return NextResponse.json({ ok: false, error: "Locale already exists" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const csMsgs = await tx.uiMessage.findMany({
        where: { locale: "cs" },
        select: { msgKey: true, msgValue: true },
      });

      await tx.appLocale.create({ data: { code, label, createdAtIso, enabled: 1 } });
      for (const m of csMsgs) {
        const k = typeof m.msgKey === "string" ? m.msgKey : "";
        if (!k) continue;
        const v = typeof m.msgValue === "string" ? m.msgValue : "";
        await tx.uiMessage.upsert({
          where: { locale_msgKey: { locale: code, msgKey: k } },
          update: {},
          create: { locale: code, msgKey: k, msgValue: v, updatedAtIso, updatedByUserId: null },
        });
      }
    });

    return NextResponse.json({ ok: true, code });
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
}

