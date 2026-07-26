"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { KioskStaffBackButton } from "../../../components/kiosk/KioskStaffBackButton";

type PairingResp =
  | { ok: true; code: string; expiresAtIso: string }
  | { ok: false; error: string };

type ConfigResp =
  | { ok: true; binding: null; reloadNonce?: number }
  | { ok: true; binding: { tableId: string; tableLabel: string; restaurantId: string | null }; reloadNonce?: number }
  | { ok: false; error: string };

function formatCountdown(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function KioskPairPageInner() {
  const sp = useSearchParams();
  const deviceId = (sp.get("deviceId") ?? "").trim();

  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const [expiresAtIso, setExpiresAtIso] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [paired, setPaired] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const loadCode = React.useCallback(async () => {
    const did = deviceId;
    if (!did || did.length > 200) {
      setErr("Chybí nebo je neplatné deviceId.");
      setCode(null);
      setExpiresAtIso(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/public/device-pairing-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: did }),
      });
      const j = (await r.json()) as PairingResp;
      if (!r.ok || !j.ok) {
        setErr("error" in j && typeof j.error === "string" ? j.error : "Chyba při generování kódu.");
        setCode(null);
        setExpiresAtIso(null);
        return;
      }
      setCode(j.code);
      setExpiresAtIso(j.expiresAtIso);
    } catch {
      setErr("Síťová chyba.");
      setCode(null);
      setExpiresAtIso(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  React.useEffect(() => {
    void loadCode();
  }, [loadCode]);

  React.useEffect(() => {
    const did = deviceId;
    if (!did || did.length > 200) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/devices/config?deviceId=${encodeURIComponent(did)}`, { cache: "no-store" });
        const j = (await r.json()) as ConfigResp;
        if (cancelled || !r.ok || !j.ok) return;
        if (j.binding) {
          setPaired(true);
          window.setTimeout(() => {
            window.location.href = `/?deviceId=${encodeURIComponent(did)}`;
          }, 1200);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const t = window.setInterval(poll, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [deviceId]);

  const expiresAtMs = expiresAtIso ? new Date(expiresAtIso).getTime() : null;
  const msLeft = expiresAtMs ? expiresAtMs - now : null;
  const countdown = msLeft != null ? formatCountdown(msLeft) : null;

  return (
    <main
      style={{
        minHeight: "calc(100svh - 140px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          border: "1px solid var(--border)",
          borderRadius: 18,
          background: "var(--panel)",
          padding: 22,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1 }}>
          <KioskStaffBackButton className="chip" />
        </div>
        <h1 style={{ margin: "0 0 10px", fontSize: "1.6rem", paddingTop: 44 }}>Párování tabletu</h1>
        <p className="textMuted" style={{ margin: "0 0 18px", lineHeight: 1.55 }}>
          Tento kód zadejte v administraci v sekci párování zařízení. Po spárování se tablet automaticky přepne do menu.
        </p>

        {paired ? (
          <p role="status" style={{ color: "var(--success)", margin: "0 0 14px" }}>
            Zařízení je spárované. Přepínám do menu…
          </p>
        ) : null}

        {err ? (
          <p role="alert" style={{ color: "#fecaca", margin: "0 0 14px" }}>
            {err}
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
            alignItems: "center",
            justifyItems: "center",
            padding: "16px 12px",
            borderRadius: 14,
            border: "1px dashed var(--border)",
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.85 }}>Kód</div>
          <div
            style={{
              fontSize: "clamp(44px, 8vw, 84px)",
              fontWeight: 800,
              letterSpacing: "0.18em",
              lineHeight: 1,
              paddingLeft: "0.18em",
              userSelect: "none",
            }}
          >
            {code ?? "— — — — — —"}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              className="btnPrimary"
              disabled={loading}
              onClick={() => void loadCode()}
              style={{ cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Generuji…" : "Vygenerovat znovu"}
            </button>
          </div>
          {countdown ? (
            <div className="textMuted2" style={{ fontSize: 13 }}>
              Platnost: {countdown}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <details>
            <summary style={{ cursor: "pointer", opacity: 0.9 }}>Technické detaily (deviceId)</summary>
            <code style={{ display: "block", marginTop: 8, wordBreak: "break-all", opacity: 0.85 }}>{deviceId || "—"}</code>
          </details>
          <p className="textMuted2" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>
            Tip: Admin párování najdete na <code>/admin/devices/pair-kiosk</code>.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function KioskPairPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 48, textAlign: "center" }}>Načítám párování…</main>
      }
    >
      <KioskPairPageInner />
    </Suspense>
  );
}
