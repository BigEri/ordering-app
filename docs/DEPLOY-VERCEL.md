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

Volitelně doplňte z `.env.example` (Dotykačka, `BOOTSTRAP_TOKEN`, …).

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

V APK nastavte **base_url** na stejnou HTTPS doménu jako `NEXT_PUBLIC_APP_URL`.
