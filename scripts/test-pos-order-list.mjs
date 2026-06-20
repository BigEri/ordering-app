/**
 * Diagnostika pos-actions order/list — simuluje produkční webhook flow.
 * node --env-file=.env.local scripts/test-pos-order-list.mjs
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TABLE_ID = 981457637888650;
const WEBHOOK_BASE = process.env.TEST_WEBHOOK_BASE?.trim() || "https://app.tableflow.cz";

async function getAccessToken(apiBase, refreshToken, cloudId) {
  const res = await fetch(`${apiBase}/v2/signin/token`, {
    method: "POST",
    headers: {
      Authorization: `User ${refreshToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ _cloudId: cloudId }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`signin ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (!data.accessToken) throw new Error("no accessToken");
  return data.accessToken;
}

async function waitWebhookBody(callbackId, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const row = await prisma.posActionWebhookCallback.findUnique({
      where: { callbackId },
      select: { body: true, resolvedAtIso: true },
    });
    if (row?.resolvedAtIso) return row.body ?? "";
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

async function main() {
  const row = await prisma.restaurantDotykacka.findFirst({
    select: { refreshToken: true, cloudId: true, branchId: true, apiBase: true },
  });
  if (!row) throw new Error("no restaurant_dotykacka row");

  const refreshToken = process.env.DOTYKACKA_REFRESH_TOKEN?.trim() || row.refreshToken?.trim();
  if (!refreshToken) throw new Error("no refresh token");

  const apiBase = (row.apiBase?.trim() || process.env.DOTYKACKA_API_BASE?.trim() || "https://api.dotykacka.cz").replace(/\/$/, "");
  const cloudId = row.cloudId || Number(process.env.DOTYKACKA_CLOUD_ID);
  const branchId = row.branchId || Number(process.env.DOTYKACKA_BRANCH_ID);
  const token = await getAccessToken(apiBase, refreshToken, cloudId);
  const url = `${apiBase}/v2/clouds/${cloudId}/branches/${branchId}/pos-actions`;

  console.log("cloud:", cloudId, "branch:", branchId);
  console.log("webhook_base:", WEBHOOK_BASE);
  console.log("table-id:", TABLE_ID);

  const callbackId = randomUUID();
  const expiresAtIso = new Date(Date.now() + 50_000).toISOString();
  await prisma.posActionWebhookCallback.upsert({
    where: { callbackId },
    create: { callbackId, body: null, createdAtIso: new Date().toISOString(), expiresAtIso, resolvedAtIso: null },
    update: { expiresAtIso, resolvedAtIso: null, body: null },
  });

  const body = {
    action: "order/list",
    "table-id": TABLE_ID,
    webhook: `${WEBHOOK_BASE}/api/integrations/dotykacka/pos-webhook?cb=${encodeURIComponent(callbackId)}`,
  };

  console.log("\nPOST pos-actions order/list …");
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const syncText = await res.text();
  const syncMs = Date.now() - t0;

  console.log("sync_http:", res.status, `(${syncMs}ms)`);
  console.log("sync_body_len:", syncText.length);
  console.log("sync_body_preview:", syncText.slice(0, 500) || "(empty)");

  console.log("\nwaiting for webhook (max 45s) …");
  const whText = await waitWebhookBody(callbackId, 45_000);
  console.log("webhook_received:", whText !== null);
  if (whText !== null) {
    console.log("webhook_body_len:", whText.length);
    console.log("webhook_body_preview:", whText.slice(0, 500) || "(empty)");
  }

  const recent = await prisma.posActionWebhookCallback.findMany({
    orderBy: { createdAtIso: "desc" },
    take: 5,
    select: { callbackId: true, resolvedAtIso: true, body: true, createdAtIso: true },
  });
  console.log("\nrecent_webhook_callbacks:");
  for (const r of recent) {
    const len = r.body?.length ?? 0;
    console.log(`- ${r.createdAtIso} resolved=${r.resolvedAtIso ? "yes" : "no"} body_len=${len}`);
  }
}

main()
  .catch((e) => {
    console.error("error:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
