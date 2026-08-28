"use client";

import * as React from "react";

import {
  ADMIN_LOCALES,
  ADMIN_LOCALE_COOKIE,
  ADMIN_LOCALE_STORAGE,
  normalizeAdminLocale,
  type AdminLocale,
} from "../../lib/i18n/adminLocale";
import { tAdmin } from "../../lib/i18n/tAdmin";

type AdminLanguageContextValue = {
  locale: AdminLocale;
  setLocale: (locale: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const AdminLanguageContext = React.createContext<AdminLanguageContextValue | null>(null);

function readStoredAdminLocale(): AdminLocale {
  if (typeof window === "undefined") return "cs";
  try {
    const raw = localStorage.getItem(ADMIN_LOCALE_STORAGE);
    if (raw) return normalizeAdminLocale(raw);
  } catch {
    /* ignore */
  }
  return "cs";
}

function readCookieAdminLocale(): AdminLocale | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie ?? "";
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.toLowerCase().startsWith(`${ADMIN_LOCALE_COOKIE}=`)) continue;
    const val = p.slice(p.indexOf("=") + 1);
    try {
      return normalizeAdminLocale(decodeURIComponent(val));
    } catch {
      return normalizeAdminLocale(val);
    }
  }
  return null;
}

export function AdminLanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: string | null;
}) {
  const [locale, setLocaleState] = React.useState<AdminLocale>(() => {
    if (typeof window === "undefined") return normalizeAdminLocale(initialLocale);
    return readCookieAdminLocale() ?? readStoredAdminLocale();
  });

  const setLocale = React.useCallback((next: string) => {
    const norm = normalizeAdminLocale(next);
    setLocaleState(norm);
    try {
      localStorage.setItem(ADMIN_LOCALE_STORAGE, norm);
    } catch {
      /* ignore */
    }
    try {
      document.cookie = `${ADMIN_LOCALE_COOKIE}=${encodeURIComponent(norm)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => tAdmin(locale, key, vars),
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}

function readAdminLocaleFallback(): AdminLocale {
  if (typeof window === "undefined") return "cs";
  return readCookieAdminLocale() ?? readStoredAdminLocale();
}

export function useAdminLanguage(): AdminLanguageContextValue {
  const ctx = React.useContext(AdminLanguageContext);
  if (ctx) return ctx;
  const locale = readAdminLocaleFallback();
  return {
    locale,
    setLocale: () => {},
    t: (key, vars) => tAdmin(locale, key, vars),
  };
}

export { ADMIN_LOCALES };
