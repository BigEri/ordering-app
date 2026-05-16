"use client";

import { usePathname } from "next/navigation";

import { OnlineBanner } from "./OnlineBanner";
import { Topbar } from "./Topbar";

export function ConditionalTopbar() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/virtual-pos" || pathname === "/setup" || pathname === "/pair" || pathname?.startsWith("/admin"))
    return null;
  return (
    <>
      <Topbar />
      <OnlineBanner />
    </>
  );
}
