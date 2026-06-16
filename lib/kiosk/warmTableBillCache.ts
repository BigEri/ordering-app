import { saveTableBillSession, type TableBillSessionScope } from "../client/tableBillSession";

const warmedKeys = new Set<string>();

function warmKey(scope: TableBillSessionScope): string {
  return `${scope.deviceId}::${scope.tableId}`;
}

type PosFields = {
  tableId: string;
  tableLabel: string;
  deviceId: string;
  restaurantId?: string | null;
};

type TableOpenBillResponse = {
  ok?: boolean;
  configured?: boolean;
  open?: boolean;
  lines?: Array<{ name: string; qty: number; unitPriceCzk: number }>;
  totalCzk?: number;
};

/**
 * Na úvodní stránce na pozadí stáhne otevřený účet a uloží do sessionStorage,
 * aby po přechodu na menu Objednávky byly hned vidět.
 */
export function prefetchTableBillFromWelcome(fields: PosFields): void {
  if (typeof window === "undefined") return;
  const deviceId = fields.deviceId.trim();
  const tableId = String(fields.tableId ?? "").trim();
  if (!deviceId || !/^\d+$/.test(tableId)) return;

  const scope: TableBillSessionScope = { deviceId, tableId };
  const key = warmKey(scope);
  if (warmedKeys.has(key)) return;
  warmedKeys.add(key);

  void fetch("/api/pos/table-open-bill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(fields),
    cache: "no-store",
  })
    .then(async (r) => {
      const j = (await r.json()) as TableOpenBillResponse;
      if (!r.ok || !j.ok || j.configured === false || j.open !== true) {
        warmedKeys.delete(key);
        return;
      }
      const lines = Array.isArray(j.lines) ? j.lines : [];
      const totalCzk = typeof j.totalCzk === "number" && Number.isFinite(j.totalCzk) ? j.totalCzk : 0;
      if (lines.length === 0) {
        warmedKeys.delete(key);
        return;
      }
      saveTableBillSession(scope, { lines, totalCzk });
    })
    .catch(() => {
      warmedKeys.delete(key);
    });
}

/** Pro testy — reset deduplikace prefetchu. */
export function resetTableBillWarmStateForTests(): void {
  warmedKeys.clear();
}
