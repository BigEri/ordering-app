import { nowIso } from "../server/db";
import { prisma } from "../server/prisma";
import { getPublicAppBaseUrl } from "../server/publicAppUrl";
import { markRestaurantXpayError, markRestaurantXpayOk, getRestaurantXpayRow } from "../server/restaurantXpay";
import { getDotykackaAccessTokenForCloud } from "../dotykacka/accessToken";
import { getDotykackaConfig } from "../dotykacka/config";
import { fetchTableOpenBillFromDotykacka } from "../dotykacka/tableOpenBill";
import { parseXpaySplitItems, resolveSplitAgainstBill } from "../dotykacka/splitBill";
import { syncXpayPaidToDotykacka } from "../dotykacka/syncOrder";
import { getRestaurantMenuSource } from "../menu/restaurantMenuSource";
import { recordIntegrationAuditEvent } from "../server/integrationAudit";
import { secureCompareStrings } from "../server/secureCompare";
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
import { buildXpaySandboxCzkDemo, isXpaySandboxDemoPayUrl } from "./sandboxDemo";
import { isNexiSandboxPayUrl, tillMajorToSandboxEurCents } from "./sandboxEur";

export type XpayPaymentView = {
  paymentId: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  payUrl: string;
  qrDataUrl: string | null;
  amountCzk: number;
  tipAmountCzk: number;
  tillSettled: boolean;
  tillError: string | null;
  demoSandbox?: boolean;
  nexiSandbox?: boolean;
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
    demoSandbox: isXpaySandboxDemoPayUrl(row.payUrl),
    nexiSandbox: isNexiSandboxPayUrl(row.payUrl),
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
  splitItems?: unknown;
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

  const tipPct = input.tipPct === 5 || input.tipPct === 10 || input.tipPct === 15 ? input.tipPct : 0;
  let ordersTotal = bill.bill.totalCzk > 0 ? bill.bill.totalCzk : Math.max(0, Math.round(input.ordersTotalCzk));
  let splitStored: ReturnType<typeof parseXpaySplitItems> = null;
  const parsedSplit = parseXpaySplitItems(input.splitItems);
  if (parsedSplit) {
    const resolved = resolveSplitAgainstBill(bill.bill.lines, parsedSplit);
    if (!resolved.ok) return { ok: false, error: resolved.error, status: 400 };
    if (!resolved.coversFullBill) {
      splitStored = resolved.items;
      ordersTotal = resolved.totalCzk;
    }
  }
  const tipAmount = tipPct > 0 ? Math.round((ordersTotal * tipPct) / 100) : 0;
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
  const linkBase = {
    orderId: paymentId,
    description: `Tableflow ${input.tableLabel?.trim() || `stul ${tableIdNum}`}`,
    language: xpayLanguageFromLocale(input.locale),
    resultUrl: `${appBase}/pay/xpay/result?status=ok&pid=${encodeURIComponent(paymentId)}`,
    cancelUrl: `${appBase}/pay/xpay/result?status=cancel&pid=${encodeURIComponent(paymentId)}`,
    notificationUrl: `${appBase}/api/integrations/xpay/notification`,
  };
  let created = await createXpayPayByLink(creds, {
    ...linkBase,
    amountHalere: czkToHalere(totalCzk),
    currency: "CZK",
  });
  if (!created.ok && created.currencyUnsupported && creds.environment === "sandbox") {
    created = await createXpayPayByLink(creds, {
      ...linkBase,
      amountHalere: tillMajorToSandboxEurCents(totalCzk),
      currency: "EUR",
    });
  }
  if (!created.ok && creds.environment === "sandbox") {
    created = { ok: true, ...buildXpaySandboxCzkDemo({ appBase, paymentId }), raw: { demo: "czk" } };
  }
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
      splitItemsJson: splitStored ? JSON.stringify(splitStored) : null,
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

  let splitItems = null as ReturnType<typeof parseXpaySplitItems>;
  if (row.splitItemsJson) {
    try {
      splitItems = parseXpaySplitItems(JSON.parse(row.splitItemsJson) as unknown);
    } catch {
      splitItems = null;
    }
  }
  const paid = await syncXpayPaidToDotykacka({
    cfg,
    tableId: tableIdNum,
    tipAmountCzk: row.tipAmountCzk,
    splitItems,
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
    if (creds && row.linkId && !isXpaySandboxDemoPayUrl(row.payUrl)) {
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

/** Návrat z Nexi HPP — hostův telefon, bez device secret. Ověří stav u Nexi a uzavře Dotykačku. */
export async function confirmXpayReturn(paymentId: string): Promise<XpayPaymentView | null> {
  const id = paymentId.trim();
  if (!id) return null;
  const row = await prisma.xpayPayment.findUnique({ where: { id } });
  if (!row) return null;

  if (row.status === "pending") {
    const creds = await getXpayCredentials(row.restaurantId);
    if (creds && !isXpaySandboxDemoPayUrl(row.payUrl)) {
      const remote = await fetchXpayOrderStatus(creds, row.id);
      if (remote.ok && remote.classification === "paid") {
        await markXpayPaymentPaid({ paymentId: row.id, notification: remote.raw });
      }
    }
  } else if (row.status === "paid" && !row.tillSettledAtIso) {
    await settleXpayPayment(row.id);
  }

  const fresh = await prisma.xpayPayment.findUnique({ where: { id: row.id } });
  return fresh ? toView(fresh, null) : null;
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

async function assertSandboxCzkDemo(paymentId: string, token: string) {
  const row = await prisma.xpayPayment.findUnique({ where: { id: paymentId } });
  if (!row || !row.securityToken) return { ok: false as const, error: "Platba nenalezena.", status: 404, row: null };
  if (!isXpaySandboxDemoPayUrl(row.payUrl)) {
    return { ok: false as const, error: "Toto není sandbox CZK test.", status: 400, row: null };
  }
  if (!secureCompareStrings(row.securityToken, token)) {
    return { ok: false as const, error: "Neplatný token.", status: 403, row: null };
  }
  const xpay = await getRestaurantXpayRow(row.restaurantId);
  if (!xpay || xpay.environment !== "sandbox") {
    return { ok: false as const, error: "Sandbox CZK test je jen v prostředí Sandbox.", status: 403, row: null };
  }
  return { ok: true as const, row };
}

export async function peekSandboxDemoPayment(input: { paymentId: string; token: string }) {
  const checked = await assertSandboxCzkDemo(input.paymentId, input.token);
  if (!checked.ok) return checked;
  const row = checked.row;
  return {
    ok: true as const,
    status: asStatus(row.status),
    amountCzk: Math.round(row.amountHalere / 100),
    tableLabel: row.tableLabel,
  };
}

export async function completeSandboxDemoPayment(input: {
  paymentId: string;
  token: string;
  action: "pay" | "fail";
}) {
  const checked = await assertSandboxCzkDemo(input.paymentId, input.token);
  if (!checked.ok) return checked;
  const row = checked.row;
  if (input.action === "pay") {
    await markXpayPaymentPaid({ paymentId: row.id, notification: { demo: "czk", action: "pay" } });
    return { ok: true as const, status: "paid" as const, amountCzk: Math.round(row.amountHalere / 100) };
  }
  if (row.status === "pending") {
    const ts = nowIso();
    await prisma.xpayPayment.update({
      where: { id: row.id },
      data: { status: "failed", updatedAtIso: ts },
    });
  }
  return { ok: true as const, status: "failed" as const, amountCzk: Math.round(row.amountHalere / 100) };
}
