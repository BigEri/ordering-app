import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Storyous Delivery API volá GET na notification URL (bez retry). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = (url.searchParams.get("state") ?? "").trim();
  const externalId = (url.searchParams.get("externalId") ?? "").trim();
  if (!state && !externalId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  return GET(req);
}
