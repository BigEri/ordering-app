"use client";

import { usePathname } from "next/navigation";

import { isAdminMenuPreviewOnClient } from "../lib/admin/publicMenuPreviewUrl";
import { usePosTableFields } from "./DeviceTableProvider";

/** Titulek značky nad topbarem — na úvodní stránce a virtuálním POS ho neukazujeme (mají vlastní layout). */
export function ConditionalLayoutHeader({ restaurantName }: { restaurantName: string }) {
  const pathname = usePathname();
  const { restaurantName: boundRestaurantName } = usePosTableFields();
  if (pathname === "/" || pathname === "/virtual-pos" || pathname === "/setup" || pathname === "/pair" || pathname?.startsWith("/admin"))
    return null;
  const fromKiosk = !isAdminMenuPreviewOnClient() ? boundRestaurantName?.trim() : "";
  const displayName = fromKiosk || restaurantName;
  return <div className="restaurantTitle">{displayName}</div>;
}
