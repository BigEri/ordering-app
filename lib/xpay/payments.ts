import { nowIso } from "../server/db";
import { prisma } from "../server/prisma";
import { getPublicAppBaseUrl } from "../server/publicAppUrl";
import { markRestaurantXpayError, markRestaurantXpayOk } from "../server/restaurantXpay";
import { getDotykackaAccessTokenForCloud } from "../dotykacka/accessToken";
import { getDotykackaConfig } from "../dotykacka/config";
import { fetchTableOpenBillFromDotykacka } from "../dotykacka/tableOpenBill";
import { syncXpayPaidToDotykacka } from "../dotykacka/syncOrder";
import { getRestaurantMenuSource } from "../menu/restaurantMenuSource";
import { recordIntegrationAuditEvent } from "../server/integrationAudit";
import { cancelXpayPayByLink, createXpayPayByLink, fetchXpayOrderStatus, type XpayCredentials } from "./client";
import { getXpayCredentials } from "./config";
import { xpayQrDataUrl } from "./qr";
import {
  buildXpayOrderId,
  classifyXpayOperation,
  czkToHalere,
  extractXpayOrderId,
  xpayLanguageFromLocale,
} from "./parse";

export type XpayPaymentView = {
  paymentId: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  payUrl: string;
  qrDataUrl: string | null;
  amountCzk: number;
  tipAmountCzk: number;
  tillSettled: boolean;
  tillError: string | null;
  notConfigured?: boolean;
};

function asStatus(raw: string): XpayPaymentView["status"] {
  if (raw === "paid" || raw === "failed" || raw === "cancelled") return raw;
  return "pending";
}

function toView(
  row: {
    id: string;
    status: string;
    payUrl: string;
    amountHalere: number;
    tipAmountCzk: number;
    tillSettledAtIso: string | null;
    tillError: string | null;
  },
  qrDataUrl: string | null,
): XpayPaymentView {
  return {
    paymentId: row.id,
    status: asStatus(row.status),
    payUrl: row.payUrl,
    qrDataUrl,
    amountCzk: Math.round(row.amountHalere / 100),
    tipAmountCzk: row.tipAmountCzk,
    tillSettled: Boolean(row.tillSettledAtIso),
    tillError: row.tillError,
  };
}

export async function isXpayConfiguredForRestaurant(restaurantId: string): Promise<boolean> {
  return (await getXpayCredentials(restaurantId)) != null;
}

async function cancelPendingForDevice(creds: XpayCredentials, deviceId: string, tableId: string): Promise<void> {
  const pending = await prisma.xpayPayment.findMany({
    where: { deviceId, tableId, status: "pending" },
    select: { id: true, linkId: true },
    take: 8,
  });
  const ts = nowIso();
  for (const row of pending) {
    if (row.linkId) {
      try {
        await cancelXpayPayByLink(creds, row.linkId);
      } catch {
        /* zrušení starého odkazu nesmí blokovat nový */
      }
    }
    await prisma.xpayPayment.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "cancelled", cancelledAtIso: ts, updatedAtIso: ts },
    });
  }
}

export async function createTableXpayPayment(input: {
  restaurantId: string;
  deviceId: string;
  tableId: string;
  tableLabel?: string | null;
  ordersTotalCzk: number;
  tipPct: number;
  tipAmountCzk: number;
  locale?: string | null;
}): Promise<
  | { ok: true; payment: XpayPaymentView }
  | { ok: false; notConfigured: true }
  | { ok: false; error: string; status?: number }
