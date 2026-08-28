import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { AdminLanguageProvider } from "../../components/admin/AdminLanguageProvider";
import { AdminShell } from "../../components/admin/AdminShell";
import { ADMIN_LOCALE_COOKIE, normalizeAdminLocale } from "../../lib/i18n/adminLocale";
import { tAdmin } from "../../lib/i18n/tAdmin";
import { getAdminShellBootstrap } from "../../lib/server/adminShellBootstrap";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const bootstrap = await getAdminShellBootstrap();
  const cookieStore = await cookies();
  const initialLocale = normalizeAdminLocale(cookieStore.get(ADMIN_LOCALE_COOKIE)?.value);
  return (
    <AdminLanguageProvider initialLocale={initialLocale}>
      <Suspense fallback={<div className="adminPage">{tAdmin(initialLocale, "admin.layout.loading")}</div>}>
        <AdminShell bootstrap={bootstrap}>{children}</AdminShell>
      </Suspense>
    </AdminLanguageProvider>
  );
}
