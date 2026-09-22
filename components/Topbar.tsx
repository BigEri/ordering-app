"use client";

import * as React from "react";

import { requestTableBillSyncBurst } from "../lib/client/tableBillSync";
import { billLineTitleAndDetail } from "../lib/menu/billLineDisplay";
import { localeTag } from "../lib/i18n/messages";
import { flushPendingPosQueue, POS_QUEUE_FLUSH_DETAIL } from "../lib/pos/pendingPosQueue";
import { isDotykackaAccountLockedError } from "../lib/pos/dotykackaGuestError";
import { postPosJsonResilient } from "../lib/pos/postPosJsonResilient";
import { postPosJsonData } from "../lib/pos/postPosJson";
import { XpayQrDialog, type XpayKioskPayment } from "./XpayQrDialog";
import { BillSplitDialog } from "./BillSplitDialog";
import { usePosTableFields } from "./DeviceTableProvider";
import { useLanguage } from "./LanguageProvider";
import { LanguageMenu } from "./LanguageMenu";
import { type ConfirmedOrderLine, useOrders } from "./OrdersProvider";

function formatCzk(value: number) {
  return `${value} Kč`;
}

type TopbarPosError = { messageKey: string; kind: "staff" | "bill"; detail?: string } | null;

type BillPaymentMethod = "CARD" | "CASH" | "MIX";

type TopbarProps = {
  /** Náhled z administrace (`/menu?from=admin`) — stejné UI, bez odeslání do POS. */
  previewMode?: boolean;
};

