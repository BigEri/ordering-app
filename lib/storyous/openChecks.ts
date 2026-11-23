import { composeBillLineLabel, type TableBillLine } from "../dotykacka/tableOpenBill";

/**
 * Otevřené účty u stolu ze Storyous (`GET /checks/{merchantId-placeId}?deskId=`).
 * Endpoint není ve veřejné dokumentaci — parser proto přijímá víc názvů polí
 * (stejné, jaké Storyous používá v Bills API a v loyalty `itemsToPay`).
 */

export type StoryousOpenCheck = {
  /** PaymentSessionCode — `checkId` pro `deliveryType: "orderToCheck"`. */
  checkId: string;
  deskId: string;
  createdAtMs: number;
  lines: TableBillLine[];
  totalCzk: number;
};

export type StoryousOpenChecksParse = {
  /** false = odpověď nemá očekávaný tvar — volající se musí chovat jako bez živého účtu. */
  readable: boolean;
  checks: StoryousOpenCheck[];
};

export type StoryousDeskBill = {
  open: boolean;
  lines: TableBillLine[];
  totalCzk: number;
  checkIds: string[];
};

/** Začátky poznámek 0 Kč položek z tabletu (přivolání obsluhy, žádost o účet). */
const SIGNAL_NOTE_PREFIXES = ["přivolání obsluhy", "chce zaplatit", "stůl - "];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstStr(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = str(rec[key]);
    if (v) return v;
  }
  return "";
}

function firstNum(rec: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = num(rec[key]);
    if (v !== null) return v;
  }
  return null;
}

function firstArray(rec: Record<string, unknown>, keys: string[]): unknown[] | null {
  for (const key of keys) {
    const v = rec[key];
    if (Array.isArray(v)) return v;
  }
  return null;
}

