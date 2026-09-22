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

function orderIdOf(row: Record<string, unknown>): number | null {
  return asId(row._orderId) ?? asId(row.orderId);
}

const TIP_PRODUCT_NAMES = new Set(["spropitné", "spropitne", "tip"]);

export function pickTipProductId(rows: unknown[]): number | null {
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const name = typeof row.name === "string" ? row.name.trim().toLowerCase() : "";
    if (!TIP_PRODUCT_NAMES.has(name)) continue;
    const id = asId(row.id);
    if (id != null) return id;
  }
  return null;
}

/** Řádek, který zvedne součet účtu o spropitné. Dotykačka po zaplacení částku platby už nezmění. */
export function tipLineItem(productId: number, tipCzk: number): {
  id: number;
  qty: number;
  "manual-price": number;
  note: string;
  tags: string[];
} {
  return { id: productId, qty: 1, "manual-price": tipCzk, note: "Spropitné", tags: ["oa-tip"] };
}

export function orderAlreadyHasTipLine(items: unknown[], tipCzk: number): boolean {
  return items.some((item) => {
    if (!isRecord(item)) return false;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (tags.some((tag) => tag === "oa-tip")) return true;
    const note = typeof item.note === "string" ? item.note.trim().toLowerCase() : "";
    const name = typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
    if (note !== "spropitné" && !TIP_PRODUCT_NAMES.has(name)) return false;
    if (tipCzk < 1) return true;
    const price = asAmount(item["manual-price"] ?? item.manualPrice ?? item["price-with-vat"] ?? item.priceWithVat);
    return price === 0 || Math.round(price) === tipCzk;
  });
}

