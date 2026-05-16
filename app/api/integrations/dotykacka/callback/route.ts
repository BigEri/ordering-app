import { NextRequest, NextResponse } from "next/server";

import { getSessionFromCookieHeader } from "../../../../../lib/server/auth";
import { recordIntegrationAuditEvent } from "../../../../../lib/server/integrationAudit";
import { consumeDotykackaOAuthState, peekDotykackaOAuthState } from "../../../../../lib/server/dotykackaOAuthState";
import { upsertRestaurantDotykackaOAuth } from "../../../../../lib/server/restaurantDotykacka";

/**
 * Dotykačka po „Allow“ přesměruje sem s ?token= (refresh) & cloudid= & state=
 * S platnou admin relací a `restaurantId` ve state → uložení do DB; jinak návod do .env.
 */
export async function GET(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get("token") ??
    req.nextUrl.searchParams.get("refresh_token") ??
    req.nextUrl.searchParams.get("refreshToken") ??
    "";
  const cloudid = req.nextUrl.searchParams.get("cloudid") ?? req.nextUrl.searchParams.get("cloudId") ?? "";
  const state = req.nextUrl.searchParams.get("state") ?? "";

  const session = getSessionFromCookieHeader(req.headers.get("cookie") ?? "");
  const cloudId = Number(cloudid);

  let restaurantId: string | null = null;
  let stateOk = false;
  let stateErr: "NOT_FOUND" | "EXPIRED" | "USED" | "FORBIDDEN" | null = null;
  const hasCallbackSecrets = Boolean(token.trim() && cloudid.trim() && Number.isFinite(cloudId));
  if (session && state.trim() && hasCallbackSecrets) {
    const consumed = await consumeDotykackaOAuthState({ state, userId: session.userId });
    if (consumed.ok) {
      restaurantId = consumed.restaurantId;
      stateOk = true;
    } else if (consumed.error === "USED") {
      // Dotykačka may retry the callback (refresh/back/reload). Allow idempotent save for the same user+state.
      const peek = await peekDotykackaOAuthState(state);
      if (peek.createdByUserId && peek.createdByUserId === session.userId && peek.restaurantId) {
        restaurantId = peek.restaurantId;
        stateOk = true;
      } else {
        stateErr = consumed.error;
      }
    } else {
      stateErr = consumed.error;
    }
  } else if (session && state.trim()) {
    // Don't consume state unless we actually have token+cloudId; otherwise we would burn the state and block retries.
    const peek = await peekDotykackaOAuthState(state);
    if (peek.createdByUserId && peek.createdByUserId !== session.userId) {
      stateErr = "FORBIDDEN";
    }
  }

  const canSaveToDb = Boolean(stateOk && restaurantId && hasCallbackSecrets);

  if (canSaveToDb && restaurantId) {
    try {
      await upsertRestaurantDotykackaOAuth({
        restaurantId,
        refreshToken: token,
        cloudId,
        apiBase: null,
      });
      await recordIntegrationAuditEvent({
        type: "dotykacka_connected",
        restaurantId,
        actorUserId: session?.userId ?? null,
        deviceId: null,
        details: { cloudId },
      });
      return new NextResponse(htmlSaved(restaurantId), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const extra =
        msg === "Missing DOTYKACKA_TOKEN_ENCRYPTION_KEY"
          ? "Na serveru chybí proměnná <code>DOTYKACKA_TOKEN_ENCRYPTION_KEY</code> (pro bezpečné uložení refresh tokenu). Doplňte ji do <code>.env.local</code> a restartujte server."
          : escapeHtml(msg);
      const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dotykačka — chyba uložení</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; }
    .warn { background: #fffbeb; border: 1px solid #f59e0b33; padding: 12px 14px; border-radius: 12px; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Dotykačku se nepodařilo uložit</h1>
  <div class="warn">
    <p style="margin:0 0 8px;"><strong>Proč:</strong> ${extra}</p>
    <p style="margin:0;">Po opravě klikněte v administraci na „Připojit Dotyku (OAuth)“ znovu.</p>
  </div>
  <p style="margin-top:14px;"><a href="/admin">Zpět do administrace</a></p>
</body>
</html>`;
      return new NextResponse(html, { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  }

  const peek = state ? await peekDotykackaOAuthState(state) : null;
  const ridFromPeek = peek?.restaurantId ?? null;
  const backHref = ridFromPeek ? `/admin/restaurants/${encodeURIComponent(ridFromPeek)}?tab=dotykacka` : "/admin";
  const retryHref = ridFromPeek
    ? `/api/integrations/dotykacka/connect?restaurantId=${encodeURIComponent(ridFromPeek)}`
    : "/admin";

  let reason = "";
  if (!session) {
    reason =
      "Nejste přihlášeni v administraci (session cookie chybí nebo vypršela). Připojení se proto nemohlo uložit do databáze.";
  } else if (!state.trim()) {
    reason =
      "Chybí parametr state. Připojení se nemohlo bezpečně uložit do databáze. Spusťte OAuth z detailu restaurace v administraci.";
  } else if (stateErr === "EXPIRED") {
    reason = "Přihlašovací požadavek (state) vypršel. Spusťte OAuth znovu.";
  } else if (stateErr === "USED") {
    reason = "Přihlašovací požadavek (state) už byl použit. Spusťte OAuth znovu.";
  } else if (stateErr === "FORBIDDEN") {
    reason =
      "Tento state nepatří vašemu účtu (OAuth spustil jiný admin / jiná session). Spusťte OAuth znovu z administrace.";
  } else if (stateErr === "NOT_FOUND") {
    reason =
      "Neznámý nebo neplatný state. Připojení se nemohlo bezpečně uložit do databáze. Spusťte OAuth znovu z administrace.";
  } else {
    reason =
      "Připojení se nepodařilo uložit do databáze. Spusťte OAuth znovu z administrace restaurace (musíte být přihlášeni).";
  }

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dotykačka — připojení nedokončeno</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; }
    code { display: block; background: #f3f4f6; padding: 12px; border-radius: 10px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
    p { color: #374151; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 18px; }
    .btn { display: inline-block; padding: 10px 14px; border-radius: 10px; text-decoration: none; border: 1px solid #d1d5db; color: #111827; background: #fff; }
    .btnPrimary { background: #111827; border-color: #111827; color: #fff; }
    .warn { background: #fffbeb; border: 1px solid #f59e0b33; padding: 12px 14px; border-radius: 12px; }
  </style>
</head>
<body>
  <h1>Připojení Dotykačky není dokončeno</h1>
  <div class="warn">
    <p style="margin: 0 0 8px;"><strong>Proč:</strong> ${escapeHtml(reason)}</p>
    <p style="margin: 0;">Nejjednodušší řešení je spustit OAuth znovu přímo z administrace pro konkrétní restauraci.</p>
  </div>

  <div class="actions">
    <a class="btn btnPrimary" href="${escapeHtml(retryHref)}">Zkusit OAuth znovu</a>
    <a class="btn" href="${escapeHtml(backHref)}">Zpět do administrace</a>
  </div>

  <details>
    <summary>Pokročilé: ruční konfigurace (nedoporučeno)</summary>
    <p>Pokud potřebujete, můžete dočasně zkopírovat hodnoty do <strong>.env</strong> (necommitovat). Pro multi-restaurant je ale lepší používat OAuth z adminu, aby se token uložil do databáze.</p>
    <code>DOTYKACKA_REFRESH_TOKEN=${escapeHtml(token)}
DOTYKACKA_CLOUD_ID=${escapeHtml(cloudid)}</code>
    <p>Volitelně <code>state</code>: <code>${escapeHtml(state)}</code></p>
    <p>Dále nastavte <code>DOTYKACKA_BRANCH_ID</code> a <code>DOTYKACKA_PRODUCT_MAP_JSON</code> — viz <code>ENV.example</code>.</p>
  </details>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlSaved(restaurantId: string) {
  const adminUrl = `/admin/restaurants/${encodeURIComponent(restaurantId)}?tab=dotykacka`;
  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dotykačka — uloženo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Dotykačka uložena pro provozovnu</h1>
  <p>Refresh token a cloud ID jsou v databázi. Doplňte ještě <strong>ID pobočky</strong> a mapu produktů v administraci.</p>
  <p><a href="${escapeHtml(adminUrl)}">Zpět do administrace — záložka Dotykačka</a></p>
</body>
</html>`;
}
