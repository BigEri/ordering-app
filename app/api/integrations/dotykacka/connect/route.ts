import { NextRequest, NextResponse } from "next/server";

import { getDotykackaOAuthClientConfig } from "../../../../../lib/dotykacka/config";
import { requireAdminSession } from "../../../../../lib/server/adminGuard";
import { userHasRestaurantAccess } from "../../../../../lib/server/auth";
import { createDotykackaOAuthState } from "../../../../../lib/server/dotykackaOAuthState";

/**
 * Přesměrování na grant stránku Dotyky (refresh token).
 * Volitelně `?restaurantId=` — po návratu se token uloží pro tuto provozovnu (přihlášený admin).
 * Při chybách HTML stránka (ne holý JSON), aby po kliknutí v adminu nebyla „bílá obrazovka“.
 */
export async function GET(req: NextRequest) {
  const urlObj = new URL(req.url);
  const restaurantId = urlObj.searchParams.get("restaurantId")?.trim() ?? "";
  const backHref =
    restaurantId !== ""
      ? `/admin/restaurants/${encodeURIComponent(restaurantId)}?tab=dotykacka`
      : "/admin";

  const oauth = getDotykackaOAuthClientConfig();
  if (!oauth) {
    return htmlErrorPage({
      status: 500,
      title: "Dotykačka OAuth — chybí konfigurace",
      message:
        "Na serveru nejsou nastavené proměnné <code>DOTYKACKA_CLIENT_ID</code> a <code>DOTYKACKA_CLIENT_SECRET</code>. Bez nich nelze spustit připojení k Dotyce.",
      hintHtml:
        "Doplňte je do <code>.env</code> / <code>.env.local</code>, restartujte <code>next dev</code> a zkuste znovu.",
      backHref,
    });
  }

  if (restaurantId) {
    try {
      const session = await requireAdminSession(req.headers.get("cookie"));
      if (session.globalRole !== "SUPER_ADMIN") {
        const a = await userHasRestaurantAccess(session.userId, restaurantId);
        if (!a.ok) {
          return htmlErrorPage({
            status: 403,
            title: "Přístup zamítnut",
            message: "K této provozovně nemáte v aplikaci přístup (členství v restauraci).",
            backHref,
          });
        }
      }
    } catch {
      return htmlErrorPage({
        status: 401,
        title: "Nejste přihlášeni",
        message:
          "OAuth musíte spustit z přihlášené administrace — session cookie po přihlášení chybí nebo vypršela.",
        hintHtml:
          'Otevřete znovu <a href="/admin">přihlášení do adminu</a>, přihlaste se, vraťte se do detailu restaurace a klikněte znovu na „Připojit Dotyku“.',
        backHref: "/admin",
      });
    }
  }

  const envBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, "")}` : "");
  const base = envBase || urlObj.origin;
  if (!base) {
    return htmlErrorPage({
      status: 500,
      title: "Chybí veřejná URL aplikace",
      message:
        "Pro OAuth musí být známá adresa callbacku. Nastavte <code>NEXT_PUBLIC_APP_URL</code> (např. <code>http://localhost:3000</code> — port musí sedět s běžícím serverem).",
      hintHtml:
        "Na Vercelu často stačí proměnná <code>VERCEL_URL</code>; lokálně vždy nastavte <code>NEXT_PUBLIC_APP_URL</code>.",
      backHref,
    });
  }

  const redirectUri = `${base}/api/integrations/dotykacka/callback`;
  // Multi-restaurant safety: bind OAuth state to the initiating admin + restaurant in DB.
  // (prevents tampering/replay and ensures restaurantId belongs to this admin session)
  let state = crypto.randomUUID();
  if (restaurantId) {
    const session = await requireAdminSession(req.headers.get("cookie"));
    state = await createDotykackaOAuthState({ restaurantId, createdByUserId: session.userId });
  }

  const params = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    scope: "*",
    redirect_uri: redirectUri,
    state,
  });

  const url = `https://admin.dotykacka.cz/client/connect?${params.toString()}`;
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dotykačka OAuth — přesměrování</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; }
    .box { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 16px; background: #fff; }
    .btn { display: inline-block; padding: 10px 14px; border-radius: 10px; text-decoration: none; border: 1px solid #d1d5db; color: #111827; background: #fff; }
    .btnPrimary { background: #111827; border-color: #111827; color: #fff; }
    .muted { color: #6b7280; font-size: 0.95rem; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Otevírám Dotykačku…</h1>
  <div class="box">
    <p>Pokud se nic nestane, klikněte na tlačítko níže:</p>
    <p><a class="btn btnPrimary" href="${escapeHtml(url)}" rel="noreferrer">Pokračovat do Dotykačky</a></p>
    <p class="muted">Po udělení přístupu vás Dotykačka vrátí zpět do aplikace na <code>${escapeHtml(redirectUri)}</code>.</p>
  </div>
  <script>
    // Fallback for browsers/extensions that behave oddly on empty redirects.
    window.location.href = ${JSON.stringify(url)};
  </script>
</body>
</html>`;
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlErrorPage(input: {
  status: number;
  title: string;
  message: string;
  hintHtml?: string;
  backHref: string;
}) {
  const extraHint = input.hintHtml ? `<p class="hint">${input.hintHtml}</p>` : "";

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; background: #0f1115; color: #e5e7eb; line-height: 1.55; }
    h1 { font-size: 1.35rem; margin: 0 0 12px; color: #fecaca; }
    p { margin: 0 0 12px; color: #d1d5db; }
    code { font-size: 0.9em; background: #1f2937; padding: 2px 6px; border-radius: 4px; }
    .hint { font-size: 0.95rem; color: #9ca3af; margin-top: 16px; }
    .hint a { color: #93c5fd; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title)}</h1>
  <p>${input.message}</p>
  ${extraHint}
  <p class="hint"><a href="${escapeHtml(input.backHref)}">← Zpět do administrace (Dotykačka)</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: input.status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
