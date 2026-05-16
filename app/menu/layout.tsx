import { DeviceTableRouteBoundary } from "../../components/DeviceTableRouteBoundary";

/** Oddělený server layout: vynutí dynamické vykreslení /menu (velký klientský strom). */
export const dynamic = "force-dynamic";

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <DeviceTableRouteBoundary>{children}</DeviceTableRouteBoundary>;
}
