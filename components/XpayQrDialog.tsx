"use client";

import * as React from "react";

import { markKioskBillPaidByXpay } from "../lib/client/kioskBillClose";
import { buildKioskWelcomeUrl } from "../lib/kiosk/nav";
import { postPosJsonData } from "../lib/pos/postPosJson";
import { useLanguage } from "./LanguageProvider";
import { useOrders } from "./OrdersProvider";

export type XpayKioskPayment = {
  paymentId: string;
  payUrl: string;
  qrDataUrl: string | null;
  amountCzk: number;
  status?: string;
  tillError?: string | null;
};

function formatCzk(value: number) {
  return `${value} Kč`;
}

export function XpayQrDialog({
  payment,
  tableFields,
  onClose,
}: {
  payment: XpayKioskPayment;
  tableFields: Record<string, unknown>;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { clearOrders } = useOrders();
  const [current, setCurrent] = React.useState(payment);
  const [phase, setPhase] = React.useState<"qr" | "paid" | "failed">(payment.status === "paid" ? "paid" : "qr");
  const [tillError, setTillError] = React.useState<string | null>(payment.tillError ?? null);
  const closedRef = React.useRef(false);
  const tableFieldsRef = React.useRef(tableFields);
  tableFieldsRef.current = tableFields;

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
      setCurrent((prev) => ({ ...prev, ...r.data }));
      if (r.data.tillError) setTillError(r.data.tillError);
      if (r.data.status === "paid") {
        setPhase("paid");
        markKioskBillPaidByXpay();
        clearOrders();
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
  }, [phase, current.paymentId, clearOrders]);

  React.useEffect(() => {
    if (phase !== "paid") return;
    const id = window.setTimeout(() => {
      window.location.href = buildKioskWelcomeUrl();
    }, 4500);
    return () => window.clearTimeout(id);
  }, [phase]);

  const dismiss = React.useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (phase === "qr") {
      void postPosJsonData("/api/pos/xpay/cancel", { ...tableFieldsRef.current, paymentId: current.paymentId });
    }
    onClose();
  }, [phase, current.paymentId, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("bill.xpay.title")}
      onClick={() => void dismiss()}
      className="modalOverlay modalOverlay--55"
    >
      <div onClick={(e) => e.stopPropagation()} className="modalCard modalCard--md xpayQrCard">
        {phase === "paid" ? (
          <>
            <strong className="modalTitle">{t("paid.modal.title")}</strong>
            <p className="textMuted" style={{ margin: 0 }}>
              {t("paid.modal.bodyWithTotal").replace("{{total}}", formatCzk(current.amountCzk))}
            </p>
            {tillError ? (
              <p className="textMuted2" style={{ margin: 0, fontSize: 13 }}>
                {t("bill.xpay.tillPending")}
              </p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="chip" onClick={() => void dismiss()} style={{ cursor: "pointer" }}>
                {t("paid.modal.close")}
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
            <p className="textMuted" style={{ margin: 0, textAlign: "center" }}>
              {t("bill.xpay.hint")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
