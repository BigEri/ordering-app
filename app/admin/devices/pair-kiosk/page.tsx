import { PairKioskClient } from "./PairKioskClient";

export default async function AdminPairKioskPage({
  searchParams,
}: {
  searchParams?: Promise<{ device?: string; deviceId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const raw =
    (typeof sp.deviceId === "string" ? sp.deviceId.trim() : "") ||
    (typeof sp.device === "string" ? sp.device.trim() : "");
  const initialDeviceId = raw.length > 0 && raw.length <= 200 ? raw : null;
  return <PairKioskClient initialDeviceId={initialDeviceId} />;
}
