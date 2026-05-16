import { NextRequest, NextResponse } from "next/server";

import { recordPresence } from "../../../../lib/server/deviceRegistry";

export async function POST(req: NextRequest) {
  let body: { deviceId?: string; tableId?: string; tableLabel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
  }

  const tableId = typeof body.tableId === "string" ? body.tableId : "1";
  const tableLabel = typeof body.tableLabel === "string" ? body.tableLabel : `Stůl ${tableId}`;

  recordPresence(deviceId, tableId, tableLabel, req.headers.get("user-agent"));

  return NextResponse.json({ ok: true });
}