/** Platba (SALE) k účtu, kam se má zapsat spropitné. */
export function pickMoneyLogForTip(rows: unknown[], orderId: number): { id: number; tipAmount: number } | null {
  const matches = rows.filter(isRecord).filter((row) => orderIdOf(row) === orderId);
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

type CloudResult = { ok: boolean; status: number; json: unknown; etag: string | null };

async function cloudFetch(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">,
  accessToken: string,
  path: string,
  init?: { method?: string; body?: unknown; ifMatch?: string | null },
): Promise<CloudResult> {
  const res = await fetch(`${cfg.apiBase}/v2/clouds/${cfg.cloudId}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.ifMatch ? { "If-Match": init.ifMatch } : {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const etag = res.headers.get("etag");
  return { ok: res.ok, status: res.status, json: await readJson(res), etag: etag && etag.trim() ? etag.trim() : null };
}

function isHardTipFailure(detail: string): boolean {
  const status = Number(detail.slice(0, 3));
  return status === 400 || status === 401 || status === 403 || status === 405 || status === 409 || status === 412 || status === 422 || status === 428;
}

function apiDetail(status: number, json: unknown): string {
  const message =
    isRecord(json) && typeof json.message === "string" && json.message.trim()
      ? json.message.trim()
      : typeof json === "string" && json.trim()
        ? json.trim()
        : "";
  const violations = isRecord(json) && Array.isArray(json.violations) ? json.violations : [];
  const extra = violations
    .map((row) => {
      if (!isRecord(row)) return "";
      const field = typeof row.field === "string" ? row.field : typeof row.property === "string" ? row.property : "";
      const text = typeof row.message === "string" ? row.message : "";
      return [field, text].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .slice(0, 3)
    .join("; ");
  const body = [message, extra].filter(Boolean).join(" — ").slice(0, 220);
  return body ? `${status}: ${body}` : String(status);
}

function entityBody(json: unknown): Record<string, unknown> | null {
  if (isRecord(json) && asId(json.id) != null) return json;
  const rows = rowsFromList(json);
  return rows.find((row) => asId(row.id) != null) ?? null;
}

/** Účet, který pos-action právě zaplatila (u splitu to bývá nový účet, ne původní). */
export function orderIdFromPosPayData(data: unknown): number | null {
  if (!isRecord(data)) return null;
  const directOrder = isRecord(data.order) ? data.order : null;
  const direct = directOrder ? asId(directOrder.id) : null;
  if (direct != null && directOrder?.paid !== false) return direct;
  const orders = data.orders;
  if (!Array.isArray(orders)) return directOrder?.paid === false ? null : direct;
  for (const entry of orders) {
    if (!isRecord(entry)) continue;
    const order = isRecord(entry.order) ? entry.order : entry;
    if (order.paid === false) continue;
    const id = asId(order.id);
    if (id != null) return id;
  }
  return direct;
}

/**
 * Dotykačka PATCH bez aktuálního ETag (If-Match) odmítne. Když PATCH nestačí, pošleme celý záznam přes PUT.
 */
async function writeEntityTip(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">,
  accessToken: string,
  path: string,
  id: number,
  tipAmount: number,
): Promise<{ ok: boolean; detail: string }> {
  const current = await cloudFetch(cfg, accessToken, path);
  if (!current.ok) return { ok: false, detail: apiDetail(current.status, current.json) };
  const row = entityBody(current.json);
  if (row && Math.round(asAmount(row.tipAmount)) === tipAmount) return { ok: true, detail: "" };

  const ifMatch = current.etag;
  const partial = { id, tipAmount };
  let written = await cloudFetch(cfg, accessToken, path, { method: "PATCH", body: partial, ifMatch });
  if (!written.ok && written.status === 405) {
    written = await cloudFetch(cfg, accessToken, path, { method: "PUT", body: partial, ifMatch });
  }
  const readBack = async (): Promise<Record<string, unknown> | null> => {
    const again = await cloudFetch(cfg, accessToken, path);
    return again.ok ? entityBody(again.json) : null;
  };
  if (written.ok) {
    const saved = await readBack();
    if (saved && Math.round(asAmount(saved.tipAmount)) === tipAmount) return { ok: true, detail: "" };
  }
  if (row) {
    const full: Record<string, unknown> = { ...row, id, tipAmount };
    delete full.versionDate;
    delete full.moneyLogs;
    delete full.orderItems;
    written = await cloudFetch(cfg, accessToken, path, { method: "PUT", body: full, ifMatch });
    if (written.ok) {
      const saved = await readBack();
      if (saved && Math.round(asAmount(saved.tipAmount)) === tipAmount) return { ok: true, detail: "" };
    }
  }
  if (!written.ok) return { ok: false, detail: apiDetail(written.status, written.json) };
  return { ok: false, detail: "tip se po zápisu nepropsal" };
}

const tipProductByCloud = new Map<number, number | null>();

/** Položka Spropitné v katalogu. Bez ní jde na účet jen jídlo a spropitné se po zaplacení už nezapíše. */
export async function resolveDotykackaTipProductId(
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId"> & { productMap?: Record<string, number> },
  accessToken: string,
): Promise<number | null> {
  const mapped = cfg.productMap?.["oa-tip"];
  if (typeof mapped === "number" && Number.isFinite(mapped) && mapped !== 0) return mapped;
  const envRaw = process.env.DOTYKACKA_TIP_PRODUCT_ID?.trim();
  if (envRaw) {
    const envId = Number(envRaw);
    if (Number.isFinite(envId) && envId !== 0) return envId;
  }
  const cached = tipProductByCloud.get(cfg.cloudId);
  if (cached !== undefined) return cached;
  let found: number | null = null;
  for (let page = 1; page <= 6; page += 1) {
    const listed = await cloudFetch(cfg, accessToken, `/products?page=${page}&limit=100`);
    if (!listed.ok) break;
    const rows = rowsFromList(listed.json);
    found = pickTipProductId(rows);
    if (found != null || rows.length < 100) break;
  }
  tipProductByCloud.set(cfg.cloudId, found);
  return found;
}

/** Očekávané spropitné na ještě otevřeném účtu, než ho pokladna uzavře. */
export async function primeDotykackaOrderTip(input: {
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">;
  accessToken: string;
  orderId: number;
  tipAmountCzk: number;
}): Promise<void> {
  const tip = Math.round(input.tipAmountCzk);
  if (tip < 1) return;
  await writeEntityTip(input.cfg, input.accessToken, `/orders/${input.orderId}`, input.orderId, tip);
}

/**
 * Dotykačka `order/pay` pole `tips` ignoruje. Spropitné je `tipAmount` na účtu a na platbě (money log).
 * Vrací null, když je zapsané na platbě.
 */
export async function writeDotykackaPaidTip(input: {
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">;
  accessToken: string;
  orderId: number;
  tipAmountCzk: number;
}): Promise<string | null> {
  const tip = Math.round(input.tipAmountCzk);
  if (tip < 1) return null;

  let lastErr = "Dotykačka nevrátila platbu k účtu, kam zapsat spropitné.";
  let permanent = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const orderWrite = await writeEntityTip(
      input.cfg,
      input.accessToken,
      `/orders/${input.orderId}`,
      input.orderId,
      tip,
    );
    if (!orderWrite.ok) lastErr = `Dotykačka účet tip ${orderWrite.detail}`;

    const listed = await cloudFetch(input.cfg, input.accessToken, moneyLogsForOrderPath(input.orderId));
    if (!listed.ok) {
      lastErr = `Dotykačka money-logs ${apiDetail(listed.status, listed.json)}`;
      permanent = listed.status === 403 || listed.status === 401;
    } else {
      const log = pickMoneyLogForTip(rowsFromList(listed.json), input.orderId);
      if (log && Math.round(log.tipAmount) === tip) return null;
      if (log) {
        const written = await writeEntityTip(
          input.cfg,
          input.accessToken,
          `/money-logs/${log.id}`,
          log.id,
          tip,
        );
        if (written.ok) return null;
        lastErr = `Dotykačka money-logs tip ${written.detail}`;
        permanent = isHardTipFailure(written.detail);
      }
    }
    if (permanent && attempt >= 1) return lastErr;
    await new Promise((r) => setTimeout(r, 800));
  }
  return lastErr;
}

/** Platby k účtu. Řazení podle `id` API odmítne. */
export function moneyLogsForOrderPath(orderId: number): string {
  return `/money-logs?page=1&limit=20&filter=${encodeURIComponent(`_orderId|eq|${orderId}`)}`;
}

/** `id` u účtů nejde řadit (API vrátí 400). Bereme nejnovější podle versionDate. */
export function recentPaidOrdersPath(tableId: number): string {
  return `/orders?page=1&limit=20&sort=-versionDate&filter=${encodeURIComponent(`_tableId|eq|${tableId}`)}`;
}

export async function findRecentPaidOrderId(input: {
  cfg: Pick<DotykackaConfig, "apiBase" | "cloudId">;
  accessToken: string;
  tableId: number;
}): Promise<{ orderId: number | null; error?: string }> {
  const listed = await cloudFetch(input.cfg, input.accessToken, recentPaidOrdersPath(input.tableId));
  if (!listed.ok) return { orderId: null, error: apiDetail(listed.status, listed.json) };
  const orderId = pickRecentPaidOrderId(rowsFromList(listed.json), input.tableId);
  if (orderId == null) return { orderId: null, error: "na stole není zaplacený účet" };
  return { orderId };
}
