import type { ReactNode } from "react";

import { AdminShell } from "../../components/admin/AdminShell";
import { getAdminShellBootstrap } from "../../lib/server/adminShellBootstrap";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const bootstrap = await getAdminShellBootstrap();
  return <AdminShell bootstrap={bootstrap}>{children}</AdminShell>;
}
