"use client";

import { usePathname } from "next/navigation";

/** Titulek značky nad topbarem — na úvodní stránce a virtuálním POS ho neukazujeme (mají vlastní layout). */
export function ConditionalLayoutHeader({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/virtual-pos" || pathname === "/setup" || pathname === "/pair" || pathname?.startsWith("/admin"))
    return null;
  return <div className="restaurantTitle">{restaurantName}</div>;
}
