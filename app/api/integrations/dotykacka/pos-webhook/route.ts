import { NextResponse } from "next/server";

import { resolvePosActionWebhook } from "../../../../../lib/server/posActionWebhookRegistry";

export const dynamic = "force-dynamic";

/**
 * Callback z Dotykačky po pos-actions (tělo požadavku obsahuje `webhook` s touto URL).
 * Musí být veřejné HTTPS — viz getDotykackaPosWebhookPublicBaseUrl.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const cb = url.searchParams.get("cb")?.trim() ?? "";
  if (!cb) {
    return NextResponse.json({ ok: false, error: "Missing cb" }, { status: 400 });
  }
  const text = await req.text();
  resolvePosActionWebhook(cb, text);
  return NextResponse.json({ ok: true }, { status: 200 });
}