> {
  const creds = await getXpayCredentials(input.restaurantId);
  if (!creds) return { ok: false, notConfigured: true };

  const source = await getRestaurantMenuSource(input.restaurantId);
  if (source !== "dotykacka") {
    return { ok: false, error: "Platba kartou na kiosku je zatím jen s Dotykačkou." };
  }

  const tableIdNum = Number.parseInt(input.tableId, 10);
  if (!Number.isFinite(tableIdNum)) {
    return { ok: false, error: "Zařízení nemá platné číslo stolu.", status: 400 };
  }

  const cfg = await getDotykackaConfig(input.restaurantId);
  if (!cfg) return { ok: false, error: "Dotykačka není napojená." };

  const accessToken = await getDotykackaAccessTokenForCloud(cfg);
  const bill = await fetchTableOpenBillFromDotykacka(cfg, accessToken, tableIdNum);
  if (!bill.ok) {
    return { ok: false, error: bill.error, status: 502 };
  }
  if (!bill.bill.open || bill.bill.orderIds.length === 0) {
    return {
      ok: false,
      error: "U stolu není otevřený účet v pokladně. Nejdřív objednejte z menu.",
    };
  }

  const ordersTotal = bill.bill.totalCzk > 0 ? bill.bill.totalCzk : Math.max(0, Math.round(input.ordersTotalCzk));
  const tipPct = input.tipPct === 5 || input.tipPct === 10 || input.tipPct === 15 ? input.tipPct : 0;
  const tipAmount = Math.max(0, Math.round(input.tipAmountCzk));
  const totalCzk = ordersTotal + tipAmount;
  if (totalCzk < 1) {
    return { ok: false, error: "Částka k platbě je prázdná." };
  }

  const appBase = getPublicAppBaseUrl({ allowLocalhost: true });
  if (!appBase) {
    return { ok: false, error: "Chybí NEXT_PUBLIC_APP_URL pro návrat z platby." };
  }

  await cancelPendingForDevice(creds, input.deviceId, String(tableIdNum));

  const paymentId = buildXpayOrderId();
  const created = await createXpayPayByLink(creds, {
    orderId: paymentId,
    amountHalere: czkToHalere(totalCzk),
    description: `Tableflow ${input.tableLabel?.trim() || `stůl ${tableIdNum}`}`,
    language: xpayLanguageFromLocale(input.locale),
    resultUrl: `${appBase}/pay/xpay/result?status=ok&pid=${encodeURIComponent(paymentId)}`,
    cancelUrl: `${appBase}/pay/xpay/result?status=cancel&pid=${encodeURIComponent(paymentId)}`,
    notificationUrl: `${appBase}/api/integrations/xpay/notification`,
  });
  if (!created.ok) {
    await markRestaurantXpayError(input.restaurantId, created.error);
    return { ok: false, error: created.error, status: 502 };
  }

  const ts = nowIso();
  const row = await prisma.xpayPayment.create({
    data: {
      id: paymentId,
      restaurantId: input.restaurantId,
      deviceId: input.deviceId,
      tableId: String(tableIdNum),
      tableLabel: input.tableLabel?.trim() || null,
      amountHalere: czkToHalere(totalCzk),
      ordersTotalCzk: ordersTotal,
      tipPct,
      tipAmountCzk: tipAmount,
      status: "pending",
      payUrl: created.payUrl,
      linkId: created.linkId,
      securityToken: created.securityToken,
      locale: input.locale?.trim() || null,
      createdAtIso: ts,
      updatedAtIso: ts,
    },
  });
  await markRestaurantXpayOk(input.restaurantId);
  const qrDataUrl = await xpayQrDataUrl(created.payUrl);
  return { ok: true, payment: toView(row, qrDataUrl) };
}

export async function settleXpayPayment(paymentId: string): Promise<void> {
  const row = await prisma.xpayPayment.findUnique({ where: { id: paymentId } });
  if (!row || row.status !== "paid" || row.tillSettledAtIso) return;

  const tableIdNum = Number.parseInt(row.tableId, 10);
  const cfg = await getDotykackaConfig(row.restaurantId);
  if (!cfg || !Number.isFinite(tableIdNum)) {
    const ts = nowIso();
    await prisma.xpayPayment.update({
      where: { id: paymentId },
      data: { tillError: "Chybí Dotykačka nebo stůl.", updatedAtIso: ts },
    });
    return;
  }

  const paid = await syncXpayPaidToDotykacka({
    cfg,
    tableId: tableIdNum,
    tipAmountCzk: row.tipAmountCzk,
  });
  const ts = nowIso();
  if (!paid.ok) {
    await prisma.xpayPayment.update({
      where: { id: paymentId },
      data: { tillError: paid.error.slice(0, 2000), updatedAtIso: ts },
    });
    await markRestaurantXpayError(row.restaurantId, paid.error);
    return;
  }
  await prisma.xpayPayment.update({
    where: { id: paymentId },
    data: { tillSettledAtIso: ts, tillError: null, updatedAtIso: ts },
  });
  await markRestaurantXpayOk(row.restaurantId);
  await recordIntegrationAuditEvent({
    type: "xpay_till_settled",
    restaurantId: row.restaurantId,
    actorUserId: null,
    deviceId: row.deviceId,
    details: { paymentId, tableId: row.tableId, amountHalere: row.amountHalere },
  });
}

