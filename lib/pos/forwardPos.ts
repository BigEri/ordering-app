import { NextResponse } from "next/server";

import { getDotykackaConfig } from "../dotykacka/config";
import type { DotykackaSyncResult } from "../dotykacka/syncOrder";
import { syncBillRequestToDotykacka, syncOrderConfirmedToDotykacka, syncStaffCallToDotykacka } from "../dotykacka/syncOrder";
import { getRestaurantMenuSource } from "../menu/restaurantMenuSource";
import { recordPresenceFromPosPayload } from "../server/deviceRegistry";
import { markRestaurantDotykackaSyncFailed, markRestaurantDotykackaSyncOk } from "../server/restaurantDotykacka";
import { markRestaurantStoryousError, markRestaurantStoryousOk } from "../server/restaurantStoryous";
import {
  syncBillRequestToStoryous,
  syncOrderConfirmedToStoryous,
  syncStaffCallToStoryous,
} from "../storyous/syncOrder";
import { getStoryousConfig } from "../storyous/config";
import { verifyDeviceSecret } from "../server/deviceSecret";
import { getKioskDeviceBinding } from "../server/kioskDeviceBindings";
import { isSuccessfulDuplicateAsync, markPosRequestSuccessfulAsync } from "../server/posRequestDedupe";
import { resolvePosTrustFromPayload } from "./resolvePosTrustFromPayload";
import { appendVirtualPosEvent } from "./virtualPosLog";
import { recordIntegrationAuditEvent } from "../server/integrationAudit";
import { checkRateLimit } from "../server/rateLimit";

export type PosForwardOptions = {
  eventType: string;
  payload: unknown;
  /** Pro zápis do evidence zařízení (stejné ID jako u heartbeatu). */
  userAgent?: string | null;
  deviceSecretHeader?: string | null;
};

/** Klíče s prefixem `_` jsou jen pro klienta (např. snapshot) — neposílají se do externího POS. */
export function sanitizePosPayloadForServer(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const o = payload as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith("_")) continue;
    out[k] = v;
  }
  return out;
}

function getPosNotificationUrl() {
  return process.env.POS_NOTIFICATION_URL;
}

function payloadRestaurantId(sanitized: unknown): string | null {
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return null;
  const r = (sanitized as Record<string, unknown>).restaurantId;
  return typeof r === "string" && r.trim() ? r.trim() : null;
}

function payloadDeviceId(sanitized: unknown): string | null {
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return null;
  const d = (sanitized as Record<string, unknown>).deviceId;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

type TillSyncResult = { ok: true; meta?: unknown } | { ok: false; error: string; meta?: unknown };

async function maybeSyncTill(
  eventType: string,
  sanitized: unknown,
): Promise<{ source: "storyous" | "dotykacka"; result: TillSyncResult } | undefined> {
  const rid = payloadRestaurantId(sanitized);
  if (!rid) return undefined;
  const source = await getRestaurantMenuSource(rid);
  if (source === "storyous") {
    const cfg = await getStoryousConfig(rid);
    if (!cfg) return undefined;
    if (eventType === "ORDER_CONFIRMED") {
      return { source, result: await syncOrderConfirmedToStoryous(sanitized, cfg) };
    }
    if (eventType === "BILL_REQUEST") {
      return { source, result: await syncBillRequestToStoryous(sanitized, cfg) };
    }
    if (eventType === "STAFF_CALL") {
      return { source, result: await syncStaffCallToStoryous(sanitized, cfg) };
    }
    return undefined;
  }
  if (source === "dotykacka") {
    const cfg = await getDotykackaConfig(rid);
    if (!cfg) return undefined;
    let dk: DotykackaSyncResult | undefined;
    if (eventType === "ORDER_CONFIRMED") dk = await syncOrderConfirmedToDotykacka(sanitized, cfg);
    else if (eventType === "BILL_REQUEST") dk = await syncBillRequestToDotykacka(sanitized, cfg);
    else if (eventType === "STAFF_CALL") dk = await syncStaffCallToDotykacka(sanitized, cfg);
    if (!dk) return undefined;
    return { source, result: dk };
  }
  return undefined;
}

/** Sync do pokladny (Storyous nebo Dotykačka) + audit. */
async function runTillSyncWithAudit(input: {
  eventType: string;
  sanitized: unknown;
  clientRequestId: string | undefined;
}): Promise<{ ok: boolean; error?: string; source?: "storyous" | "dotykacka" } | undefined> {
  const { eventType, sanitized, clientRequestId } = input;
  const rid = payloadRestaurantId(sanitized);
  const deviceId = payloadDeviceId(sanitized);

  try {
    const synced = await maybeSyncTill(eventType, sanitized);
    if (!synced) return undefined;
    const { source, result } = synced;

    if (rid) {
      const details: Record<string, unknown> = {
        eventType,
        clientRequestId: clientRequestId ?? null,
        source,
      };
      if (eventType === "ORDER_CONFIRMED") {
        await recordIntegrationAuditEvent({
          type: result.ok ? "pos_order_sent" : "pos_order_failed",
          restaurantId: rid,
          actorUserId: null,
          deviceId,
          details: {
            ...details,
            ...(result.meta ? { till: result.meta } : {}),
            ...(result.ok ? {} : { error: result.error }),
          },
        });
      }
      if (source === "storyous") {
        if (result.ok) void markRestaurantStoryousOk(rid);
        else void markRestaurantStoryousError(rid, result.error);
      } else if (result.ok) {
        markRestaurantDotykackaSyncOk({ restaurantId: rid, details });
      } else {
        markRestaurantDotykackaSyncFailed({ restaurantId: rid, error: result.error, details });
      }
    }

    return result.ok
      ? { ok: true, source }
      : { ok: false, error: result.error, source };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Sync do pokladny selhal";
    const source = rid ? await getRestaurantMenuSource(rid) : null;
    if (rid) {
      if (source === "storyous") void markRestaurantStoryousError(rid, error);
      else {
        markRestaurantDotykackaSyncFailed({
          restaurantId: rid,
          error,
          details: { eventType, clientRequestId: clientRequestId ?? null, thrown: true },
        });
      }
      if (eventType === "ORDER_CONFIRMED") {
        await recordIntegrationAuditEvent({
          type: "pos_order_failed",
          restaurantId: rid,
          actorUserId: null,
          deviceId,
          details: {
            eventType,
            clientRequestId: clientRequestId ?? null,
            thrown: true,
            error,
          },
        });
      }
    }
    return { ok: false, error, source: source ?? undefined };
  }
}

async function verifyPosDeviceSecret(
  sanitized: unknown,
  deviceSecretHeader: string | null | undefined,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return { ok: true };
  }
  const deviceId = typeof (sanitized as Record<string, unknown>).deviceId === "string"
    ? ((sanitized as Record<string, unknown>).deviceId as string).trim()
    : "";
  if (!deviceId) return { ok: true };

  const binding = await getKioskDeviceBinding(deviceId);
  if (!binding) return { ok: true };
  if (!verifyDeviceSecret(deviceSecretHeader, binding.deviceSecret)) {
    return { ok: false, status: 403, error: "Invalid device credentials" };
  }
  return { ok: true };
}

