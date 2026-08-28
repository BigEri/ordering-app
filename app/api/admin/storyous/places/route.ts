import { NextResponse } from "next/server";

import { fetchStoryousMerchantPlaces } from "../../../../../lib/storyous/client";
import { getStoryousAppCredentials, storyousEnvMerchantId } from "../../../../../lib/storyous/env";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdminSession(req.headers.get("cookie"));
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const creds = getStoryousAppCredentials();
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "Na serveru chybí STORYOUS_CLIENT_ID a STORYOUS_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  const merchantId = new URL(req.url).searchParams.get("merchantId")?.trim() || storyousEnvMerchantId();
  if (!merchantId) {
    return NextResponse.json({ ok: false, error: "Chybí Merchant ID." }, { status: 400 });
  }
  try {
    const { merchantName, places } = await fetchStoryousMerchantPlaces(creds, merchantId);
    return NextResponse.json({ ok: true, merchantId, merchantName, places });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Seznam provozoven se nepodařilo načíst.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
