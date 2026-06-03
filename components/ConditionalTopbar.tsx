"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { isMenuOpenedFromAdmin } from "../lib/admin/publicMenuPreviewUrl";
import { OnlineBanner } from "./OnlineBanner";
import { Topbar } from "./Topbar";

function ConditionalTopbarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (isMenuOpenedFromAdmin({ from: searchParams.get("from") ?? undefined })) return null;
  if (pathname === "/" || pathname === "/virtual-pos" || pathname === "/setup" || pathname === "/pair" || pathname?.startsWith("/admin"))
    return null;
  return (
    <>
      <Topbar />
      <OnlineBanner />
    </>
  );
}

export function ConditionalTopbar() {
  return (
    <Suspense fallback={null}>
      <ConditionalTopbarInner />
    </Suspense>
  );
}
