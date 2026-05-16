"use client";

import { useEffect } from "react";

function isDeployConfigError(message: string): boolean {
  return (
    message.includes("DATABASE_URL") ||
    message.includes("APP_AUTH_SECRET") ||
    message.includes("Environment Variables")
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const deployHint = isDeployConfigError(error.message);

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "3rem auto",
        padding: "0 1.25rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: "1.35rem", marginBottom: "0.75rem" }}>
        {deployHint ? "Aplikace není připravená k provozu" : "Něco se pokazilo"}
      </h1>
      {deployHint ? (
        <>
          <p>Na serveru chybí nastavení nebo databáze není dostupná.</p>
          <ol style={{ paddingLeft: "1.25rem" }}>
            <li>
              Vercel → <strong>Settings → Environment Variables</strong>:{" "}
              <code>DATABASE_URL</code>, <code>APP_AUTH_SECRET</code>,{" "}
              <code>NEXT_PUBLIC_APP_URL</code>
            </li>
            <li>
              Neon (Postgres): vytvořit DB, zkopírovat <strong>pooled</strong> connection string
            </li>
            <li>
              Z PC: <code>npx prisma migrate deploy</code> (s direct URL na produkční DB)
            </li>
            <li>Vercel → <strong>Redeploy</strong></li>
          </ol>
          <p style={{ fontSize: "0.9rem", color: "#555" }}>
            Podrobný postup: <code>docs/DEPLOY-VERCEL.md</code> v repozitáři.
          </p>
        </>
      ) : (
        <p>Zkuste stránku znovu načíst. Pokud problém přetrvá, podívejte se do logů deploye na Vercelu.</p>
      )}
      <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "1.25rem" }}>
        {error.message}
        {error.digest ? ` (digest: ${error.digest})` : null}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          cursor: "pointer",
        }}
      >
        Zkusit znovu
      </button>
    </main>
  );
}
