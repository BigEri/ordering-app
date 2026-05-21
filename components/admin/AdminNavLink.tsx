"use client";

import type { ReactNode } from "react";

/** Plná navigace (<a>) — spolehlivější v Android WebView než Next.js client Link. */
export function AdminNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`adminNavLink${active ? " adminNavLink--active" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {label}
    </a>
  );
}

/** Chip odkaz v adminu — stejný důvod jako AdminNavLink. */
export function AdminChipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="chip" href={href} style={{ textDecoration: "none", display: "inline-block" }}>
      {children}
    </a>
  );
}
