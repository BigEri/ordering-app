"use client";

import { usePathname } from "next/navigation";

export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname === "/setup" || pathname === "/pair") return null;
  return (
    <footer className="footer">
      <span>Ukázka • Next.js App Router</span>
    </footer>
  );
}
