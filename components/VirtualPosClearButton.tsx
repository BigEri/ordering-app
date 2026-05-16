"use client";

import * as React from "react";

export function VirtualPosClearButton({ disabled }: { disabled?: boolean }) {
  const [pending, setPending] = React.useState(false);

  async function onClear() {
    if (!window.confirm("Opravdu vymazat celý log virtuálního POS?")) return;
    setPending(true);
    try {
      const res = await fetch("/api/pos/virtual-log/clear", { method: "POST" });
      if (!res.ok) throw new Error("clear failed");
      // Plné obnovení místo router.refresh() – v dev režimu méně často rozbije webpack cache (chyby typu Cannot find module './331.js').
      window.location.reload();
    } catch {
      setPending(false);
      window.alert("Nepodařilo se vymazat log. Zkus to znovu.");
    }
  }

  return (
    <button type="button" className="chip chipDanger" onClick={() => void onClear()} disabled={disabled || pending}>
      {pending ? "Mažu…" : "Vymazat log"}
    </button>
  );
}
