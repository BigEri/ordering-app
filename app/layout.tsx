import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import "./globals.css";

import { ConditionalLayoutHeader } from "../components/ConditionalLayoutHeader";
import { ConditionalTopbar } from "../components/ConditionalTopbar";
import { DeviceTableProvider } from "../components/DeviceTableProvider";
import { LanguageProvider } from "../components/LanguageProvider";
import { MenuCartProvider } from "../components/MenuCartProvider";
import { OrdersProvider } from "../components/OrdersProvider";
import { TableBillSyncWatcher } from "../components/TableBillSyncWatcher";
import { PosPendingFlush } from "../components/PosPendingFlush";
import { getPublicRestaurantDisplayName } from "../lib/server/publicRestaurantName";

export const dynamic = "force-dynamic";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const title = await getPublicRestaurantDisplayName();
  return {
    title: `${title} · objednávky`,
    description: "Restaurant ordering app (demo)",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const restaurantDisplayName = await getPublicRestaurantDisplayName();
  const cookieStore = await cookies();
  const initialLocale = cookieStore.get("ordering-locale")?.value ?? null;
  return (
    <html lang="cs" className={fontSans.variable}>
      <body className={fontSans.className}>
        <LanguageProvider initialLocale={initialLocale}>
          <OrdersProvider>
            <PosPendingFlush />
            <MenuCartProvider>
              <DeviceTableProvider>
                <TableBillSyncWatcher />
                <div className="container">
                  <ConditionalLayoutHeader restaurantName={restaurantDisplayName} />
                  <ConditionalTopbar />

                  {children}
                </div>
              </DeviceTableProvider>
            </MenuCartProvider>
          </OrdersProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

