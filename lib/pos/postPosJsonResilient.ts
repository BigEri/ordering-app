import type { OrderLineSnapshotInput } from "../menu/orderLineLabel";
import { randomUuid } from "../randomUuid";
import { postPosJson, type PostPosJsonResult } from "./postPosJson";
import { enqueuePending, type PendingPosRow } from "./pendingPosQueue";

const RETRY_DELAYS_MS = [400, 1200];

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export type PostPosResilientResult =
  | { ok: true }
  | { ok: false; kind: "http"; status?: number; detail?: string }
  | { ok: false; kind: "queued"; pendingId: string }
  | { ok: false; kind: "network" };

export type ClientOrderSnapshot = {
  lines: Array<{ name: string; qty: number; unitPriceCzk: number; snapshot?: OrderLineSnapshotInput }>;
  totalCzk: number;
};

/**
 * Krátké opakování při síťové chybě, pak uložení do IndexedDB fronty.
 * HTTP chyby se nefrontují (uživatel může zkusit znovu ručně).
 * `clientRequestId` pro idempotenci na serveru.
 */
export async function postPosJsonResilient(
  url: string,
  body: Record<string, unknown>,
  options?: {
    /** Pouze order-confirmed — po úspěšném flushi doplnit historii objednávek. */
    clientOrderSnapshot?: ClientOrderSnapshot;
  },
): Promise<PostPosResilientResult> {
  const clientRequestId =
    typeof body.clientRequestId === "string" && body.clientRequestId.trim()
      ? body.clientRequestId.trim()
      : randomUuid();
  const fullBody: Record<string, unknown> = { ...body, clientRequestId };

  const tryOnce = (): Promise<PostPosJsonResult> => postPosJson(url, fullBody);

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return enqueueAndReturn(url, fullBody, options?.clientOrderSnapshot);
  }

  let last: PostPosJsonResult = await tryOnce();
  if (last.ok) return { ok: true };
  if (last.kind === "http") return { ok: false, kind: "http", status: last.status, detail: last.detail };

  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    last = await tryOnce();
    if (last.ok) return { ok: true };
    if (last.kind === "http") return { ok: false, kind: "http", status: last.status, detail: last.detail };
  }

  return enqueueAndReturn(url, fullBody, options?.clientOrderSnapshot);
}

async function enqueueAndReturn(
  url: string,
  fullBody: Record<string, unknown>,
  snapshot?: ClientOrderSnapshot,
): Promise<PostPosResilientResult> {
  const pendingId = randomUuid();
  const row: Omit<PendingPosRow, "createdAt"> = {
    id: pendingId,
    url,
    bodyJson: JSON.stringify(fullBody),
    clientOrderSnapshotJson: snapshot ? JSON.stringify(snapshot) : undefined,
  };
  try {
    await enqueuePending(row);
    return { ok: false, kind: "queued", pendingId };
  } catch {
    return { ok: false, kind: "network" };
  }
}