export function Topbar({ previewMode = false }: TopbarProps) {
  const { t, locale } = useLanguage();
  const { posTableFields, tillSource } = usePosTableFields();
  const { orders } = useOrders();
  const [open, setOpen] = React.useState(false);
  const [callStaffOpen, setCallStaffOpen] = React.useState(false);
  const [billOpen, setBillOpen] = React.useState(false);
  const [billSentOpen, setBillSentOpen] = React.useState(false);
  const [tipPct, setTipPct] = React.useState<0 | 5 | 10 | 15>(0);
  const [billPaymentMethod, setBillPaymentMethod] = React.useState<BillPaymentMethod>("CARD");
  const [cardShare, setCardShare] = React.useState<"together" | "separate">("together");
  const [pickedQty, setPickedQty] = React.useState<Record<string, number>>({});
  const [topbarError, setTopbarError] = React.useState<TopbarPosError>(null);
  const [billPayErrorKey, setBillPayErrorKey] = React.useState<string | null>(null);
  const [billPayErrorDetail, setBillPayErrorDetail] = React.useState<string | null>(null);
  const [billPayLoading, setBillPayLoading] = React.useState(false);
  const [xpayPayment, setXpayPayment] = React.useState<XpayKioskPayment | null>(null);
  const [callStaffLoading, setCallStaffLoading] = React.useState(false);
  const [topbarRetryLoading, setTopbarRetryLoading] = React.useState(false);
  const billOpenRef = React.useRef(false);
  billOpenRef.current = billOpen;

  const ordersTotal = React.useMemo(
    () => orders.reduce((sum, o) => sum + o.totalCzk, 0),
    [orders],
  );

  const pickLines = React.useMemo(() => {
    const out: Array<{
      key: string;
      orderId: number;
      itemId: number;
      qty: number;
      unitPriceCzk: number;
      line: ConfirmedOrderLine;
    }> = [];
    for (const o of orders) {
      for (const line of o.lines) {
        if (line.itemId && line.orderId) {
          out.push({
            key: `${line.orderId}:${line.itemId}`,
            orderId: line.orderId,
            itemId: line.itemId,
            qty: line.qty,
            unitPriceCzk: line.unitPriceCzk,
            line,
          });
        }
      }
    }
    return out;
  }, [orders]);

  const canSplitCard = pickLines.length > 1 || pickLines.some((l) => l.qty > 1);
  const kioskCardPay = tillSource !== "storyous";
  const showCardSplit = kioskCardPay && canSplitCard;

  const selectedItemsTotal = React.useMemo(() => {
    if (billPaymentMethod !== "CARD" || cardShare !== "separate") return ordersTotal;
    return pickLines.reduce((sum, l) => sum + (pickedQty[l.key] ?? 0) * l.unitPriceCzk, 0);
  }, [billPaymentMethod, cardShare, ordersTotal, pickLines, pickedQty]);

  React.useEffect(() => {
    if (!open && !billOpen && !callStaffOpen && !billSentOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setBillOpen(false);
        setCallStaffOpen(false);
        setBillSentOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, billOpen, callStaffOpen, billSentOpen]);

  React.useEffect(() => {
    if (!callStaffOpen) return;
    const closeTimer = window.setTimeout(() => setCallStaffOpen(false), 5000);
    return () => window.clearTimeout(closeTimer);
  }, [callStaffOpen]);

  React.useEffect(() => {
    if (!billSentOpen) return;
    const closeTimer = window.setTimeout(() => setBillSentOpen(false), 5000);
    return () => window.clearTimeout(closeTimer);
  }, [billSentOpen]);

  React.useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { url: string; body: Record<string, unknown> };
      setTopbarError(null);
      if (d.url.includes("/staff-call")) {
        setCallStaffOpen(true);
      }
      if (d.url.includes("/bill-request")) {
        const tp = d.body.tipPct;
        if (tp === 0 || tp === 5 || tp === 10 || tp === 15) {
          setTipPct(tp);
        }
        const pm = d.body.paymentMethod;
        if (pm === "CARD" || pm === "CASH" || pm === "MIX") {
          setBillPaymentMethod(pm);
        }
        // Request byl odeslán (i z offline fronty) – ukázat potvrzení.
        setBillOpen(false);
        setBillSentOpen(true);
      }
      if (d.url.includes("/bill-pay-confirmed")) {
        setBillOpen(false);
        setBillSentOpen(true);
        setBillPayErrorKey(null);
        setBillPayErrorDetail(null);
      }
    };
    window.addEventListener(POS_QUEUE_FLUSH_DETAIL, h as EventListener);
    return () => window.removeEventListener(POS_QUEUE_FLUSH_DETAIL, h as EventListener);
  }, []);

  const tipAmount = React.useMemo(() => Math.round((selectedItemsTotal * tipPct) / 100), [selectedItemsTotal, tipPct]);
  const billTotal = React.useMemo(() => selectedItemsTotal + tipAmount, [selectedItemsTotal, tipAmount]);

  const billLineParts = React.useCallback(
    (l: ConfirmedOrderLine) => billLineTitleAndDetail(l, locale),
    [locale],
  );

  const sendStaffCall = React.useCallback(async () => {
    setTopbarError(null);
    if (previewMode) {
      setCallStaffOpen(true);
      return;
    }
    setCallStaffLoading(true);
    try {
      const r = await postPosJsonResilient("/api/pos/staff-call", { ...posTableFields() });
      if (r.ok) {
        setCallStaffOpen(true);
        return;
      }
      if (r.kind === "queued") {
        setTopbarError({ messageKey: "pos.error.queued", kind: "staff" });
        return;
      }
      const staffKey =
        r.kind === "network"
          ? "pos.error.network"
          : isDotykackaAccountLockedError(r.detail)
            ? "pos.error.staffLocked"
            : "pos.error.staff";
      setTopbarError({
        messageKey: staffKey,
        kind: "staff",
        ...(r.kind === "http" && r.detail ? { detail: r.detail } : {}),
      });
    } finally {
      setCallStaffLoading(false);
    }
  }, [posTableFields, previewMode]);

  const openOrdersModal = React.useCallback(() => {
    if (!previewMode) requestTableBillSyncBurst();
    setOpen(true);
  }, [previewMode]);

  const openBillRequest = React.useCallback(async () => {
    setTopbarError(null);
    if (!previewMode) requestTableBillSyncBurst();
    // Jen otevře dialog – do Dotykačky se pošle až po volbě spropitného a kliknutí na "Zaplatit".
    setBillPayErrorKey(null);
    setBillPayErrorDetail(null);
    setBillPayLoading(false);
    setTipPct((prev) => prev); // zachovat poslední volbu na zařízení
    setBillPaymentMethod((prev) => prev); // zachovat poslední volbu na zařízení
    setCardShare("together");
    setPickedQty({});
    setBillOpen(true);
  }, [previewMode]);

  const retryTopbar = React.useCallback(async () => {
    if (previewMode) {
      setTopbarError(null);
      return;
    }
    setTopbarRetryLoading(true);
    try {
      if (topbarError?.messageKey === "pos.error.queued") {
        await flushPendingPosQueue();
        return;
      }
      if (!topbarError) return;
      if (topbarError.kind === "staff") {
        await sendStaffCall();
      } else {
        await openBillRequest();
      }
    } finally {
      setTopbarRetryLoading(false);
    }
  }, [topbarError, sendStaffCall, openBillRequest, previewMode]);

  React.useEffect(() => {
    if (tillSource === "storyous") setCardShare("together");
  }, [tillSource]);

  React.useEffect(() => {
    if (!billOpen) {
      setBillPayErrorKey(null);
      setBillPayErrorDetail(null);
      setBillPayLoading(false);
    }
  }, [billOpen]);

  React.useEffect(() => {
    if (billOpen) {
      setBillPayErrorKey(null);
      setBillPayErrorDetail(null);
    }
  }, [tipPct, billOpen]);

  const confirmBillPay = React.useCallback(async () => {
    setBillPayErrorKey(null);
    setBillPayErrorDetail(null);
    if (previewMode) {
      setBillOpen(false);
      setBillSentOpen(true);
      return;
    }
    setBillPayLoading(true);
    try {
      const useSplit = kioskCardPay && billPaymentMethod === "CARD" && cardShare === "separate";
      if (billPaymentMethod === "CARD" && kioskCardPay) {
        if (useSplit && selectedItemsTotal < 1) {
          setBillPayErrorKey("bill.split.needItems");
          return;
        }
        const xr = await postPosJsonData<XpayKioskPayment>("/api/pos/xpay/create-link", {
          ...posTableFields(),
          ordersTotal: selectedItemsTotal,
          tipPct,
          tipAmount,
          billTotal,
          locale,
          ...(useSplit
            ? {
                splitItems: pickLines
                  .filter((l) => (pickedQty[l.key] ?? 0) > 0)
                  .map((l) => ({ orderId: l.orderId, itemId: l.itemId, qty: pickedQty[l.key] ?? 0 })),
              }
            : {}),
        });
        if (xr.ok) {
          if (xr.data.paymentId && xr.data.payUrl) {
            setBillOpen(false);
            setXpayPayment({ ...xr.data, split: cardShare === "separate" });
            return;
          }
        } else {
          const notConfigured =
            xr.kind === "http" &&
            Boolean(
              xr.body &&
                typeof xr.body === "object" &&
                !Array.isArray(xr.body) &&
                (xr.body as { notConfigured?: unknown }).notConfigured === true,
            );
          if (!notConfigured) {
            if (xr.kind === "network") {
              setBillPayErrorKey("pos.error.network");
              setBillPayErrorDetail(null);
            } else {
              setBillPayErrorKey("pos.error.http");
              setBillPayErrorDetail(xr.detail ?? null);
            }
            return;
          }
        }
      }

      // Žádost o účet (s výběrem spropitného) – posílá se až po explicitním kliknutí na "Zaplatit".
      const r = await postPosJsonResilient("/api/pos/bill-request", {
        ...posTableFields(),
        ordersTotal,
        tipPct,
        tipAmount,
        billTotal,
        paymentMethod: billPaymentMethod,
      });
      if (!r.ok) {
        if (r.kind === "queued") {
          setBillPayErrorKey("pos.error.queued");
          setBillPayErrorDetail(null);
          return;
        }
        if (billOpenRef.current) {
          if (r.kind === "network") {
            setBillPayErrorKey("pos.error.network");
            setBillPayErrorDetail(null);
          } else {
            const detail = r.kind === "http" && r.detail ? r.detail : null;
            const isBillDotykackaHelp = Boolean(detail?.includes("Co tablet poslal:"));
            setBillPayErrorKey(isBillDotykackaHelp ? "pos.error.billDotykacka" : "pos.error.http");
            setBillPayErrorDetail(detail);
          }
        }
        return;
      }
      if (!billOpenRef.current) return;
      setBillOpen(false);
      setBillSentOpen(true);
    } finally {
      setBillPayLoading(false);
    }
  }, [
    ordersTotal,
    selectedItemsTotal,
    tipPct,
    tipAmount,
    billTotal,
    billPaymentMethod,
    cardShare,
    pickLines,
    pickedQty,
    posTableFields,
    previewMode,
    locale,
    kioskCardPay,
  ]);

  return (
    <>
      {previewMode ? (
        <p className="topbarPreviewHint textMuted2" role="note">
          Náhled — tlačítka personál a účet neodesílají požadavky do Dotykačky.
        </p>
      ) : null}
      <header className="topbar">
        <nav className="nav" style={{ width: "100%" }}>
          <div className="topbarNavRow">
            <div className="topbarNavCell">
              <button
                type="button"
                className="chip topbarBtn"
                onClick={openOrdersModal}
                style={{ cursor: "pointer" }}
              >
                <span>{t("topbar.orders")}</span>
                <span className="modalBadge">{orders.length}</span>
              </button>
            </div>

            <div className="topbarNavCell">
              <button
                type="button"
                className="chip topbarBtn"
                disabled={callStaffLoading}
                onClick={() => void sendStaffCall()}
                style={{ cursor: callStaffLoading ? "wait" : "pointer" }}
              >
                {callStaffLoading ? "…" : t("topbar.callStaff")}
              </button>
            </div>

            <div className="topbarNavCell">
              <button
                type="button"
                className="chip topbarBtn"
                onClick={() => void openBillRequest()}
                style={{ cursor: "pointer" }}
              >
                {t("topbar.billRequest")}
              </button>
            </div>

            <div className="topbarNavCell topbarNavCell--lang">
              <LanguageMenu />
            </div>
          </div>
        </nav>
      </header>

      {topbarError ? (
        <div role="alert" className="posNotifyBanner">
          <span style={{ whiteSpace: "pre-wrap" }}>
            {t(topbarError.messageKey)}
            {previewMode && topbarError.detail ? (
              <>
                <br />
                <span className="textMuted2" style={{ fontSize: 13 }}>
                  {topbarError.detail}
                </span>
              </>
            ) : null}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="chip"
              disabled={topbarRetryLoading}
              onClick={() => void retryTopbar()}
              style={{ cursor: topbarRetryLoading ? "wait" : "pointer" }}
            >
              {topbarRetryLoading ? "…" : t("pos.retry")}
            </button>
            <button type="button" className="chip" onClick={() => setTopbarError(null)} style={{ cursor: "pointer" }}>
              {t("pos.dismiss")}
            </button>
          </div>
        </div>
      ) : null}

      {callStaffOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("staff.modal.title")}
          onClick={() => setCallStaffOpen(false)}
          className="modalOverlay modalOverlay--60"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard">
            <strong className="modalTitle">{t("staff.modal.title")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("staff.modal.hint")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="chip" onClick={() => setCallStaffOpen(false)} style={{ cursor: "pointer" }}>
                {t("staff.modal.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {billOpen && !(billPaymentMethod === "CARD" && cardShare === "separate" && showCardSplit) ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("topbar.billRequest")}
          onClick={() => setBillOpen(false)}
          className="modalOverlay modalOverlay--55"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard modalCard--md modalCard--bill">
            <header className="modalCard__header">
              <div className="modalCard__headerCol" style={{ gap: 2 }}>
                <strong className="modalTitle">{t("bill.modal.title")}</strong>
                <span className="textMuted2">{t("bill.modal.subtitle")}</span>
              </div>
              <button type="button" className="chip" onClick={() => setBillOpen(false)} style={{ cursor: "pointer" }}>
                {t("bill.modal.close")}
              </button>
            </header>

            <div className="billPayBody">
            {orders.length > 0 ? (
              <section className="billItemsSection" aria-label={t("bill.itemsHeading")}>
                <strong className="billItemsHeading">{t("bill.itemsHeading")}</strong>
                <div className="billItemsScroll">
                  {orders.map((o) => (
                    <div key={o.id} className="billOrderChunk">
                      {orders.length > 1 ? (
                        <div className="billOrderChunkMeta textMuted2">
                          {new Date(o.createdAtIso).toLocaleString(localeTag(locale))}
                        </div>
                      ) : null}
                      <ul className="billItemsList">
                        {o.lines.map((line, idx) => {
                          const lineTotal = line.qty * line.unitPriceCzk;
                          const parts = billLineParts(line);
                          return (
                            <li key={`${o.id}-${idx}`} className="billItemRow">
                              <div className="billItemRowBody">
                                <p className="billItemRowName">{parts.title}</p>
                                {parts.detail ? <p className="billItemRowDetail">{parts.detail}</p> : null}
                                <p className="billItemRowUnit">
                                  {t("bill.lineQty").replace("{{qty}}", String(line.qty))}{" "}
                                  <span className="textMuted2">{formatCzk(line.unitPriceCzk)}</span>
                                </p>
                              </div>
                              <strong className="billItemRowPrice">{formatCzk(lineTotal)}</strong>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="textMuted">{t("bill.subtotal")}</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(selectedItemsTotal)}</strong>
              </div>
              <div className="billTipBlock">
                <span className="billTipLabel" id="bill-tip-label">
                  {t("bill.tip")}
                </span>
                <div
                  className="billTipChips"
                  role="group"
                  aria-labelledby="bill-tip-label"
                >
                  {([0, 5, 10, 15] as const).map((pct) => {
                    const amount = Math.round((selectedItemsTotal * pct) / 100);
                    return (
                      <button
                        key={pct}
                        type="button"
                        className={`chip billTipChip ${tipPct === pct ? "chipActive billTipChip--active" : ""}`}
                        onClick={() => setTipPct(pct)}
                        style={{ cursor: "pointer" }}
                      >
                        <span>{pct} %</span>
                        <span className="billTipChipAmount">{formatCzk(amount)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="billTipBlock">
                <span className="billTipLabel" id="bill-payment-label">
                  {t("bill.paymentMethod")}
                </span>
                <div className="billTipChips" role="group" aria-labelledby="bill-payment-label">
                  {(["CARD", "CASH", "MIX"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`chip billTipChip ${billPaymentMethod === m ? "chipActive billTipChip--active" : ""}`}
                      onClick={() => {
                        setBillPaymentMethod(m);
                        if (m !== "CARD") setCardShare("together");
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {t(m === "CARD" ? "bill.paymentMethod.card" : m === "CASH" ? "bill.paymentMethod.cash" : "bill.paymentMethod.mix")}
                    </button>
                  ))}
                </div>
              </div>
              {billPaymentMethod === "CARD" && showCardSplit ? (
                <div className="billTipBlock">
                  <span className="billTipLabel" id="bill-share-label">
                    {t("bill.split.who")}
                  </span>
                  <div className="billTipChips" role="group" aria-labelledby="bill-share-label">
                    <button
                      type="button"
                      className={`chip billTipChip ${cardShare === "together" ? "chipActive billTipChip--active" : ""}`}
                      onClick={() => {
                        setCardShare("together");
                        setPickedQty({});
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {t("bill.split.together")}
                    </button>
                    <button
                      type="button"
                      className={`chip billTipChip ${cardShare === "separate" ? "chipActive billTipChip--active" : ""}`}
                      onClick={() => {
                        setCardShare("separate");
                        setPickedQty({});
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {t("bill.split.separate")}
                    </button>
                  </div>
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="textMuted">{t("bill.tip")}</span>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(tipAmount)}</strong>
              </div>
            </div>

            {billPayErrorKey ? (
              <div role="alert" className="orderPosErrorRow">
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t(billPayErrorKey)}</p>
                {billPayErrorDetail ? (
                  <p className="textMuted2" style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                    {billPayErrorDetail}
                  </p>
                ) : null}
                <div style={{ marginTop: billPayErrorDetail ? 10 : 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (billPayErrorKey === "pos.error.queued") {
                          void flushPendingPosQueue();
                          return;
                        }
                        void confirmBillPay();
                      }}
                      disabled={billPayLoading}
                      style={{ cursor: "pointer" }}
                    >
                      {t("pos.retry")}
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBillPayErrorKey(null);
                        setBillPayErrorDetail(null);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {t("pos.dismiss")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            </div>

            <div className="billPayDock">
            <footer className="modalCard__footer">
              <strong>{t("bill.total")}</strong>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(billTotal)}</strong>
            </footer>

            <button
              type="button"
              className="btnAddToOrder"
              style={{ width: "100%" }}
              onClick={(e) => {
                e.stopPropagation();
                void confirmBillPay();
              }}
              disabled={billPayLoading || billPayErrorKey === "pos.error.queued"}
            >
              {billPayLoading ? t("bill.pay.sending") : t("bill.pay")}
            </button>
            </div>
          </div>
        </div>
      ) : null}

      {billOpen && billPaymentMethod === "CARD" && cardShare === "separate" && showCardSplit ? (
        <BillSplitDialog
          pickLines={pickLines}
          pickedQty={pickedQty}
          onPickedQty={setPickedQty}
          selectedTotal={selectedItemsTotal}
          tipPct={tipPct}
          onTipPct={setTipPct}
          tipAmount={tipAmount}
          billTotal={billTotal}
          loading={billPayLoading}
          errorKey={billPayErrorKey}
          errorDetail={billPayErrorDetail}
          onPay={() => void confirmBillPay()}
          onBack={() => {
            setCardShare("together");
            setPickedQty({});
            setBillPayErrorKey(null);
            setBillPayErrorDetail(null);
          }}
          onDismissError={() => {
            setBillPayErrorKey(null);
            setBillPayErrorDetail(null);
          }}
          t={t}
          lineParts={billLineParts}
        />
      ) : null}

      {billSentOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("bill.sent.title")}
          onClick={() => setBillSentOpen(false)}
          className="modalOverlay modalOverlay--60"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard">
            <strong className="modalTitle">{t("bill.sent.title")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("bill.sent.body")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="chip" onClick={() => setBillSentOpen(false)} style={{ cursor: "pointer" }}>
                {t("bill.sent.close")}
              </button>
            </div>
            <p className="textMuted2" style={{ margin: 0 }}>
              {t("bill.sent.autoclose")}
            </p>
          </div>
        </div>
      ) : null}

      {xpayPayment ? (
        <XpayQrDialog
          payment={xpayPayment}
          tableFields={posTableFields()}
          onClose={() => setXpayPayment(null)}
          onContinueSplit={() => {
            setXpayPayment(null);
            setPickedQty({});
            setBillPaymentMethod("CARD");
            setCardShare("separate");
            setBillPayErrorKey(null);
            setBillPayErrorDetail(null);
            setBillOpen(true);
            requestTableBillSyncBurst();
          }}
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("orders.title")}
          onClick={() => setOpen(false)}
          className="modalOverlay modalOverlay--50"
        >
          <div onClick={(e) => e.stopPropagation()} className="modalCard modalCard--lg">
            <header className="modalCard__header">
              <div className="modalCard__headerCol" style={{ gap: 2 }}>
                <strong className="modalTitle modalTitle--sm">{t("orders.title")}</strong>
                <span className="textMuted2">{t("orders.subtitle")}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="chip" onClick={() => setOpen(false)} style={{ cursor: "pointer" }}>
                  {t("orders.close")}
                </button>
              </div>
            </header>

            <section style={{ display: "grid", gap: 10 }}>
              {orders.map((o) => (
                <div key={o.id} className="modalOrderBlock">
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <span className="textMuted2" style={{ fontSize: 12 }}>
                      {new Date(o.createdAtIso).toLocaleString(localeTag(locale))}
                    </span>
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(o.totalCzk)}</strong>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
                    {o.lines.map((l, idx) => {
                      const parts = billLineParts(l);
                      return (
                        <li key={`${o.id}-${idx}`} style={{ fontSize: 14 }}>
                          {parts.title}
                          {parts.detail ? <span className="textMuted2"> · {parts.detail}</span> : null}
                          {" "}× {l.qty}
                          <span className="textMuted2"> ({formatCzk(l.qty * l.unitPriceCzk)})</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>

            <footer className="modalCard__footer">
              <strong>{t("orders.grandTotal")}</strong>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(ordersTotal)}</strong>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

