/**
 * Kouřový test přístupu ke Storyous API (token, merchant, menu, stoly).
 * node --env-file=.env.local scripts/check-storyous-access.mjs
 */
const clientId = process.env.STORYOUS_CLIENT_ID?.trim();
const clientSecret = process.env.STORYOUS_CLIENT_SECRET?.trim();
const merchantId = process.env.STORYOUS_MERCHANT_ID?.trim();
const placeId = process.env.STORYOUS_PLACE_ID?.trim();
const apiBase = (process.env.STORYOUS_API_BASE?.trim() || "https://api.storyous.com").replace(/\/$/, "");
const authUrl =
  process.env.STORYOUS_AUTH_URL?.trim() || "https://login.storyous.com/api/auth/authorize";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function summarizeJson(value) {
  if (value == null) return "null";
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value !== "object") return typeof value;
  const keys = Object.keys(value);
  return `object{${keys.slice(0, 12).join(", ")}${keys.length > 12 ? ", …" : ""}}`;
}

async function request(label, url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  console.log(`\n${label}`);
  console.log(`  ${init?.method || "GET"} ${url}`);
  console.log(`  status ${res.status} ${res.statusText}`);
  if (!res.ok) {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 280);
    console.log(`  body: ${snippet || "(empty)"}`);
  }
  return { ok: res.ok, status: res.status, json, text };
}

function printMenuSummary(json) {
  if (!json || typeof json !== "object") return;
  const cats = Array.isArray(json.categories) ? json.categories : [];
  const items = Array.isArray(json.items)
    ? json.items
    : Array.isArray(json.products)
      ? json.products
      : [];
  const data = Array.isArray(json.data) ? json.data : [];
  console.log(`  keys: ${summarizeJson(json)}`);
  if (json.name) console.log(`  name: ${json.name}`);
  if (cats.length) console.log(`  categories: ${cats.length}`);
  if (items.length) console.log(`  products: ${items.length}`);
  if (data.length) console.log(`  data: ${data.length}`);
  const sample = items[0] || cats[0] || data[0];
  if (sample && typeof sample === "object") {
    const title = sample.name || sample.title || sample.id || sample.itemId;
    if (title) console.log(`  sample: ${title}`);
  }
}

function printDesks(json) {
  const desks = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.desks)
      ? json.desks
      : Array.isArray(json)
        ? json
        : [];
  const sections = Array.isArray(json?.sections) ? json.sections : [];
  const nested = sections.flatMap((s) => (Array.isArray(s.desks) ? s.desks : []));
  const all = desks.length ? desks : nested;
  console.log(`  desks: ${all.length}`);
  for (const d of all.slice(0, 8)) {
    const name = d.name || d.code || d.deskId || d.id;
    console.log(`    - ${name}`);
  }
  if (all.length > 8) console.log(`    … +${all.length - 8} further`);
}

async function main() {
  if (!clientId || !clientSecret || !merchantId || !placeId) {
    fail("Chybí STORYOUS_CLIENT_ID / SECRET / MERCHANT_ID / PLACE_ID v .env.local");
  }

  console.log("Storyous smoke test");
  console.log(`  auth: ${authUrl}`);
  console.log(`  api:  ${apiBase}`);
  console.log(`  merchantId: ${merchantId}`);
  console.log(`  placeId:    ${placeId}`);

  const tokenRes = await request("1) token", authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const accessToken = tokenRes.json?.access_token;
  if (!tokenRes.ok || !accessToken) fail("Token se nepodařilo získat.");
  console.log(`  token: OK (expires_at ${tokenRes.json.expires_at ?? "?"})`);

  const auth = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  const sourceId = `${merchantId}-${placeId}`;

  const merchant = await request("2) merchant", `${apiBase}/merchants/${merchantId}`, { headers: auth });
  if (merchant.ok && merchant.json) {
    console.log(`  name: ${merchant.json.name ?? "?"}`);
    const places = merchant.json.places || merchant.json.data;
    if (Array.isArray(places)) {
      console.log(`  places: ${places.length}`);
      for (const p of places.slice(0, 8)) {
        console.log(`    - ${p.name || p.placeId || p.id}${p.placeId === placeId || p.id === placeId ? "  ← PLACE_ID" : ""}`);
      }
    }
  }

  const menu = await request(
    "3) menu",
    `${apiBase}/menu/${merchantId}?placeId=${encodeURIComponent(placeId)}`,
    { headers: auth },
  );
  if (menu.ok) printMenuSummary(menu.json);

  const deskView = await request("4) desk view", `${apiBase}/deskViews/${sourceId}`, { headers: auth });
  if (deskView.ok) printDesks(deskView.json);

  const desks = await request("5) desks", `${apiBase}/deskViews/${sourceId}/desks`, { headers: auth });
  if (desks.ok) printDesks(desks.json);

  const okCount = [tokenRes, merchant, menu, deskView, desks].filter((r) => r.ok).length;
  console.log(`\nHotovo: ${okCount}/5 volání OK`);
  if (!merchant.ok || !menu.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
