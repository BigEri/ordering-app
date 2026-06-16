"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="cs">
      <body style={{ margin: 0, background: "var(--page-bg)", color: "var(--text)" }}>
        <main
          style={{
            maxWidth: 560,
            margin: "3rem auto",
            padding: "0 1.25rem",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1.5,
          }}
        >
          <h1 style={{ fontSize: "1.35rem", marginBottom: "0.75rem" }}>Něco se pokazilo</h1>
          <p style={{ color: "var(--muted)" }}>
            Zkuste stránku znovu načíst. Pokud problém přetrvá, přivolejte obsluhu.
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
      </body>
    </html>
  );
}
