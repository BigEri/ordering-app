import crypto from "crypto";

import { nowIso } from "./db";
import { prisma } from "./prisma";

function isoPlusSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function createDotykackaOAuthState(input: {
  restaurantId: string;
  createdByUserId: string;
  ttlSeconds?: number;
}): Promise<string> {
  const state = crypto.randomUUID();
  const createdAtIso = nowIso();
  const expiresAtIso = isoPlusSeconds(input.ttlSeconds ?? 10 * 60);
  await prisma.dotykackaOauthState.create({
    data: {
      state,
      restaurantId: input.restaurantId.trim(),
      createdByUserId: input.createdByUserId.trim(),
      createdAtIso,
      expiresAtIso,
      usedAtIso: null,
    },
  });
  return state;
}

export async function consumeDotykackaOAuthState(input: {
  state: string;
  userId: string;
}): Promise<{ ok: true; restaurantId: string } | { ok: false; error: "NOT_FOUND" | "EXPIRED" | "USED" | "FORBIDDEN" }> {
  const s = input.state.trim();
  if (!s) return { ok: false, error: "NOT_FOUND" };

  // Cleanup expired (best-effort).
  try {
    await prisma.dotykackaOauthState.deleteMany({
      where: { usedAtIso: null, expiresAtIso: { lt: nowIso() } },
    });
  } catch {
    /* best-effort */
  }

  const row = await prisma.dotykackaOauthState.findUnique({
    where: { state: s },
    select: { restaurantId: true, createdByUserId: true, expiresAtIso: true, usedAtIso: true },
  });
  if (!row) return { ok: false, error: "NOT_FOUND" };

  const restaurantId = row.restaurantId.trim();
  const createdByUserId = row.createdByUserId.trim();
  const usedAtIso = row.usedAtIso?.trim() ? row.usedAtIso : null;
  const expiresAtIso = row.expiresAtIso?.trim() ? row.expiresAtIso : "";

  if (!restaurantId || !createdByUserId || !expiresAtIso) return { ok: false, error: "NOT_FOUND" };
  if (usedAtIso) return { ok: false, error: "USED" };
  if (expiresAtIso < nowIso()) return { ok: false, error: "EXPIRED" };
  if (createdByUserId !== input.userId.trim()) return { ok: false, error: "FORBIDDEN" };

  const usedAt = nowIso();
  await prisma.dotykackaOauthState.updateMany({
    where: { state: s, usedAtIso: null },
    data: { usedAtIso: usedAt },
  });
  return { ok: true, restaurantId };
}

export async function peekDotykackaOAuthState(state: string): Promise<{
  restaurantId: string | null;
  createdByUserId: string | null;
  expiresAtIso: string | null;
  usedAtIso: string | null;
}> {
  const s = state.trim();
  if (!s) return { restaurantId: null, createdByUserId: null, expiresAtIso: null, usedAtIso: null };
  const row = await prisma.dotykackaOauthState.findUnique({
    where: { state: s },
    select: { restaurantId: true, createdByUserId: true, expiresAtIso: true, usedAtIso: true },
  });
  return {
    restaurantId: row?.restaurantId?.trim() ? row.restaurantId.trim() : null,
    createdByUserId: row?.createdByUserId?.trim() ? row.createdByUserId.trim() : null,
    expiresAtIso: row?.expiresAtIso?.trim() ? row.expiresAtIso : null,
    usedAtIso: row?.usedAtIso?.trim() ? row.usedAtIso : null,
  };
}

