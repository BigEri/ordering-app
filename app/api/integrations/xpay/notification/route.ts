import { NextResponse } from "next/server";

import { applyXpayNotification } from "../../../../../lib/xpay/payments";

export const dynamic = "force-dynamic";

const XPAY_NOTIFY_IPS = new Set([
  "185.198.117.13",
  "185.198.117.14",
  "185.198.117.17",
  "185.198.118.13",
  "185.198.118.14",
  "185.198.118.17",
]);

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip")?.trim() || null;
}

function parseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const params = new URLSearchParams(trimmed);
    const o: Record<string, string> = {};
    for (const [k, v] of params.entries()) o[k] = v;
    return Object.keys(o).length > 0 ? o : null;
  }
}

/**
 * Server-to-server notifikace Nexi XPay CEE (Pay-by-Link).
 * Musí odpovědět 200, jinak brána opakuje doručení.
 */
export async function POST(req: Request) {
  if (process.env.XPAY_ENFORCE_IP === "1") {
    const ip = clientIp(req);
    if (!ip || !XPAY_NOTIFY_IPS.has(ip)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const text = await req.text();
  const payload = parseBody(text);
  if (!payload) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await applyXpayNotification(payload);
  } catch {
    /* 200 — ať Nexi neopakuje donekonečna při naší chybě; stav doženeme pollingem */
  }
  return NextResponse.json({ ok: true });
}