function timeMs(rec: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const n = Date.parse(str(rec[key]));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

const CLOSED_STATES = new Set(["closed", "paid", "deleted", "removed", "cancelled", "canceled", "refunded", "issued"]);
const REMOVED_ITEM_STATES = new Set(["deleted", "removed", "storno", "cancelled", "canceled", "void"]);

function isClosedCheck(rec: Record<string, unknown>): boolean {
  for (const key of ["closed", "isClosed", "paid", "isPaid", "deleted", "_removed", "removed"]) {
    if (rec[key] === true) return true;
  }
  if (str(rec.paidAt) || str(rec.closedAt)) return true;
  const state = (str(rec.state) || str(rec.status)).toLowerCase();
  return state !== "" && CLOSED_STATES.has(state);
}

function isRemovedItem(rec: Record<string, unknown>): boolean {
  for (const key of ["deleted", "_removed", "removed", "storno", "cancelled", "canceled", "isStorno"]) {
    if (rec[key] === true) return true;
  }
  const state = (str(rec.state) || str(rec.status)).toLowerCase();
  return state !== "" && REMOVED_ITEM_STATES.has(state);
}

function checkDeskId(rec: Record<string, unknown>): string {
  const direct = str(rec.deskId);
  if (direct) return direct;
  const desk = asRecord(rec.desk);
  if (desk) return firstStr(desk, ["deskId", "id"]);
  return str(rec.desk);
}

type ParsedItem = {
  name: string;
  note: string;
  qty: number;
  unitPriceCzk: number;
  productId: string;
  additionNames: string[];
  additionUnitCzk: number;
  /** Bills API: příloha je samostatný řádek s `additionsCode` = `hasAdditionsWithCode` rodiče. */
  hasAdditionsWithCode: string;
  additionsCode: string;
};

function itemQty(rec: Record<string, unknown>): number | null {
  const q = firstNum(rec, ["amount", "count", "quantity", "qty"]);
  if (q === null) return 1;
  return q > 0 ? q : null;
}

function itemUnitPrice(rec: Record<string, unknown>, qty: number): number | null {
  const unit = firstNum(rec, ["unitPriceWithVat", "priceWithVat", "unitPrice", "price"]);
  if (unit !== null) return unit;
  const total = firstNum(rec, ["totalPriceWithVat", "totalPrice", "total"]);
  if (total !== null && qty > 0) return total / qty;
  return null;
}

function nestedAdditions(rec: Record<string, unknown>): { names: string[]; unitCzk: number } {
  const raw = firstArray(rec, ["additions", "customizations"]);
  if (!raw) return { names: [], unitCzk: 0 };
  const names: string[] = [];
  let unitCzk = 0;
  for (const row of raw) {
    const add = asRecord(row);
    if (!add || isRemovedItem(add)) continue;
    const label = firstStr(add, ["name", "title", "label"]);
    if (label) names.push(label);
    const perMain = firstNum(add, ["countPerMainItem", "amount", "count"]) ?? 1;
    const price = firstNum(add, ["unitPriceWithVat", "priceWithVat", "price", "additionPrice"]) ?? 0;
    unitCzk += price * perMain;
  }
  return { names, unitCzk };
}

function parseItem(raw: unknown): ParsedItem | null {
  const rec = asRecord(raw);
  if (!rec || isRemovedItem(rec)) return null;
  const product = asRecord(rec.product);
  const name = firstStr(rec, ["name", "title", "productName", "itemName"]) || (product ? firstStr(product, ["name", "title"]) : "");
  const note = str(rec.note);
  if (!name && !note) return null;
  const qty = itemQty(rec);
  if (qty === null) return null;
  const unit = itemUnitPrice(rec, qty);
  if (unit === null) return null;
  const additions = nestedAdditions(rec);
  // `/checks`: `priceWithVat` je cena za kus včetně příloh (vedle něj `priceWithVatWithoutAdditions`).
  const unitIncludesAdditions = num(rec.priceWithVatWithoutAdditions) !== null && num(rec.priceWithVat) !== null;
  return {
    name,
    note,
    qty,
    unitPriceCzk: unitIncludesAdditions ? (num(rec.priceWithVat) as number) : unit,
    productId: firstStr(rec, ["productId", "itemId"]) || (product ? str(product.productId) : ""),
    additionNames: additions.names,
    additionUnitCzk: unitIncludesAdditions ? 0 : additions.unitCzk,
    hasAdditionsWithCode: str(rec.hasAdditionsWithCode),
    additionsCode: str(rec.additionsCode),
  };
}

function isSignalItem(item: ParsedItem, signalProductId: string | null | undefined): boolean {
  if (item.unitPriceCzk + item.additionUnitCzk !== 0) return false;
  if (signalProductId && item.productId === signalProductId) return true;
  const note = item.note.toLowerCase();
  const name = item.name.toLowerCase();
  return SIGNAL_NOTE_PREFIXES.some((p) => note.startsWith(p) || name.startsWith(p));
}

function isPaidItem(raw: unknown): boolean {
  const rec = asRecord(raw);
  return Boolean(rec && (rec.paid === true || rec.isPaid === true));
}

function itemsToLines(items: ParsedItem[]): TableBillLine[] {
  const childrenByCode = new Map<string, ParsedItem[]>();
  const parents: ParsedItem[] = [];
  const parentCodes = new Set(items.map((i) => i.hasAdditionsWithCode).filter(Boolean));
  for (const item of items) {
    if (item.additionsCode && parentCodes.has(item.additionsCode)) {
      const list = childrenByCode.get(item.additionsCode) ?? [];
      list.push(item);
      childrenByCode.set(item.additionsCode, list);
      continue;
    }
    parents.push(item);
  }
  return parents.map((item) => {
    const kids = item.hasAdditionsWithCode ? childrenByCode.get(item.hasAdditionsWithCode) ?? [] : [];
    const kidsUnit = item.qty > 0 ? kids.reduce((s, k) => s + k.unitPriceCzk * k.qty, 0) / item.qty : 0;
    const labeled = composeBillLineLabel(item.name || item.note, item.name ? item.note : "", [
      ...item.additionNames,
      ...kids.map((k) => k.name),
    ]);
    const line: TableBillLine = {
      name: labeled.name,
      qty: item.qty,
      unitPriceCzk: Math.round(item.unitPriceCzk + item.additionUnitCzk + kidsUnit),
    };
    if (labeled.detail) line.detail = labeled.detail;
    return line;
  });
}

function checkRows(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  const root = asRecord(json);
  if (!root) return null;
  return firstArray(root, ["data", "checks", "items"]);
}

export function parseStoryousOpenChecks(
  json: unknown,
  opts: { deskId?: string; signalProductId?: string | null } = {},
): StoryousOpenChecksParse {
  const rows = checkRows(json);
  if (!rows) return { readable: false, checks: [] };
  const wantDesk = opts.deskId?.trim() ?? "";
  const checks: StoryousOpenCheck[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    if (!rec || isClosedCheck(rec)) continue;
    const checkId = firstStr(rec, [
      "checkId",
      "paymentSessionCode",
      "paymentSessionId",
      "sessionCode",
      "sessionId",
      "code",
      "id",
      "_id",
    ]);
    if (!checkId) continue;
    const deskId = checkDeskId(rec);
    if (wantDesk && deskId && deskId !== wantDesk) continue;
    const rawItems = firstArray(rec, ["items", "checkItems", "orderedItems", "itemsToPay", "products", "lines"]) ?? [];
    const parsed: ParsedItem[] = [];
    let skippedPaid = false;
    for (const item of rawItems) {
      if (isPaidItem(item)) {
        skippedPaid = true;
        continue;
      }
      const p = parseItem(item);
      if (p && !isSignalItem(p, opts.signalProductId)) parsed.push(p);
    }
    const lines = itemsToLines(parsed);
    const linesTotal = lines.reduce((s, l) => s + l.qty * l.unitPriceCzk, 0);
    const declared = firstNum(rec, ["finalPrice", "totalPriceWithVat", "totalPrice", "total", "price"]);
    checks.push({
      checkId,
      deskId: deskId || wantDesk,
      createdAtMs: timeMs(rec, ["sessionCreated", "sessionCreatedAt", "createdAt", "openedAt", "created"]),
      lines,
      // Částečně zaplacený účet: celková cena z pokladny obsahuje i zaplacené položky.
      totalCzk: Math.round(skippedPaid || declared === null ? linesTotal : declared),
    });
  }
  return { readable: true, checks };
}

/** Všechny otevřené účty na stole dohromady — stejně jako Dotykačka u `order/list`. */
export function storyousDeskBillFromChecks(checks: StoryousOpenCheck[]): StoryousDeskBill {
  const lines = checks.flatMap((c) => c.lines);
  return {
    open: checks.length > 0,
    lines,
    totalCzk: checks.reduce((s, c) => s + c.totalCzk, 0),
    checkIds: checks.map((c) => c.checkId),
  };
}

/**
 * Účet, na který tablet doobjednává: nejstarší otevřený účet stolu
 * (první založený = hlavní účet, další vznikly typicky rozdělením v pokladně).
 */
export function pickStoryousTargetCheck(checks: StoryousOpenCheck[]): StoryousOpenCheck | null {
  if (checks.length === 0) return null;
  let best = checks[0]!;
  for (const c of checks.slice(1)) {
    if (c.createdAtMs > 0 && (best.createdAtMs === 0 || c.createdAtMs < best.createdAtMs)) best = c;
  }
  return best;
}
