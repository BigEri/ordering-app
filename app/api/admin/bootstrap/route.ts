import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import { ensureCoreLocalesAndMessages, nowIso } from "../../../../lib/server/db";
import { prisma } from "../../../../lib/server/prisma";

export const dynamic = "force-dynamic";

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

/**
 * One-time bootstrap for first SUPER_ADMIN + first restaurant.
 * Protected by BOOTSTRAP_TOKEN env var (send `Authorization: Bearer ...`).
 */
export async function POST(req: Request) {
  const token = process.env.BOOTSTRAP_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "BOOTSTRAP_TOKEN not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (bearer !== token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Ensure baseline locales + messages exist before the first user/restaurant is created.
  await ensureCoreLocalesAndMessages();

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
  const restaurantName = typeof o.restaurantName === "string" ? o.restaurantName.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  const initialLocalesRaw = o.initialLocales;
  if (!restaurantName || !email || !password) {
    return NextResponse.json({ ok: false, error: "Missing restaurantName/email/password" }, { status: 400 });
  }

  const existing = await prisma.user.count();
  if (existing > 0) {
    return NextResponse.json({ ok: false, error: "Already bootstrapped" }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const createdAtIso = nowIso();

  const initialLocales: Array<{ code: string; label: string }> = Array.isArray(initialLocalesRaw)
    ? (initialLocalesRaw as unknown[])
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
        .map((x) =>
          x
            ? {
                code: normalizeCode(x.code),
                label: normalizeLabel(x.label),
              }
            : null,
        )
        .filter((x): x is NonNullable<typeof x> => x != null && !!x.code && !!x.label)
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.restaurant.create({ data: { id: restaurantId, name: restaurantName, createdAtIso } });
    await tx.user.create({
      data: { id: userId, email, passwordHash, globalRole: "SUPER_ADMIN", createdAtIso },
    });
    await tx.membership.create({
      data: { userId, restaurantId, role: "RESTAURANT_ADMIN", createdAtIso },
    });

    if (initialLocales.length > 0) {
      const csMsgs = await tx.uiMessage.findMany({
        where: { locale: "cs" },
        select: { msgKey: true, msgValue: true },
      });

      for (const loc of initialLocales) {
        if (loc.code === "cs" || loc.code === "en" || loc.code === "ko") continue;

        await tx.appLocale.upsert({
          where: { code: loc.code },
          update: {},
          create: { code: loc.code, label: loc.label, createdAtIso, enabled: 1 },
        });

        for (const m of csMsgs) {
          const k = typeof m.msgKey === "string" ? m.msgKey : "";
          if (!k || k.startsWith("admin.")) continue;
          const v = typeof m.msgValue === "string" ? m.msgValue : "";
          await tx.uiMessage.upsert({
            where: { locale_msgKey: { locale: loc.code, msgKey: k } },
            update: {},
            create: { locale: loc.code, msgKey: k, msgValue: v, updatedAtIso: createdAtIso, updatedByUserId: null },
          });
        }
      }
    }
  });

  return NextResponse.json({
    ok: true,
    restaurantId,
    userId,
  });
}

