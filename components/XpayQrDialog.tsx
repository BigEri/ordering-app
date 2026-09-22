"use client";

import * as React from "react";

import { markKioskBillPaidByXpay, markKioskXpayTipMissing } from "../lib/client/kioskBillClose";
import {
  clearKioskSplitPayContinue,
  markKioskSplitPayContinue,
  shouldResumeSplitAfterPay,
} from "../lib/client/kioskSplitPay";
import { requestTableBillSyncBurst } from "../lib/client/tableBillSync";
import { buildKioskWelcomeUrl } from "../lib/kiosk/nav";
import { postPosJsonData } from "../lib/pos/postPosJson";
import { formatSandboxEurFromTillMajor } from "../lib/xpay/sandboxEur";
import { useLanguage } from "./LanguageProvider";
import { useOrders } from "./OrdersProvider";

export type XpayKioskPayment = {
  paymentId: string;
  payUrl: string;
  qrDataUrl: string | null;
  amountCzk: number;
  tipAmountCzk?: number;
  status?: string;
  tillError?: string | null;
  tillSettled?: boolean;
  split?: boolean;
  demoSandbox?: boolean;
  nexiSandbox?: boolean;
};

function formatCzk(value: number) {
  return `${value} Kč`;
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

type RemainingBill = {
  remaining: boolean | null;
  lines: Array<{ name: string; detail?: string; qty: number; unitPriceCzk: number; itemId?: number; orderId?: number }>;
  totalCzk: number;
};

async function fetchRemainingBill(tableFields: Record<string, unknown>): Promise<RemainingBill> {
  const r = await postPosJsonData<{
    open?: boolean;
    lines?: Array<{ name: string; detail?: string; qty: number; unitPriceCzk: number; itemId?: number; orderId?: number }>;
    totalCzk?: number;
  }>("/api/pos/table-open-bill", tableFields);
  if (!r.ok) return { remaining: null, lines: [], totalCzk: 0 };
  const lines = Array.isArray(r.data.lines) ? r.data.lines : [];
  const totalCzk = typeof r.data.totalCzk === "number" && Number.isFinite(r.data.totalCzk) ? r.data.totalCzk : 0;
  return { remaining: r.data.open === true && lines.length > 0, lines, totalCzk };
}

export function XpayQrDialog({
  payment,
  tableFields,
  onClose,
  onContinueSplit,
}: {
  payment: XpayKioskPayment;
  tableFields: Record<string, unknown>;
  onClose: () => void;
  onContinueSplit?: () => void;
}) {
  const { t } = useLanguage();
  const { clearOrders, syncTableBillFromDotykacka } = useOrders();
  const [current, setCurrent] = React.useState(payment);
  const [phase, setPhase] = React.useState<"qr" | "paid" | "failed">(payment.status === "paid" ? "paid" : "qr");
  const [tillError, setTillError] = React.useState<string | null>(payment.tillError ?? null);
  const closedRef = React.useRef(false);
  const tableFieldsRef = React.useRef(tableFields);
  tableFieldsRef.current = tableFields;
  const onContinueSplitRef = React.useRef(onContinueSplit);
  onContinueSplitRef.current = onContinueSplit;
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const clearOrdersRef = React.useRef(clearOrders);
  clearOrdersRef.current = clearOrders;
  const syncBillRef = React.useRef(syncTableBillFromDotykacka);
  syncBillRef.current = syncTableBillFromDotykacka;
  const splitRef = React.useRef(Boolean(payment.split));
  splitRef.current = Boolean(current.split);

  const resumeSplit = React.useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    requestTableBillSyncBurst();
    if (onContinueSplitRef.current) onContinueSplitRef.current();
    else onCloseRef.current();
  }, []);

  const goWelcome = React.useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    clearKioskSplitPayContinue();
    markKioskBillPaidByXpay();
    clearOrdersRef.current();
    window.location.href = buildKioskWelcomeUrl();
  }, []);

  React.useEffect(() => {
    setCurrent(payment);
    setPhase(payment.status === "paid" ? "paid" : "qr");
  }, [payment]);

  React.useEffect(() => {
    if (phase !== "qr") return;
    let cancelled = false;
    const tick = async () => {
      const r = await postPosJsonData<XpayKioskPayment>("/api/pos/xpay/status", {
        ...tableFieldsRef.current,
        paymentId: current.paymentId,
      });
      if (cancelled || !r.ok) return;
      setCurrent((prev) => ({ ...prev, ...r.data, split: prev.split || r.data.split }));
      if (r.data.tillError) setTillError(r.data.tillError);
      if (r.data.status === "paid") {
        setPhase("paid");
        return;
      }
      if (r.data.status === "failed" || r.data.status === "cancelled") {
        setPhase("failed");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [phase, current.paymentId]);

  React.useEffect(() => {
    if (phase !== "paid") return;
    markKioskBillPaidByXpay({
      amountCzk: current.amountCzk,
      tipAmountCzk: current.tipAmountCzk ?? 0,
    });
    const isSplit = splitRef.current;
    if (!isSplit) {
      clearOrdersRef.current();
      let cancelled = false;
      let welcomeTimer = 0;
      const run = async () => {
        for (let i = 0; i < 6 && !cancelled; i += 1) {
          const r = await postPosJsonData<XpayKioskPayment>("/api/pos/xpay/status", {
            ...tableFieldsRef.current,
            paymentId: current.paymentId,
          });
          if (cancelled) return;
          if (r.ok && r.data.tillSettled) {
            setTillError(null);
            markKioskXpayTipMissing(false);
            break;
          }
          if (r.ok && r.data.tillError?.includes("spropitné")) markKioskXpayTipMissing(true);
          if (r.ok && r.data.tillError && i >= 4) setTillError(r.data.tillError);
          await waitMs(700);
        }
        if (!cancelled) welcomeTimer = window.setTimeout(() => goWelcome(), 1200);
      };
      void run();
      return () => {
        cancelled = true;
        window.clearTimeout(welcomeTimer);
      };
    }

    let cancelled = false;
    markKioskSplitPayContinue();

    const run = async () => {
      for (let i = 0; i < 10 && !cancelled; i += 1) {
        const r = await postPosJsonData<XpayKioskPayment>("/api/pos/xpay/status", {
          ...tableFieldsRef.current,
          paymentId: current.paymentId,
        });
        if (cancelled) return;
        if (r.ok) {
          setCurrent((prev) => ({ ...prev, ...r.data, split: true }));
          if (r.data.tillSettled) {
            setTillError(null);
            markKioskXpayTipMissing(false);
            break;
          }
          const tipStillOpen = Boolean(r.data.tillError?.includes("spropitné"));
          if (tipStillOpen) markKioskXpayTipMissing(true);
          if (r.data.tillError && (!tipStillOpen || i >= 5)) {
            setTillError(r.data.tillError);
            break;
          }
        }
        await waitMs(800);
      }

      let remaining: boolean | null = null;
      for (let i = 0; i < 8 && !cancelled; i += 1) {
        const snap = await fetchRemainingBill(tableFieldsRef.current);
        if (cancelled) return;
        remaining = snap.remaining;
        if (snap.remaining === true) {
          syncBillRef.current({ lines: snap.lines, totalCzk: snap.totalCzk });
          break;
        }
        if (snap.remaining === false && i >= 3) break;
        await waitMs(700);
      }
      if (cancelled) return;

      if (shouldResumeSplitAfterPay({ split: true, remaining }) === "resume") {
        resumeSplit();
        return;
      }
      goWelcome();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [phase, current.paymentId, goWelcome, resumeSplit]);

  const dismiss = React.useCallback(() => {
    if (phase === "paid" && current.split) {
      resumeSplit();
      return;
    }
    if (phase === "paid" && !current.split) {
      goWelcome();
      return;
    }
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  }, [phase, current.split, resumeSplit, goWelcome]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("bill.xpay.title")}
      className="modalOverlay modalOverlay--55"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard modalCard--md xpayQrCard">
        {phase === "paid" ? (
          <>
            <strong className="modalTitle">{t("paid.modal.title")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {current.split
                ? t("bill.split.nextGuestBody")
                : (current.tipAmountCzk ?? 0) > 0
                  ? t("paid.modal.bodyWithTip")
                      .replace("{{total}}", formatCzk(current.amountCzk))
                      .replace("{{tip}}", formatCzk(current.tipAmountCzk ?? 0))
                  : t("paid.modal.bodyWithTotal").replace("{{total}}", formatCzk(current.amountCzk))}
            </p>
            {tillError ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                {tillError.includes("spropitné") ? t("bill.xpay.tipMissing") : t("bill.xpay.tillPending")}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="chip" onClick={() => void dismiss()} style={{ cursor: "pointer" }}>
                {current.split ? t("bill.split.nextGuestContinue") : t("paid.modal.close")}
              </button>
            </div>
          </>
        ) : phase === "failed" ? (
          <>
            <strong className="modalTitle">{t("bill.xpay.failedTitle")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("bill.xpay.failedBody")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="chip" onClick={() => void dismiss()} style={{ cursor: "pointer" }}>
                {t("bill.modal.close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <header className="modalCard__header">
              <div className="modalCard__headerCol" style={{ gap: 2 }}>
                <strong className="modalTitle">{t("bill.xpay.title")}</strong>
                <span className="textMuted2">{t("bill.xpay.subtitle")}</span>
              </div>
              <button type="button" className="chip" onClick={() => void dismiss()} style={{ cursor: "pointer" }}>
                {t("bill.modal.close")}
              </button>
            </header>
            {current.qrDataUrl ? (
              <img src={current.qrDataUrl} alt={t("bill.xpay.title")} className="xpayQrImg" width={280} height={280} />
            ) : (
              <p className="textMuted">{t("bill.xpay.loading")}</p>
            )}
            <p className="xpayQrAmount">{formatCzk(current.amountCzk)}</p>
            {current.nexiSandbox ? (
              <p className="textMuted2" style={{ margin: "0 0 8px", textAlign: "center" }}>
                {t("bill.xpay.nexiSandboxAmount").replace("{{eur}}", formatSandboxEurFromTillMajor(current.amountCzk))}
              </p>
            ) : null}
            <p className="textMuted" style={{ margin: 0, textAlign: "center" }}>
              {current.demoSandbox
                ? t("bill.xpay.sandboxHint")
                : current.nexiSandbox
                  ? t("bill.xpay.nexiSandboxHint")
                  : t("bill.xpay.hint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
