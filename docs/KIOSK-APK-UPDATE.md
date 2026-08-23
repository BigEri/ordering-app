# Kiosk APK – aktualizace z administrace

## Princip

1. **Web** (menu, admin, objednávky) se aktualizuje z Vercelu automaticky — tablety nic nemusí.

2. **Nativní APK** (`Tableordering`) — Admin → Zařízení: **Aktualizovat APK** u jednoho tabletu, nebo **Aktualizovat APK na všech tabletech**.

3. Tablet polluje `GET /api/devices/config` (Host i Admin). Při vyšším `apkUpdateNonce` stáhne APK z `appRelease.apkUrl` a spustí PackageInstaller.

4. Self-update stejného podpisu může proběhnout tiše; jinak se na tabletu ukáže dialog **Instalovat**. USB není potřeba.

## Aktuální release

| | |
|--|--|
| **Verze** | **1.25** (`versionCode` **26**) |
| **APK URL** | `https://app.tableflow.cz/releases/tableflow-kiosk.apk` |
| **Podpis** | debug (Android Studio) — stejný na všech tabletech z `assembleDebug` |
| **SHA256** | `93e9696bcae3912a8f0403a1cc29b8aa10f56f84827577aa9198e82cacea1548` |
| **Nové v 1.25** | PackageInstaller pro všechny (ne jen Device Owner); bez zabití procesu po instalaci; stažení APK i z odkazu ve WebView; hromadný update z adminu |

## 20 tabletů najednou

1. Nasaďte web s novým `public/releases/tableflow-kiosk.apk` **a zároveň** `KIOSK_APK_VERSION_CODE` / `SHA256`.
2. PC: `https://app.tableflow.cz/admin/devices` → **Aktualizovat APK na všech tabletech**.
3. Tablety online do ~15 s začnou stahovat. Sloupec **APK na tabletu** má ukázat `v1.25 (code 26)`.
4. Pokud se na tabletu ukáže **Instalovat**, potvrďte.

`KIOSK_APK_VERSION_CODE` na serveru musí být **vyšší** než na tabletu.

## Starší APK, která update zahazovala

Build, který update bez Device Owner zahodil, **si opravný APK sám nestáhne**. Jednou na každém takovém tabletu (ne USB):

1. Dlouhý stisk obrazovky → servisní PIN.
2. **Nastavení Androidu** → Chrome (nebo prohlížeč).
3. Otevřít `https://app.tableflow.cz/releases/tableflow-kiosk.apk` → **Instalovat**.
4. Další verze už jdou z adminu jedním kliknutím.

Pokud je tablet **Device Owner**, admin tlačítko může stačit i na starší verzi (skip se netýkal DO).

## Vercel – proměnné

| Proměnná | Hodnota |
|----------|---------|
| `KIOSK_APK_VERSION_CODE` | `26` |
| `KIOSK_APK_VERSION_NAME` | `1.25` |
| `KIOSK_APK_URL` | (prázdné = `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`) |
| `KIOSK_APK_SHA256` | `93e9696bcae3912a8f0403a1cc29b8aa10f56f84827577aa9198e82cacea1548` |

## Publikace nové verze APK

1. V `Tableordering/app/build.gradle.kts`: zvedněte `versionCode` a `versionName`.
2. `gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`
3. Zkopírujte do `ordering-app/public/releases/tableflow-kiosk.apk`
4. `node scripts/publish-kiosk-apk-hashes.mjs` → `KIOSK_APK_SHA256`
5. Nastavte env na Vercelu **spolu** s nasazením souboru (`vercel --prod`). SHA v env musí sedět na soubor, jinak tablety update zahodí.
6. Admin → **Aktualizovat APK na všech tabletech**.

Párování restaurace/stolu **přežije** update APK — drží server pod `deviceId` tabletu.

## Device Owner (volitelné — Lock Task)

**Lock Task** (Home / Recents nefungují) vyžaduje Device Owner **nebo** ruční whitelist v nastavení Androidu.

1. Factory reset tabletu.
2. První setup bez Google účtu (nebo podle návodu výrobce).
3. Nainstalujte kiosk APK.
4. USB debugging (jen toto nastavení, ne každou aktualizaci):

```bash
adb shell dpm set-device-owner com.example.tableordering/.KioskDeviceAdminReceiver
```

5. Ověření:

```bash
adb shell dpm get-device-owner
```

6. Otevřete APK → **Host (kiosk)** → spárujte v adminu. Po spárování se zapne **Lock Task**.

### Servisní PIN

- Výchozí PIN personálu: **2580**
- PIN je potřeba pro: servisní menu v Admin, přepnutí do Admin ze spárovaného Host, reset režimu

## Stabilní ID tabletu

APK používá `android-…` z `ANDROID_ID` — párování v DB přežije přeinstalaci se stejným podpisem.

## Související docs

- `docs/KIOSK-FULL-MODE-CHECKLIST.md` — audit kiosk režimu
