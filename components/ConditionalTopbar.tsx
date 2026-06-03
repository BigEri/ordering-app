"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { isMenuOpenedFromAdmin } from "../lib/admin/publicMenuPreviewUrl";
import { OnlineBanner } from "./OnlineBanner";
import { Topbar } from "./Topbar";

function ConditionalTopbarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewMode = isMenuOpenedFromAdmin({ from: searchParams.get("from") ?? undefined });
  if (pathname === "/" || pathname === "/virtual-pos" || pathname === "/setup" || pathname === "/pair" || pathname?.startsWith("/admin"))
    return null;
  return (
    <>
      <Topbar previewMode={previewMode} />
      {!previewMode ? <OnlineBanner /> : null}
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
