"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function formatCzk(n: number) {
  return `${Math.round(n)} Kč`;
}

function XpaySandboxDemoInner() {
  const sp = useSearchParams();
  const paymentId = (sp.get("pid") ?? "").trim();
  const token = (sp.get("t") ?? "").trim();
  const [amountCzk, setAmountCzk] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<"pending" | "paid" | "failed" | "cancelled" | "load">("load");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!paymentId || !token) {
      setErr("Chybí odkaz platby.");
      setStatus("failed");
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await fetch(
        `/api/integrations/xpay/demo-pay?pid=${encodeURIComponent(paymentId)}&t=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const j = (await r.json()) as { ok?: boolean; error?: string; amountCzk?: number; status?: string };
      if (cancelled) return;
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Platbu se nepodařilo načíst.");
        setStatus("failed");
        return;
      }
      setAmountCzk(typeof j.amountCzk === "number" ? j.amountCzk : null);
      if (j.status === "paid" || j.status === "failed" || j.status === "cancelled" || j.status === "pending") {
        setStatus(j.status);
      } else {
        setStatus("pending");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId, token]);

  const submit = async (action: "pay" | "fail") => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/integrations/xpay/demo-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, token, action }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; status?: string };
      if (!r.ok || !j.ok) {
        setErr(typeof j.error === "string" ? j.error : "Akce selhala.");
        return;
      }
      if (j.status === "paid" || j.status === "failed") setStatus(j.status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 24, textAlign: "center" }}>
      <p className="textMuted2" style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Sandbox · CZK
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>Testovací platba</h1>
      {amountCzk != null ? <p style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>{formatCzk(amountCzk)}</p> : null}
      {status === "load" ? <p className="textMuted">Načítám…</p> : null}
      {status === "paid" ? (
        <p className="textMuted">Zaplaceno. Můžete se vrátit k tabletu u stolu.</p>
      ) : null}
      {status === "failed" && !err ? <p className="textMuted">Platba neproběhla. Vraťte se k tabletu.</p> : null}
      {status === "cancelled" ? <p className="textMuted">Platba byla zrušena.</p> : null}
      {err ? (
        <p role="alert" style={{ color: "#fecaca" }}>
          {err}
        </p>
      ) : null}
      {status === "pending" ? (
        <>
          <p className="textMuted" style={{ lineHeight: 1.5 }}>
            Toto není Nexi — veřejný sandbox klíč umí jen EUR. Tady otestujete stejný tok v korunách (QR → telefon → uzavření účtu v Dotykačce). Peníze se nestrhnou.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            <button type="button" className="btnAddToOrder" disabled={busy} onClick={() => void submit("pay")}>
              {busy ? "…" : "Zaplatit test (CZK)"}
            </button>
            <button type="button" className="chip" disabled={busy} onClick={() => void submit("fail")} style={{ justifySelf: "center", cursor: "pointer" }}>
              Simulovat selhání
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}

export default function XpaySandboxDemoPage() {
  return (
    <Suspense
      fallback={
        <main style={{ maxWidth: 420, margin: "48px auto", padding: 24, textAlign: "center" }}>
          <p className="textMuted">…</p>
        </main>
      }
    >
      <XpaySandboxDemoInner />
    </Suspense>
  );
}
