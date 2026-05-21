"use client";

import type { CSSProperties, ReactNode } from "react";

/** Odkaz pro host/kiosk UI — vždy plný reload stránky. */
export function KioskAnchor({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}
