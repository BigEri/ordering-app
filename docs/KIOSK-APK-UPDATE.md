# Kiosk APK – tichá aktualizace z administrace

## Princip

1. **Web** (menu, admin) se aktualizuje z Vercelu automaticky.
2. **Nativní APK** (`Tableordering`) – vedoucí v **Admin → Zařízení** u konkrétního tabletu klikne **„Aktualizovat APK“**.
3. Tablet v **Host (kiosk)** režimu polluje `GET /api/devices/config` a při zvýšeném `apkUpdateNonce` stáhne APK z `appRelease.apkUrl`.
4. **Tichá instalace** funguje jen pokud je tablet **Device Owner** (viz níže).

## Vercel – proměnné (aktuální release 1.3)

| Proměnná | Hodnota |
|----------|---------|
| `KIOSK_APK_VERSION_CODE` | `4` |
| `KIOSK_APK_VERSION_NAME` | `1.3` |
| `KIOSK_APK_URL` | (prázdné = `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`) |
| `KIOSK_APK_SHA256` | `9c45750a923b8cfde976413914680fb7f0338d4cc6f3c9b941189f6d39ee6669` |

`KIOSK_APK_VERSION_CODE` musí být **vyšší** než verze na tabletu, jinak admin „Aktualizovat APK“ nic nestáhne.

Když `KIOSK_APK_URL` chybí, použije se `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`.

## Publikace APK

1. V Android Studiu: **Build → Generate Signed APK** (release) — stejný podpis jako na tabletech.
2. Zkopírujte APK do `ordering-app/public/releases/tableflow-kiosk.apk` a nasaďte web.
   - Dočasně může být `app-debug.apk` z `assembleDebug` (debug podpis), pokud tablety instalujete ze Studia.
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
