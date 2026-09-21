import type { DotykackaConfig } from "./config";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asId(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function asAmount(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function rowsFromList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter(isRecord);
  if (!isRecord(json)) return [];
  const data = json.data ?? json.items;
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

/** Platba (SALE) k účtu, kam se má zapsat spropitné. */
export function pickMoneyLogForTip(rows: unknown[], orderId: number): { id: number; tipAmount: number } | null {
  const matches = rows.filter(isRecord).filter((row) => asId(row._orderId) === orderId);
  const sales = matches.filter((row) => {
    const type = typeof row.transactionType === "string" ? row.transactionType.toUpperCase() : "";
    return type === "" || type === "SALE";
  });
  const pool = sales.length > 0 ? sales : matches;
  let best: { id: number; tipAmount: number } | null = null;
  for (const row of pool) {
    const id = asId(row.id);
    if (id == null) continue;
    const tipAmount = asAmount(row.tipAmount);
    if (!best || id > best.id) best = { id, tipAmount };
  }
  return best;
}

/** Nejnovější zaplacený účet stolu (když už order/list nic otevřeného nevrátí). */
export function pickRecentPaidOrderId(rows: unknown[], tableId: number): number | null {
  let best: number | null = null;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const table = asId(row._tableId);
    if (table != null && table !== tableId) continue;
    if (row.paid === false) continue;
    const id = asId(row.id);
    if (id == null) continue;
    if (best == null || id > best) best = id;
  }
  return best;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function cloudFetch(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">,
  accessToken: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${cfg.apiBase}/v2/clouds/${cfg.cloudId}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, json: await readJson(res) };
}

async function patchTip(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">,
  accessToken: string,
  path: string,
  id: number,
  tipAmount: number,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const body = { id, tipAmount };
  const patched = await cloudFetch(cfg, accessToken, path, { method: "PATCH", body });
  if (patched.ok || patched.status !== 405) return patched;
  return cloudFetch(cfg, accessToken, path, { method: "PUT", body });
}

/**
 * Dotykačka `order/pay` pole `tips` ignoruje. Spropitné je `tipAmount` na účtu a na platbě (money log).
 * Vrací null, když je zapsané.
 */
export async function writeDotykackaPaidTip(input: {
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">;
  accessToken: string;
  orderId: number;
  tipAmountCzk: number;
}): Promise<string | null> {
  const tip = Math.round(input.tipAmountCzk);
  if (tip < 1) return null;

  const orderPatch = await patchTip(
    input.cfg,
    input.accessToken,
    `/orders/${input.orderId}`,
    input.orderId,
    tip,
  );
  if (!orderPatch.ok && orderPatch.status !== 404 && orderPatch.status !== 405) {
    /* účet už může být jen pro čtení po zaplacení — rozhoduje money log */
  }

  let lastErr = "Dotykačka nevrátila platbu k účtu, kam zapsat spropitné.";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const listed = await cloudFetch(
      input.cfg,
      input.accessToken,
      `/money-logs?limit=20&filter=${encodeURIComponent(`_orderId|eq|${input.orderId}`)}`,
    );
    if (!listed.ok) {
      lastErr = `Dotykačka money-logs ${listed.status}`;
    } else {
      const log = pickMoneyLogForTip(rowsFromList(listed.json), input.orderId);
      if (log && Math.round(log.tipAmount) === tip) return null;
      if (log) {
        const written = await patchTip(
          input.cfg,
          input.accessToken,
          `/money-logs/${log.id}`,
          log.id,
          tip,
        );
        if (written.ok) return null;
        lastErr = `Dotykačka money-logs tip ${written.status}`;
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return lastErr;
}

export async function findRecentPaidOrderId(input: {
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">;
  accessToken: string;
  tableId: number;
}): Promise<number | null> {
  const listed = await cloudFetch(
    input.cfg,
    input.accessToken,
    `/orders?limit=15&sort=-id&filter=${encodeURIComponent(`_tableId|eq|${input.tableId}`)}`,
  );
  if (!listed.ok) return null;
  return pickRecentPaidOrderId(rowsFromList(listed.json), input.tableId);
}
