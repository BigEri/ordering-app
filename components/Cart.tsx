"use client";

import * as React from "react";

import type { MenuItemData } from "./MenuItem";

export type CartLine = {
  item: MenuItemData;
  quantity: number;
};

export type CartProps = {
  lines: CartLine[];
  onInc?: (id: string) => void;
  onDec?: (id: string) => void;
  onRemove?: (id: string) => void;
  onClear?: () => void;
};

function formatCzk(value: number) {
  return `${value} Kč`;
}

export function Cart({ lines, onInc, onDec, onRemove, onClear }: CartProps) {
  const total = React.useMemo(
    () => lines.reduce((sum, l) => sum + l.item.priceCzk * l.quantity, 0),
    [lines],
  );

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Košík</h2>
        <button
          type="button"
          onClick={onClear}
          disabled={lines.length === 0}
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            cursor: lines.length === 0 ? "not-allowed" : "pointer",
            opacity: lines.length === 0 ? 0.6 : 1,
          }}
        >
          Vyprázdnit
        </button>
      </header>

      {lines.length === 0 ? (
        <p style={{ margin: 0, color: "#6b7280" }}>Zatím tu nic není.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {lines.map((l) => (
            <li
              key={l.item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <strong>{l.item.name}</strong>
                  <span style={{ color: "#6b7280", fontSize: 14 }}>
                    {formatCzk(l.item.priceCzk)} / ks
                  </span>
                </div>
                <div style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCzk(l.item.priceCzk * l.quantity)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => onDec?.(l.item.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: 24, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                  {l.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onInc?.(l.item.id)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>

                <div style={{ flex: 1 }} />

                <button
                  type="button"
                  onClick={() => onRemove?.(l.item.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid #d1d5db",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Odebrat
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <footer
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Celkem</strong>
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatCzk(total)}</strong>
      </footer>
    </section>
  );
}

