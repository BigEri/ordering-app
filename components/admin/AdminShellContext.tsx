"use client";

import * as React from "react";

import type { AdminShellBootstrap } from "../../lib/server/adminShellBootstrap";

const AdminShellContext = React.createContext<AdminShellBootstrap | null>(null);

export function AdminShellProvider({
  value,
  children,
}: {
  value: AdminShellBootstrap | null;
  children: React.ReactNode;
}) {
  return <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>;
}

export function useAdminShellBootstrap(): AdminShellBootstrap | null {
  return React.useContext(AdminShellContext);
}
