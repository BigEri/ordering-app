import { NextResponse } from "next/server";

import { getDotykackaConfig } from "../dotykacka/config";
import type { DotykackaSyncResult } from "../dotykacka/syncOrder";
import { syncBillRequestToDotykacka, syncOrderConfirmedToDotykacka } from "../dotykacka/syncOrder";
import { recordPresenceFromPosPayload } from "../server/deviceRegistry";
import { markRestaurantDotykackaSyncFailed, markRestaurantDotykackaSyncOk } from "../server/restaurantDotykacka";
import { isSuccessfulDuplicate, markPosRequestSuccessful } from "../server/posRequestDedupe";
import { resolvePosTrustFromPayload } from "./resolvePosTrustFromPayload";
import { appendVirtualPosEvent } from "./virtualPosLog";
import { recordIntegrationAuditEvent } from "../server/integrationAudit";

type PosForwardOptions = {
  eventType: string;
  payload: unknown;
  /** Pro zápis do evidence zařízení (stejné ID jako u heartbeatu). */
  userAgent?: string | null;
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

async function maybeSyncDotykacka(
  eventType: string,
  sanitized: unknown,
): Promise<DotykackaSyncResult | undefined> {
  const cfg = await getDotykackaConfig(payloadRestaurantId(sanitized));
  if (!cfg) return undefined;
  if (eventType === "ORDER_CONFIRMED") return syncOrderConfirmedToDotykacka(sanitized, cfg);
  if (eventType === "BILL_REQUEST") return syncBillRequestToDotykacka(sanitized, cfg);
  return undefined;
}

async function forwardToPosInner({ eventType, payload, userAgent }: PosForwardOptions) {
  const sanitized = sanitizePosPayloadForServer(payload);

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
  if (clientRequestId && isSuccessfulDuplicate(clientRequestId)) {
    return NextResponse.json({ ok: true, virtualPos: true, deduped: true }, { status: 200 });
  }

  recordPresenceFromPosPayload(sanitizedForPipeline, userAgent ?? null);
  const logged = await appendVirtualPosEvent(eventType, sanitizedForPipeline);

  let dotykacka: { ok: boolean; error?: string } | undefined;
  try {
    const dk = await maybeSyncDotykacka(eventType, sanitizedForPipeline);
    if (dk) {
      dotykacka = dk.ok ? { ok: true } : { ok: false, error: dk.error };

      const rid = payloadRestaurantId(sanitizedForPipeline);
      if (rid) {
        const details: Record<string, unknown> = {
          eventType,
          clientRequestId: clientRequestId ?? null,
        };
        // POS events for support: order sent/failed to POS (Dotykačka).
        if (eventType === "ORDER_CONFIRMED") {
          await recordIntegrationAuditEvent({
            type: dk.ok ? "pos_order_sent" : "pos_order_failed",
            restaurantId: rid,
            actorUserId: null,
            deviceId:
              sanitizedForPipeline && typeof sanitizedForPipeline === "object" && !Array.isArray(sanitizedForPipeline)
                ? (sanitizedForPipeline as Record<string, unknown>).deviceId && typeof (sanitizedForPipeline as Record<string, unknown>).deviceId === "string"
                  ? ((sanitizedForPipeline as Record<string, unknown>).deviceId as string)
                  : null
                : null,
            details: {
              ...details,
              ...(dk.meta ? { dotykacka: dk.meta } : {}),
              ...(dk.ok ? {} : { error: dk.error }),
            },
          });
        }
        if (dk.ok) {
          markRestaurantDotykackaSyncOk({ restaurantId: rid, details });
        } else {
          markRestaurantDotykackaSyncFailed({ restaurantId: rid, error: dk.error, details });
        }
      }
    }
  } catch (e) {
    dotykacka = {
      ok: false,
      error: e instanceof Error ? e.message : "Dotykačka sync selhal",
    };

    const rid = payloadRestaurantId(sanitizedForPipeline);
    if (rid) {
      markRestaurantDotykackaSyncFailed({
        restaurantId: rid,
        error: dotykacka.error ?? "Dotykačka sync selhal",
        details: { eventType, clientRequestId: clientRequestId ?? null, thrown: true },
      });
      if (eventType === "ORDER_CONFIRMED") {
        await recordIntegrationAuditEvent({
          type: "pos_order_failed",
          restaurantId: rid,
          actorUserId: null,
          deviceId:
            sanitizedForPipeline && typeof sanitizedForPipeline === "object" && !Array.isArray(sanitizedForPipeline)
              ? (sanitizedForPipeline as Record<string, unknown>).deviceId && typeof (sanitizedForPipeline as Record<string, unknown>).deviceId === "string"
                ? ((sanitizedForPipeline as Record<string, unknown>).deviceId as string)
                : null
              : null,
          details: {
            eventType,
            clientRequestId: clientRequestId ?? null,
            thrown: true,
            error: dotykacka.error ?? "Dotykačka sync selhal",
          },
        });
      }
    }
  }

  // Bezpečnější default: pokud je Dotykačka zapnutá a sync selže,
  // nechceme vracet "ok" a potichu ztratit položky v pokladně.
  // Lze explicitně vypnout přes DOTYKACKA_FAIL_ON_ERROR=0.
  const failOnDotykacka = process.env.DOTYKACKA_FAIL_ON_ERROR !== "0";
  if (dotykacka && !dotykacka.ok && failOnDotykacka) {
    return NextResponse.json(
      {
        ok: false,
        virtualPos: true,
        logged,
        dotykacka,
      },
      { status: 502 },
    );
  }

  const targetUrl = getPosNotificationUrl();
  if (!targetUrl) {
    markPosRequestSuccessful(clientRequestId);
    return NextResponse.json(
      {
        ok: true,
        virtualPos: true,
        logged,
        forwarded: false,
        message: "Uloženo do virtuálního POS (POS_NOTIFICATION_URL není nastaveno).",
        ...(dotykacka ? { dotykacka } : {}),
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

    markPosRequestSuccessful(clientRequestId);
    return NextResponse.json(
      {
        ok: true,
        virtualPos: true,
        logged,
        forwarded: true,
        forwardedStatus: res.status,
        ...(dotykacka ? { dotykacka } : {}),
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
        ...(dotykacka ? { dotykacka } : {}),
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
