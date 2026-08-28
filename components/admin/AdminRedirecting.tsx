"use client";

import { useAdminLanguage } from "./AdminLanguageProvider";

export function AdminRedirecting({ messageKey }: { messageKey: string }) {
  const { t } = useAdminLanguage();
  return (
    <main className="adminPage">
      <p className="textMuted">{t(messageKey)}</p>
    </main>
  );
}
