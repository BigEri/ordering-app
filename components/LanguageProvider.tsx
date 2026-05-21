"use client";

import * as React from "react";

import { localeTag, MESSAGES } from "../lib/i18n/messages";

const STORAGE_KEY = "ordering-locale";
const COOKIE_KEY = "ordering-locale";

export type AvailableLocale = { code: string; label: string };

type LanguageContextValue = {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
  availableLocales: AvailableLocale[];
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function readStoredLocale(): string {
  if (typeof window === "undefined") return "cs";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && typeof raw === "string") return raw;
  } catch {
    /* ignore */
  }
  return "cs";
}

function normalizeLocale(x: string | null | undefined): string {
  const v = String(x ?? "").trim().toLowerCase();
  return v === "en" || v === "ko" || v === "cs" ? v : "cs";
}

function readCookieLocale(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.toLowerCase().startsWith(`${COOKIE_KEY}=`)) continue;
    const val = p.slice(p.indexOf("=") + 1);
    try {
      return decodeURIComponent(val);
    } catch {
      return val;
    }
  }
  return null;
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: string | null;
}) {
  // Initial locale: server předá cookie hodnotu; na klientu je fallback localStorage/cookie.
  const [locale, setLocaleState] = React.useState<string>(() => {
    if (typeof window === "undefined") return normalizeLocale(initialLocale ?? "cs");
    return normalizeLocale(readCookieLocale() ?? readStoredLocale());
  });
  const [hydrated, setHydrated] = React.useState(false);
  const [availableLocales, setAvailableLocales] = React.useState<AvailableLocale[]>([
    { code: "cs", label: "Čeština" },
    { code: "en", label: "English" },
    { code: "ko", label: "한국어" },
  ]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = readStoredLocale();
      try {
        const r = await fetch("/api/public/locales", { credentials: "same-origin" });
        const j = (await r.json()) as { ok?: boolean; locales?: AvailableLocale[] };
        if (!cancelled && r.ok && j.ok && Array.isArray(j.locales) && j.locales.length > 0) {
          const cleaned = j.locales
            .map((x) => ({
              code: typeof x?.code === "string" ? x.code.trim() : "",
              label: typeof x?.label === "string" ? x.label.trim() : "",
            }))
            .filter((x) => !!x.code && !!x.label);
          if (cleaned.length > 0) setAvailableLocales(cleaned);
          const set = new Set(cleaned.map((l) => l.code));
          setLocaleState(set.has(stored) ? stored : "cs");
        } else if (!cancelled) {
          setLocaleState(stored);
        }
      } catch {
        if (!cancelled) setLocaleState(stored);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = React.useCallback((next: string) => {
    const norm = normalizeLocale(next);
    setLocaleState(norm);
    try {
      localStorage.setItem(STORAGE_KEY, norm);
    } catch {
      /* ignore */
    }
    try {
      document.cookie = `${COOKIE_KEY}=${encodeURIComponent(norm)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = localeTag(norm).split("-")[0] ?? norm;
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = localeTag(locale).split("-")[0] ?? locale;
  }, [locale, hydrated]);

  const uiLocale = locale === "cs" || locale === "en" || locale === "ko" ? locale : "cs";
  const t = React.useCallback(
    (key: string) => {
      const table = MESSAGES[uiLocale] ?? MESSAGES.cs;
      return table[key] ?? MESSAGES.cs[key] ?? key;
    },
    [uiLocale],
  );

  const value = React.useMemo(
    () => ({ locale, setLocale, t, availableLocales }),
    [availableLocales, locale, setLocale, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

const FALLBACK_LOCALES: AvailableLocale[] = [
  { code: "cs", label: "Čeština" },
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
];

function noopSetLocale(_next: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[ordering] useLanguage: mimo LanguageProvider — setLocale ignorováno.");
  }
}

const LANGUAGE_FALLBACK: LanguageContextValue = {
  locale: "cs",
  setLocale: noopSetLocale,
  t: (key: string) => MESSAGES.cs[key] ?? key,
  availableLocales: FALLBACK_LOCALES,
};

export function useLanguage() {
  const ctx = React.useContext(LanguageContext);
  if (ctx) return ctx;
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[ordering] useLanguage: žádný LanguageProvider v kontextu — použit fallback (často duplicitní modul od Turbopacku).",
    );
  }
  return LANGUAGE_FALLBACK;
}
