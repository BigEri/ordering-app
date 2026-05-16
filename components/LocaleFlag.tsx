"use client";

import * as React from "react";

/** Vlajky jako SVG (CZ, GB) nebo oficiální soubor (KR) — emoji na Windows často ukazují jen písmena. */

export type FlagCode = "cz" | "gb" | "kr";

type Props = {
  code: FlagCode;
  className?: string;
};

export function LocaleFlag({ code, className }: Props) {
  const clipId = React.useId().replace(/:/g, "");
  const common = {
    className,
    "aria-hidden": true as const,
    focusable: false as const,
    preserveAspectRatio: "xMidYMid meet" as const,
  };

  if (code === "cz") {
    return (
      <svg viewBox="0 0 900 600" {...common}>
        <path fill="#ffffff" d="M0 0h900v300H0z" />
        <path fill="#d7141a" d="M0 300h900v300H0z" />
        <path fill="#11457e" d="M0 0L450 300 0 600z" />
      </svg>
    );
  }

  if (code === "kr") {
    /** Oficiální Taegeukgi (Wikimedia Commons) — správný taegeuk i čtyři trigramy v rozích. */
    return (
      <img
        src="/flags/kr.svg"
        alt=""
        aria-hidden
        className={className}
        draggable={false}
        decoding="async"
      />
    );
  }

  return (
    <svg viewBox="0 0 60 30" {...common}>
      <clipPath id={clipId}>
        <path d="M0 0v30h60V0z" />
      </clipPath>
      <path fill="#012169" d="M0 0v30h60V0z" />
      <path
        d="M0 0l60 30m0-30L0 30"
        stroke="#ffffff"
        strokeWidth="6"
        clipPath={`url(#${clipId})`}
      />
      <path
        d="M0 0l60 30m0-30L0 30"
        stroke="#c8102e"
        strokeWidth="4"
        clipPath={`url(#${clipId})`}
      />
      <path d="M30 0v30M0 15h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
