# Nasazení na Vercel (ordering-app)

## Proč po deployi vidíte „Application error“

Úvodní stránka i layout **hned volají databázi** (Prisma). Bez správného nastavení server spadne.

Nejčastější příčiny:

1. Chybí **`DATABASE_URL`** ve Vercel Environment Variables
2. Migrace nebyly spuštěny (`prisma migrate deploy`)
3. Chybí **`APP_AUTH_SECRET`** (admin přihlášení)

---

## Minimální postup

### 1) PostgreSQL (Neon)

1. [neon.tech](https://neon.tech) → nový projekt
2. Zkopírujte **pooled** connection string (pro Vercel / serverless)
3. Uložte si i **direct** URL (pro migrace z PC)

### 2) Vercel → Environment Variables

V projektu: **Settings → Environment Variables** (Production + Preview):

| Proměnná | Hodnota |
|----------|---------|
| `DATABASE_URL` | pooled URL z Neonu |
| `APP_AUTH_SECRET` | dlouhý náhodný řetězec (stejný jako lokálně) |
| `NEXT_PUBLIC_APP_URL` | `https://vase-app.vercel.app` nebo vaše doména |
| `S3_BUCKET` | bucket pro fotky menu a úvodní stránky |
| `S3_ACCESS_KEY_ID` | přístupový klíč (R2 / S3) |
| `S3_SECRET_ACCESS_KEY` | tajný klíč |
| `S3_PUBLIC_URL_BASE` | veřejná URL bucketu (R2 public URL nebo CDN) |
| `S3_REGION` | u R2: `auto` |
| `S3_ENDPOINT` | u R2: `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_FORCE_PATH_STYLE` | u R2: `1` |

Volitelně doplňte z `.env.example` (Dotykačka, `BOOTSTRAP_TOKEN`, …).

### Sentry — sledování chyb (volitelné, free plán)

Aplikace už má `@sentry/nextjs` — stačí DSN na Vercelu:

| Proměnná | Hodnota |
|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN z projektu na [sentry.io](https://sentry.io) (Next.js) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_DSN` | stejné DSN (volitelně, pro server) |

Po **Redeploy** ověřte v adminu **Zařízení → Stav API** („Sledování chyb je zapnuté“).  
Testovací událost: `POST /api/admin/sentry-test` (přihlášený admin) — v Sentry uvidíte zprávu „test ze administrace“.

Bez DSN se Sentry nespustí — provoz kiosku tím není ovlivněn.

### Obrázky (Cloudflare R2 — stručně)

1. R2 → Create bucket → zapněte **Public access** (nebo custom domain).
2. **Manage R2 API tokens** → token s oprávněním Object Read & Write pro bucket.
3. `S3_PUBLIC_URL_BASE` = veřejná URL z R2 (např. `https://pub-….r2.dev`).
4. Po deployi: `GET /api/health` → `"imageStorage": "s3"`.

Bez S3 env zůstane režim `local` — na Vercelu fotky po redeploy zmizí.

### 3) Migrace databáze (z PC, jednou)

```powershell
cd ordering-app
$env:DATABASE_URL="postgresql://... DIRECT URL z Neonu ..."
npx prisma migrate deploy
```

### 4) Redeploy

Vercel → **Deployments** → poslední deploy → **Redeploy**.

---

## Build na Vercelu

Repozitář používá:

```json
"postinstall": "prisma generate",
"build": "prisma generate && next build"
```

Tím se na Vercelu vygeneruje Prisma Client před `next build`.

---

## Ověření

- Otevřete URL projektu — měla by se načíst úvodní stránka (ne „Application error“).
- `GET /api/setup/status` — JSON `{ ok: true, ... }` pokud DB funguje.

---

## Tablety (Android)

V APK je výchozí **`base_url`** = `https://app.tableflow.cz` (stejně jako `NEXT_PUBLIC_APP_URL`). Staré adresy `*.vercel.app` se při startu APK automaticky přepíší.

Bez nové APK: na tabletu v režimu Admin podržte obrazovku → **Nastavení URL** → `https://app.tableflow.cz`.

**Nahrávání fotek v adminu:** výběr souboru musí v nativní vrstvě WebView obsloužit `WebChromeClient.onShowFileChooser` (jinak tlačítko „Vybrat soubor“ v prohlížeči v APK nic neudělá — v Chrome na PC to funguje). Alternativa bez úpravy APK: vložit **URL obrázku** (HTTPS) místo uploadu ze zařízení.
