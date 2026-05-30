"use client";

import * as React from "react";

import { Cart, type CartLine } from "../../components/Cart";

/** Demo — pro produkty z Dotykačky přejděte na /menu. */
const DEMO_LINES: CartLine[] = [];

export default function CartPage() {
  const [lines, setLines] = React.useState<CartLine[]>(DEMO_LINES);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: 16, display: "grid", gap: 16 }}>
      <Cart
        lines={lines}
        onInc={(id) =>
          setLines((prev) =>
            prev.map((l) => (l.item.id === id ? { ...l, quantity: l.quantity + 1 } : l)),
          )
        }
        onDec={(id) =>
          setLines((prev) =>
            prev
              .map((l) => (l.item.id === id ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))
              .filter((l) => l.quantity > 0),
          )
        }
        onRemove={(id) => setLines((prev) => prev.filter((l) => l.item.id !== id))}
        onClear={() => setLines([])}
      />
    </main>
  );
}

