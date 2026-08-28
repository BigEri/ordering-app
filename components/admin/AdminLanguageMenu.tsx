"use client";

import * as React from "react";

import { LocaleFlag } from "../LocaleFlag";
import { ADMIN_LOCALES, useAdminLanguage } from "./AdminLanguageProvider";

export function AdminLanguageMenu() {
  const { locale, setLocale, t } = useAdminLanguage();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const current = ADMIN_LOCALES.find((l) => l.code === locale) ?? ADMIN_LOCALES[0];

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="langMenu adminLangMenu" ref={wrapRef}>
      <button
        type="button"
        className="chip adminLangMenu__btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t("admin.lang.current")}: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <LocaleFlag code={current.flagCode} className={`topbarLangFlagSvg topbarLangFlagSvg--${current.flagCode}`} />
      </button>

      {open ? (
        <div className="langMenuDropdown adminLangMenu__dropdown" role="listbox" aria-label={t("admin.lang.choose")}>
          {ADMIN_LOCALES.map((item) => (
            <button
              key={item.code}
              type="button"
              role="option"
              aria-selected={item.code === locale}
              className={`langMenuOption${item.code === locale ? " langMenuOptionActive" : ""}`}
              onClick={() => {
                setLocale(item.code);
                setOpen(false);
              }}
            >
              <LocaleFlag code={item.flagCode} className={`langMenuFlagSvg langMenuFlagSvg--${item.flagCode}`} />
              <span className="langMenuLabel">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
