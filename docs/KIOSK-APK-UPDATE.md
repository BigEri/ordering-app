# Kiosk APK – tichá aktualizace z administrace

## Princip

1. **Web** (menu, admin) se aktualizuje z Vercelu automaticky.
2. **Nativní APK** (`Tableordering`) – vedoucí v **Admin → Zařízení** u konkrétního tabletu klikne **„Aktualizovat APK“**.
3. Tablet v **Host (kiosk)** režimu polluje `GET /api/devices/config` a při zvýšeném `apkUpdateNonce` stáhne APK z `appRelease.apkUrl`.
4. **Tichá instalace** funguje jen pokud je tablet **Device Owner**. Jinak se otevře **systémový dialog** instalace (APK 1.4+).

## Hromadný rollout (20 tabletů) — postup z adminu

1. Tablety nechte v režimu **Host** u stolů (spárované, WiFi).
2. Na PC: `https://app.tableflow.cz/admin/devices`.
3. U **každého** řádku klikněte **Aktualizovat APK** (klikáte na PC, ne u stolu).
4. Do ~1 minuty na tabletu:
   - **Device Owner** → tichá instalace,
   - jinak dialog **Instalovat** → potvrdit jednou na tabletu.
5. Po instalaci 1.4 se `*.vercel.app` adresa **sama přepíše** na `https://app.tableflow.cz`.
6. V adminu zkontrolujte **Online** a zkuste objednávku.

**Poznámka:** Tablet v režimu **Admin** APK nestahuje — musí být **Host**.

## Vercel – proměnné (aktuální release 1.4)

| Proměnná | Hodnota |
|----------|---------|
| `KIOSK_APK_VERSION_CODE` | `5` |
| `KIOSK_APK_VERSION_NAME` | `1.4` |
| `KIOSK_APK_URL` | (prázdné = `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`) |
| `KIOSK_APK_SHA256` | `91743e2a43d74966848b6fdf0b7f87792a7bf9006941461af0e766c1f85e511c` |

`KIOSK_APK_VERSION_CODE` musí být **vyšší** než verze na tabletu, jinak admin „Aktualizovat APK“ nic nestáhne.

Když `KIOSK_APK_URL` chybí, použije se `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`.

## Publikace APK

1. V Android Studiu: **Build → Generate Signed APK** (release) — stejný podpis jako na tabletech.
2. Zkopírujte APK do `ordering-app/public/releases/tableflow-kiosk.apk` a nasaďte web.
   - Pro tablety instalované ze Studia: `gradlew assembleDebug` → `app-debug.apk` (debug podpis).
   - Pro produkci později: signed release (`keystore.properties`) — stejný podpis jako na tabletech.
3. Nastavte env na Vercelu (`KIOSK_APK_VERSION_CODE` = `versionCode` z `app/build.gradle.kts`).
4. Spusťte migraci DB: `npx prisma migrate deploy` (sloupec `apkUpdateNonce`) — produkce Neon i lokál.

Hash pro Vercel: `node scripts/publish-kiosk-apk-hashes.mjs` → `KIOSK_APK_SHA256`.

## Device Owner (jednorázově na tablet)

Po factory reset / bez Google účtu:

```bash
adb shell dpm set-device-owner com.example.tableordering/.KioskDeviceAdminReceiver
```

Tablet musí být **Host (kiosk)**, ne osobní admin telefon vedoucího.

## Stabilní ID tabletu (přežije přeinstalaci APK)

APK používá `android-…` z `Settings.Secure.ANDROID_ID` (stejný podpis app). Párování v DB zůstane po odinstalaci a nové instalaci.

- **Jednou po nasazení této verze:** tablety dříve spárované náhodným UUID je potřeba **jednou znovu spárovat** (nové ID začíná `android-`). Pak už reinstall nevyžaduje párování.
- **Update APK bez odinstalace:** staré UUID v paměti tabletu zůstane, dokud neodinstalujete.

## Migrace DB

`20260603120000_kiosk_apk_update_nonce` – sloupec `apkUpdateNonce` v `KioskDeviceBinding`.
