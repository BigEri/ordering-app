import { PairKioskClient } from "../../../../devices/pair-kiosk/PairKioskClient";

export default async function RestaurantPairKioskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ device?: string; deviceId?: string }>;
}) {
  const { id } = await params;
  const restaurantId = typeof id === "string" ? id.trim() : "";
  const sp = (await searchParams) ?? {};
  const raw =
    (typeof sp.deviceId === "string" ? sp.deviceId.trim() : "") ||
    (typeof sp.device === "string" ? sp.device.trim() : "");
  const initialDeviceId = raw.length > 0 && raw.length <= 200 ? raw : null;

  return (
    <PairKioskClient
      initialDeviceId={initialDeviceId}
      restaurantId={restaurantId || null}
      backHref={
        restaurantId
          ? `/admin/restaurants/${encodeURIComponent(restaurantId)}?tab=devices`
          : undefined
      }
    />
  );
}
