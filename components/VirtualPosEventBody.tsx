"use client";

import type { VirtualPosEvent } from "../lib/pos/virtualPosTypes";
import { tableLabelFromPayload } from "../lib/pos/tableContext";

function formatCzk(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)} Kč`;
}

type OrderLine = { name: string; qty: number; unitPriceCzk: number };

function asOrderLines(payload: unknown): { lines: OrderLine[]; totalCzk: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (!Array.isArray(o.lines)) return null;
  const lines: OrderLine[] = [];
  for (const row of o.lines) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.name !== "string" || typeof r.qty !== "number" || typeof r.unitPriceCzk !== "number") continue;
    lines.push({ name: r.name, qty: r.qty, unitPriceCzk: r.unitPriceCzk });
  }
  const totalCzk = typeof o.totalCzk === "number" ? o.totalCzk : lines.reduce((s, l) => s + l.qty * l.unitPriceCzk, 0);
  return { lines, totalCzk };
}

function asBillPayload(payload: unknown): {
  ordersTotal: number;
  tipPct: number;
  tipAmount: number;
  billTotal: number;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (typeof o.ordersTotal !== "number" || typeof o.billTotal !== "number") return null;
  return {
    ordersTotal: o.ordersTotal,
    tipPct: typeof o.tipPct === "number" ? o.tipPct : 0,
    tipAmount: typeof o.tipAmount === "number" ? o.tipAmount : 0,
    billTotal: o.billTotal,
  };
}

export function VirtualPosEventBody({ event }: { event: VirtualPosEvent }) {
  const table = tableLabelFromPayload(event.payload);

  return (
    <div className="virtualPosEventBody">
      <div className="virtualPosTablePill" title="Zařízení / instance menu">
        {table}
      </div>

      {event.type === "STAFF_CALL" ? (
        <p className="virtualPosHumanLead">
          Žádost o <strong>přivolání obsluhy</strong>.
        </p>
      ) : null}

      {event.type === "BILL_REQUEST" ? (
        (() => {
          const bill = asBillPayload(event.payload);
          if (!bill) {
            return <p className="textMuted">Nelze zobrazit účet – neznámý formát záznamu.</p>;
          }
          return (
            <div className="virtualPosBillBlock">
              <p className="virtualPosHumanLead">
                Žádost o <strong>účet</strong> k úhradě.
              </p>
              <ul className="virtualPosBillLines">
                <li>
                  <span>Mezisoučet objednávek</span>
                  <strong>{formatCzk(bill.ordersTotal)}</strong>
                </li>
                <li>
                  <span>Spropitné ({bill.tipPct} %)</span>
                  <strong>{formatCzk(bill.tipAmount)}</strong>
                </li>
                <li className="virtualPosBillLines__total">
                  <span>K úhradě</span>
                  <strong>{formatCzk(bill.billTotal)}</strong>
                </li>
              </ul>
            </div>
          );
        })()
      ) : null}

      {event.type === "BILL_PAY_CONFIRMED" ? (
        (() => {
          const bill = asBillPayload(event.payload);
          if (!bill) {
            return <p className="textMuted">Nelze zobrazit platbu – neznámý formát záznamu.</p>;
          }
          return (
            <div className="virtualPosBillBlock">
              <p className="virtualPosHumanLead">
                Host v aplikaci potvrdil <strong>platbu</strong> (částka dle zvoleného spropitného).
              </p>
              <ul className="virtualPosBillLines">
                <li>
                  <span>Mezisoučet objednávek</span>
                  <strong>{formatCzk(bill.ordersTotal)}</strong>
                </li>
                <li>
                  <span>Spropitné ({bill.tipPct} %)</span>
                  <strong>{formatCzk(bill.tipAmount)}</strong>
                </li>
                <li className="virtualPosBillLines__total">
                  <span>K úhradě</span>
                  <strong>{formatCzk(bill.billTotal)}</strong>
                </li>
              </ul>
            </div>
          );
        })()
      ) : null}

      {event.type === "ORDER_CONFIRMED" ? (
        (() => {
          const order = asOrderLines(event.payload);
          if (!order || order.lines.length === 0) {
            return <p className="textMuted">Nelze zobrazit položky – neznámý formát záznamu.</p>;
          }
          return (
            <div className="virtualPosOrderBlock">
              <p className="virtualPosHumanLead">Položky objednávky:</p>
              <ul className="virtualPosOrderList">
                {order.lines.map((line, idx) => (
                  <li key={idx} className="virtualPosOrderRow">
                    <span className="virtualPosOrderQty">{line.qty}×</span>
                    <span className="virtualPosOrderName">{line.name}</span>
                    <span className="virtualPosOrderLinePrice">{formatCzk(line.qty * line.unitPriceCzk)}</span>
                  </li>
                ))}
              </ul>
              <div className="virtualPosOrderTotal">
                <span>Celkem</span>
                <strong>{formatCzk(order.totalCzk)}</strong>
              </div>
            </div>
          );
        })()
      ) : null}

      {!["STAFF_CALL", "BILL_REQUEST", "BILL_PAY_CONFIRMED", "ORDER_CONFIRMED"].includes(event.type) ? (
        <p className="textMuted">Typ události: {event.type}</p>
      ) : null}

      <details className="virtualPosTechDetails">
        <summary>Technické detaily (JSON)</summary>
        <pre className="virtualPosPre virtualPosPre--nested">{JSON.stringify(event.payload, null, 2)}</pre>
      </details>
    </div>
  );
}
