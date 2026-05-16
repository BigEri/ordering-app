import { Suspense } from "react";

import { LoginClient } from "./LoginClient";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const nextRaw = sp.next;
  const nextPath = typeof nextRaw === "string" && nextRaw.trim() ? nextRaw : "/admin";

  return (
    <Suspense>
      <LoginClient nextPath={nextPath} />
    </Suspense>
  );
}

