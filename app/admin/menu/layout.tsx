import { DeviceTableRouteBoundary } from "../../../components/DeviceTableRouteBoundary";

export default function AdminMenuLayout({ children }: { children: React.ReactNode }) {
  return <DeviceTableRouteBoundary>{children}</DeviceTableRouteBoundary>;
}
