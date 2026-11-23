/**
 * Diagnostika Storyous: vypíše surovou odpověď `/checks` (otevřené účty) pro stoly provozovny.
 * Jen čte — nic do pokladny nezapisuje.
 *
 *   node --env-file=.env.local scripts/check-storyous-checks.mjs [deskId ...]
 *
 * Potřebuje STORYOUS_CLIENT_ID, STORYOUS_CLIENT_SECRET, STORYOUS_MERCHANT_ID, STORYOUS_PLACE_ID.
 * Bez deskId projde všechny stoly z `/deskViews/{merchantId-placeId}/desks`.
 */
const env = (k) => process.env[k]?.trim() ?? "";
const clientId = env("STORYOUS_CLIENT_ID");
const clientSecret = env("STORYOUS_CLIENT_SECRET");
const merchantId = env("STORYOUS_MERCHANT_ID");
const placeId = env("STORYOUS_PLACE_ID");
const apiBase = (env("STORYOUS_API_BASE") || "https://api.storyous.com").replace(/\/$/, "");
const authUrl = env("STORYOUS_AUTH_URL") || "https://login.storyous.com/api/auth/authorize";

if (!clientId || !clientSecret || !merchantId || !placeId) {
  console.error("Chybí STORYOUS_CLIENT_ID / STORYOUS_CLIENT_SECRET / STORYOUS_MERCHANT_ID / STORYOUS_PLACE_ID.");
  process.exit(1);
}

const tokenRes = await fetch(authUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
});
const token = (await tokenRes.json().catch(() => ({}))).access_token;
if (!token) {
  console.error(`Přihlášení do Storyous selhalo (HTTP ${tokenRes.status}).`);
  process.exit(1);
}
const sourceId = `${merchantId}-${placeId}`;

async function get(path) {
  const res = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* není JSON */
  }
  return { status: res.status, text, json };
}

function listRows(json) {
  if (Array.isArray(json)) return json;
  for (const key of ["data", "desks", "items"]) if (Array.isArray(json?.[key])) return json[key];
  return [];
}

let deskIds = process.argv.slice(2);
if (deskIds.length === 0) {
  const desks = await get(`/deskViews/${encodeURIComponent(sourceId)}/desks`);
  deskIds = listRows(desks.json)
    .map((d) => String(d?.deskId ?? d?.id ?? "").trim())
    .filter(Boolean);
  console.log(`Stoly: ${deskIds.join(", ") || "(žádné)"}`);
}

for (const deskId of deskIds) {
  const r = await get(`/checks/${encodeURIComponent(sourceId)}?deskId=${encodeURIComponent(deskId)}`);
  console.log(`\n=== stůl ${deskId} — GET /checks -> HTTP ${r.status}`);
  console.log(r.json ? JSON.stringify(r.json, null, 2) : r.text);
}
