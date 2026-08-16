import { forwardToPos } from "../../../../lib/pos/forwardPos";
import { posForwardOptionsFromRequest } from "../../../../lib/pos/posForwardFromRequest";

/** Sync do Dotykačky může trvat (webhook wait); bez limitu Vercel ukončí dřív. */
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return forwardToPos(posForwardOptionsFromRequest(req, "ORDER_CONFIRMED", body));
}

