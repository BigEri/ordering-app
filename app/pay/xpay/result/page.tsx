"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function XpayResultInner() {
  const sp = useSearchParams();
  const status = (sp.get("status") ?? "").toLowerCase();
  const cancelled = status === "cancel" || status === "cancelled" || status === "fail";
  const paymentId = (sp.get("pid") ?? "").trim();

  useEffect(() => {
    if (cancelled || !paymentId) return;
    void fetch("/api/integrations/xpay/result-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
      cache: "no-store",
    });
  }, [cancelled, paymentId]);

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>{cancelled ? "Platba zrušena" : "Platba"}</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
        {cancelled
          ? "Můžete se vrátit k tabletu u stolu a zkusit to znovu."
          : "Můžete se vrátit k tabletu u stolu. Výsledek platby se tam zobrazí sám."}
      </p>
      <p style={{ color: "var(--muted)", lineHeight: 1.5, margin: "16px 0 0" }}>
        {cancelled
          ? "You can return to the table tablet and try again."
          : "You can return to the table tablet. The payment result will appear there."}
      </p>
    </main>
  );
}

export default function XpayResultPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 420, margin: "48px auto", padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", margin: 0 }}>…</p>
        </main>
      }
    >
      <XpayResultInner />
    </Suspense>
  );
}
