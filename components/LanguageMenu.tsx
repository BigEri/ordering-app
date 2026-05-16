"use client";

import * as React from "react";

import { tStaff } from "../lib/i18n/tStaff";
import { LocaleFlag, type FlagCode } from "./LocaleFlag";
import { useLanguage } from "./LanguageProvider";

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} preserveAspectRatio="xMidYMid meet">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm7.94 9h-3.14a16.7 16.7 0 0 0-1.44-6.02A8.03 8.03 0 0 1 19.94 11ZM12 4c.9 0 2.35 2.18 3.08 7H8.92C9.65 6.18 11.1 4 12 4Zm-3.36.98A16.7 16.7 0 0 0 7.2 11H4.06a8.03 8.03 0 0 1 4.58-6.02ZM4.06 13H7.2c.3 2.11.85 4.2 1.44 6.02A8.03 8.03 0 0 1 4.06 13ZM12 20c-.9 0-2.35-2.18-3.08-7h6.16c-.73 4.82-2.18 7-3.08 7Zm3.36-.98c.59-1.82 1.14-3.91 1.44-6.02h3.14a8.03 8.03 0 0 1-4.58 6.02Z"
      />
    </svg>
  );
}

function flagForLocale(code: string): FlagCode | null {
  const lc = code.trim().toLowerCase();
  if (lc === "cs") return "cz";
  if (lc === "en") return "gb";
  if (lc === "ko") return "kr";
  return null;
}

export function LanguageMenu() {
  const { locale, setLocale, availableLocales } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const current = availableLocales.find((l) => l.code === locale) ?? availableLocales[0] ?? { code: "cs", label: "Čeština" };
  const currentFlag = flagForLocale(current.code);

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
    <div className="langMenu" ref={wrapRef}>
      <button
        type="button"
        className="chip topbarLangBtn"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${tStaff("lang.current")}: ${current.label}`}
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: "pointer" }}
      >
        {currentFlag ? (
          <LocaleFlag code={currentFlag} className={`topbarLangFlagSvg topbarLangFlagSvg--${currentFlag}`} />
        ) : (
          <GlobeIcon className="topbarLangFlagSvg" />
        )}
        <span className="topbarLangChevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="langMenuDropdown" role="listbox" aria-label={tStaff("lang.choose")}>
          {availableLocales.map((item) => {
            const f = flagForLocale(item.code);
            return (
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
                {f ? (
                  <LocaleFlag code={f} className={`langMenuFlagSvg langMenuFlagSvg--${f}`} />
                ) : (
                  <GlobeIcon className="langMenuFlagSvg" />
                )}
                <span className="langMenuLabel">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