export async function markXpayPaymentPaid(input: {
  paymentId: string;
  notification?: unknown;
}): Promise<XpayPaymentView | null> {
  const ts = nowIso();
  const existing = await prisma.xpayPayment.findUnique({ where: { id: input.paymentId } });
  if (!existing) return null;

  if (existing.status !== "paid") {
    await prisma.xpayPayment.update({
      where: { id: input.paymentId },
      data: {
        status: "paid",
        paidAtIso: existing.paidAtIso ?? ts,
        updatedAtIso: ts,
        notificationJson: input.notification != null ? JSON.stringify(input.notification).slice(0, 8000) : existing.notificationJson,
      },
    });
    await recordIntegrationAuditEvent({
      type: "xpay_paid",
      restaurantId: existing.restaurantId,
      actorUserId: null,
      deviceId: existing.deviceId,
      details: { paymentId: input.paymentId, amountHalere: existing.amountHalere },
    });
  }

  await settleXpayPayment(input.paymentId);
  const fresh = await prisma.xpayPayment.findUnique({ where: { id: input.paymentId } });
  return fresh ? toView(fresh, null) : null;
}

export async function applyXpayNotification(payload: unknown): Promise<{ ok: true; paymentId?: string } | { ok: false }> {
  const orderId = extractXpayOrderId(payload);
  if (!orderId) return { ok: false };
  const row = await prisma.xpayPayment.findUnique({ where: { id: orderId } });
  if (!row) return { ok: false };

  const classification = classifyXpayOperation(payload);
  if (classification === "paid") {
    await markXpayPaymentPaid({ paymentId: row.id, notification: payload });
    return { ok: true, paymentId: row.id };
  }
  if (classification === "failed" && row.status === "pending") {
    const ts = nowIso();
    await prisma.xpayPayment.update({
      where: { id: row.id },
      data: {
        status: "failed",
        updatedAtIso: ts,
        notificationJson: JSON.stringify(payload).slice(0, 8000),
      },
    });
  }
  return { ok: true, paymentId: row.id };
}

export async function refreshXpayPaymentStatus(input: {
  restaurantId: string;
  deviceId: string;
  paymentId: string;
}): Promise<XpayPaymentView | null> {
  const row = await prisma.xpayPayment.findUnique({ where: { id: input.paymentId } });
  if (!row || row.restaurantId !== input.restaurantId || row.deviceId !== input.deviceId) return null;

  if (row.status === "pending") {
    const creds = await getXpayCredentials(row.restaurantId);
    if (creds) {
      const remote = await fetchXpayOrderStatus(creds, row.id);
      if (remote.ok && remote.classification === "paid") {
        await markXpayPaymentPaid({ paymentId: row.id, notification: remote.raw });
      } else if (remote.ok && remote.classification === "failed") {
        const ts = nowIso();
        await prisma.xpayPayment.update({
          where: { id: row.id },
          data: { status: "failed", updatedAtIso: ts },
        });
      }
    }
  } else if (row.status === "paid" && !row.tillSettledAtIso) {
    await settleXpayPayment(row.id);
  }

  const fresh = await prisma.xpayPayment.findUnique({ where: { id: input.paymentId } });
  if (!fresh) return null;
  const qrDataUrl = fresh.status === "pending" ? await xpayQrDataUrl(fresh.payUrl) : null;
  return toView(fresh, qrDataUrl);
}

export async function cancelXpayPayment(input: {
  restaurantId: string;
  deviceId: string;
  paymentId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.xpayPayment.findUnique({ where: { id: input.paymentId } });
  if (!row || row.restaurantId !== input.restaurantId || row.deviceId !== input.deviceId) {
    return { ok: false, error: "Platba nenalezena." };
  }
  if (row.status === "paid") return { ok: true };
  const creds = await getXpayCredentials(row.restaurantId);
  if (creds && row.linkId) {
    await cancelXpayPayByLink(creds, row.linkId);
  }
  const ts = nowIso();
  await prisma.xpayPayment.updateMany({
    where: { id: row.id, status: "pending" },
    data: { status: "cancelled", cancelledAtIso: ts, updatedAtIso: ts },
  });
  return { ok: true };
}
