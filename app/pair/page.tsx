import { Suspense } from "react";

import { PairClient } from "./PairClient";

export default function PairPage() {
  return (
    <Suspense fallback={<main style={{ padding: 48, textAlign: "center" }}>Načítání…</main>}>
      <PairClient />
    </Suspense>
  );
}
