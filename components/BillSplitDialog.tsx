"use client";

import * as React from "react";

import type { ConfirmedOrderLine } from "./OrdersProvider";

export type BillSplitPickLine = {
  key: string;
  orderId: number;
  itemId: number;
  qty: number;
  unitPriceCzk: number;
  line: ConfirmedOrderLine;
};

function formatCzk(value: number) {
  return `${value} Kč`;
}

export function BillSplitDialog({
  pickLines,
  pickedQty,
  onPickedQty,
  selectedTotal,
  tipPct,
  onTipPct,
  tipAmount,
  billTotal,
  loading,
  errorKey,
  errorDetail,
  onPay,
  onBack,
  onDismissError,
  t,
  lineLabel,
}: {
  pickLines: BillSplitPickLine[];
  pickedQty: Record<string, number>;
  onPickedQty: (next: Record<string, number>) => void;
  selectedTotal: number;
  tipPct: 0 | 5 | 10 | 15;
  onTipPct: (pct: 0 | 5 | 10 | 15) => void;
  tipAmount: number;
  billTotal: number;
  loading: boolean;
  errorKey: string | null;
  errorDetail: string | null;
  onPay: () => void;
  onBack: () => void;
  onDismissError: () => void;
  t: (key: string) => string;
  lineLabel: (line: ConfirmedOrderLine) => string;
}) {
  const move = (key: string, maxQty: number, delta: number) => {
    onPickedQty({
      ...pickedQty,
      [key]: Math.max(0, Math.min(maxQty, (pickedQty[key] ?? 0) + delta)),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("bill.split.boardTitle")}
      className="modalOverlay modalOverlay--58"
    >
      <div className="modalCard modalCard--lg modalCard--billSplit" onClick={(e) => e.stopPropagation()}>
        <header className="modalCard__header">
          <div className="modalCard__headerCol" style={{ gap: 2 }}>
            <strong className="modalTitle">{t("bill.split.boardTitle")}</strong>
            <span className="textMuted2">{t("bill.split.boardSubtitle")}</span>
          </div>
          <button type="button" className="chip" onClick={onBack} style={{ cursor: "pointer" }}>
            {t("bill.split.back")}
          </button>
        </header>

        <div className="billSplitBoard">
          <section className="billSplitPane" aria-label={t("bill.split.leftTitle")}>
            <header className="billSplitPaneHead">
              <strong>{t("bill.split.leftTitle")}</strong>
            </header>
            <ul className="billSplitList">
              {pickLines.map((l) => {
                const remaining = l.qty - (pickedQty[l.key] ?? 0);
                if (remaining <= 0) return null;
                return (
                  <li key={`left-${l.key}`}>
                    <button type="button" className="billSplitRow" onClick={() => move(l.key, l.qty, 1)}>
                      <span className="billSplitRowQty">{remaining}×</span>
                      <span className="billSplitRowBody">
                        <span className="billSplitRowName">{lineLabel(l.line)}</span>
                        <span className="textMuted2">{formatCzk(l.unitPriceCzk)}</span>
                      </span>
                      <strong className="billSplitRowPrice">{formatCzk(remaining * l.unitPriceCzk)}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
            {pickLines.every((l) => l.qty - (pickedQty[l.key] ?? 0) <= 0) ? (
              <p className="billSplitEmpty">{t("bill.split.leftEmpty")}</p>
            ) : null}
          </section>

          <section className="billSplitPane billSplitPane--guest" aria-label={t("bill.split.rightTitle")}>
            <header className="billSplitPaneHead">
              <strong>{t("bill.split.rightTitle")}</strong>
            </header>
            <ul className="billSplitList">
              {pickLines.map((l) => {
                const chosen = pickedQty[l.key] ?? 0;
                if (chosen <= 0) return null;
                return (
                  <li key={`right-${l.key}`}>
                    <button type="button" className="billSplitRow" onClick={() => move(l.key, l.qty, -1)}>
                      <span className="billSplitRowQty">{chosen}×</span>
                      <span className="billSplitRowBody">
                        <span className="billSplitRowName">{lineLabel(l.line)}</span>
                        <span className="textMuted2">{formatCzk(l.unitPriceCzk)}</span>
                      </span>
                      <strong className="billSplitRowPrice">{formatCzk(chosen * l.unitPriceCzk)}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
            {pickLines.every((l) => (pickedQty[l.key] ?? 0) <= 0) ? (
              <p className="billSplitEmpty">{t("bill.split.rightEmpty")}</p>
            ) : null}
          </section>
        </div>

        <div className="billTipBlock">
          <span className="billTipLabel" id="bill-split-tip-label">
            {t("bill.tip")}
          </span>
          <div className="billTipChips" role="group" aria-labelledby="bill-split-tip-label">
            {([0, 5, 10, 15] as const).map((pct) => (
              <button
                key={pct}
                type="button"
                className={`chip billTipChip ${tipPct === pct ? "chipActive billTipChip--active" : ""}`}
                onClick={() => onTipPct(pct)}
                style={{ cursor: "pointer" }}
              >
                {pct} %
              </button>
            ))}
          </div>
        </div>

        <footer className="modalCard__footer">
          <span>
            {t("bill.total")}
            {tipAmount > 0 ? ` · ${t("bill.tipAmount")} ${formatCzk(tipAmount)}` : ""}
          </span>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(billTotal)}</strong>
        </footer>

        {errorKey ? (
          <div role="alert" className="orderPosErrorRow">
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t(errorKey)}</p>
            {errorDetail ? (
              <p className="textMuted2" style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                {errorDetail}
              </p>
            ) : null}
            <button type="button" className="chip" style={{ marginTop: 8, cursor: "pointer" }} onClick={onDismissError}>
              {t("pos.dismiss")}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className="btnAddToOrder"
          style={{ width: "100%" }}
          onClick={onPay}
          disabled={loading || selectedTotal < 1}
        >
          {loading ? t("bill.pay.sending") : t("bill.split.paySelected")}
        </button>
      </div>
    </div>
  );
}
