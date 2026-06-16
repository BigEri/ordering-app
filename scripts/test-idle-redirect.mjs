/**
 * E2E testy idle redirectu na /menu (scénáře 3A a 3B).
 * Vyžaduje běžící `npm run dev` a NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS=10000.
 */
import { chromium } from "playwright";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const MENU_URL = `${BASE}/menu?fromWelcome=1`;
const IDLE_MS = Number(process.env.NEXT_PUBLIC_MENU_IDLE_REDIRECT_MS ?? "10000");
const WAIT_MS = IDLE_MS + 2500;
const MENU_CART_SESSION_STORAGE_KEY = "ordering.menuCart.v1";

function isWelcomeUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

function isMenuUrl(url) {
  return url.includes("/menu");
}

async function openMenu(page) {
  await page.goto(MENU_URL, { waitUntil: "networkidle", timeout: 60_000 });
  if (!isMenuUrl(page.url())) {
    throw new Error(`expected /menu, got ${page.url()}`);
  }
}

async function waitIdlePeriod(page) {
  console.log(`  waiting ${WAIT_MS}ms without interaction…`);
  await page.waitForTimeout(WAIT_MS);
}

/** Naplní košík přes sessionStorage (stejně jako po F5) a obnoví stránku. */
async function seedCartViaSessionStorage(page) {
  await page.evaluate(async (storageKey) => {
    const deviceId = localStorage.getItem("kiosk.deviceId")?.trim() || crypto.randomUUID();
    if (!localStorage.getItem("kiosk.deviceId")) {
      localStorage.setItem("kiosk.deviceId", deviceId);
    }
    const tableId = localStorage.getItem("kiosk.tableId")?.trim() || "1";
    const res = await fetch("/api/public/menu-context");
    const j = await res.json();
    const restaurantId = typeof j.restaurantId === "string" ? j.restaurantId.trim() : "";
    if (!restaurantId) throw new Error("menu-context: missing restaurantId");

    const payload = {
      v: 1,
      scope: { restaurantId, deviceId, tableId },
      cart: {
        "e2e-line": {
          item: { id: "e2e-item", name: "E2E Test položka", priceCzk: 100 },
          qty: 1,
          excludedIngredients: [],
          selectedAddonIds: [],
        },
      },
    };
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, MENU_CART_SESSION_STORAGE_KEY);

  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  if (!isMenuUrl(page.url())) {
    throw new Error(`expected /menu after reload, got ${page.url()}`);
  }
}

async function runScenario3A(page) {
  console.log("\n[3A] prázdný košík → idle redirect na welcome");
  await openMenu(page);
  await waitIdlePeriod(page);
  const url = page.url();
  if (!isWelcomeUrl(url)) {
    throw new Error(`expected welcome, still on ${url}`);
  }
  console.log("  PASS —", url);
}

async function runScenario3B(page) {
  console.log("\n[3B] košík s položkou → idle redirect se nespustí");
  await openMenu(page);
  await seedCartViaSessionStorage(page);
  console.log("  cart seeded via sessionStorage");
  await waitIdlePeriod(page);
  const url = page.url();
  if (!isMenuUrl(url)) {
    throw new Error(`expected to stay on /menu, got ${url}`);
  }
  console.log("  PASS — still on menu:", url);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let failed = false;

  for (const [name, fn] of [
    ["3A", runScenario3A],
    ["3B", runScenario3B],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await fn(page);
    } catch (err) {
      failed = true;
      console.error(`  FAIL [${name}]:`, err instanceof Error ? err.message : err);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  if (failed) {
    process.exit(1);
  }
  console.log("\nAll idle redirect scenarios passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
