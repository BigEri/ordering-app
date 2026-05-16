import { Suspense } from "react";

import { SetupClient } from "./SetupClient";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const initialToken = typeof sp.token === "string" ? sp.token : "";

  return (
    <Suspense fallback={<main style={{ padding: 48, textAlign: "center" }}>Načítání…</main>}>
      <SetupClient initialToken={initialToken} />
    </Suspense>
  );
}
