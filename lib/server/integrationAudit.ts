import { randomUUID } from "node:crypto";

import { nowIso } from "./db";
import { prisma } from "./prisma";

export type AuditEventType =
  | "dotykacka_connected"
  | "dotykacka_disconnected"
  | "dotykacka_sync_ok"
  | "dotykacka_sync_failed"
  | "pos_order_sent"
  | "pos_order_failed";

export async function recordIntegrationAuditEvent(input: {
  type: AuditEventType;
  restaurantId: string | null;
  actorUserId: string | null;
  deviceId: string | null;
  details: Record<string, unknown>;
}): Promise<void> {
  const id = randomUUID();
  const ts = nowIso();
  await prisma.integrationAuditEvent.create({
    data: {
      id,
      restaurantId: input.restaurantId?.trim() || null,
      type: input.type,
      actorUserId: input.actorUserId?.trim() || null,
      deviceId: input.deviceId?.trim() || null,
      detailsJson: JSON.stringify(input.details ?? {}),
      createdAtIso: ts,
    },
  });
}