async function forwardToPosInner({ eventType, payload, userAgent, deviceSecretHeader }: PosForwardOptions) {
  const deviceIdForRl =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? typeof (payload as Record<string, unknown>).deviceId === "string"
        ? ((payload as Record<string, unknown>).deviceId as string).trim()
        : ""
      : "";
  const rlKey = deviceIdForRl ? `pos:${deviceIdForRl}` : `pos-ip:unknown`;
  const rl = checkRateLimit(rlKey, 120, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const sanitized = sanitizePosPayloadForServer(payload);

  const secretCheck = await verifyPosDeviceSecret(sanitized, deviceSecretHeader);
  if (!secretCheck.ok) {
    return NextResponse.json({ ok: false, error: secretCheck.error }, { status: secretCheck.status });
  }

  const posTrust = await resolvePosTrustFromPayload(sanitized);
  if (!posTrust.ok) {
    return NextResponse.json({ ok: false, error: posTrust.error }, { status: posTrust.status });
  }

  const sanitizedForPipeline =
    sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? { ...(sanitized as Record<string, unknown>), restaurantId: posTrust.restaurantId }
      : sanitized;

  const cid =
    sanitizedForPipeline && typeof sanitizedForPipeline === "object" && !Array.isArray(sanitizedForPipeline)
      ? (sanitizedForPipeline as Record<string, unknown>).clientRequestId
      : undefined;
  const clientRequestId = typeof cid === "string" ? cid : undefined;
  if (clientRequestId && (await isSuccessfulDuplicateAsync(clientRequestId))) {
    return NextResponse.json({ ok: true, virtualPos: true, deduped: true }, { status: 200 });
  }

  recordPresenceFromPosPayload(sanitizedForPipeline, userAgent ?? null);
  const logged = await appendVirtualPosEvent(eventType, sanitizedForPipeline);

  const till = await runTillSyncWithAudit({
    eventType,
    sanitized: sanitizedForPipeline,
    clientRequestId,
  });
  const tillPayload =
    till == null
      ? {}
      : till.source === "storyous"
        ? { storyous: till }
        : { dotykacka: till };

  // Bezpečnější default: pokud je pokladna zapnutá a sync selže,
  // nechceme vracet "ok" a potichu ztratit položky.
  const failOnTill = process.env.DOTYKACKA_FAIL_ON_ERROR !== "0";
  if (till && !till.ok && failOnTill) {
    return NextResponse.json(
      {
        ok: false,
        virtualPos: true,
        logged,
        till,
        ...tillPayload,
      },
      { status: 502 },
    );
  }

  const targetUrl = getPosNotificationUrl();
  if (!targetUrl) {
    await markPosRequestSuccessfulAsync(clientRequestId);
    return NextResponse.json(
      {
        ok: true,
        virtualPos: true,
        logged,
        forwarded: false,
        message: "Uloženo do virtuálního POS (POS_NOTIFICATION_URL není nastaveno).",
        ...tillPayload,
      },
      { status: 200 },
    );
  }

  const apiKey = process.env.POS_API_KEY;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: eventType, payload: sanitizedForPipeline, tsIso: logged.tsIso }),
    });

    await markPosRequestSuccessfulAsync(clientRequestId);
    return NextResponse.json(
      {
        ok: true,
        virtualPos: true,
        logged,
        forwarded: true,
        forwardedStatus: res.status,
        ...tillPayload,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        virtualPos: true,
        logged,
        forwarded: false,
        error: e instanceof Error ? e.message : "POS forward failed",
        ...tillPayload,
      },
      { status: 502 },
    );
  }
}

async function forwardToPos(options: PosForwardOptions) {
  try {
    return await forwardToPosInner(options);
  } catch (e) {
    const message = e instanceof Error ? e.message : "POS handler failed";
    return NextResponse.json({ ok: false, virtualPos: true, error: message }, { status: 500 });
  }
}

export { forwardToPos };
