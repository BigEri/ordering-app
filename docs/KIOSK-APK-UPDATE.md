# Kiosk APK – aktualizace z administrace



## Princip



1. **Web** (menu, admin, objednávky) se aktualizuje z Vercelu automaticky — tablety nic nemusí.

2. **Nativní APK** (`Tableordering`) — vedoucí v **Admin → Zařízení** u konkrétního tabletu: **Aktualizovat APK** → potvrdit dialog.

3. Tablet v **Host** režimu polluje `GET /api/devices/config` a při vyšším `apkUpdateNonce` stáhne APK z `appRelease.apkUrl`.

4. **Tichá instalace** jen s **Device Owner**; jinak systémový dialog **Instalovat** na tabletu.



## Aktuální release



| | |

|--|--|

| **Verze** | **1.6** (`versionCode` **7**) |

| **APK URL** | `https://app.tableflow.cz/releases/tableflow-kiosk.apk` |

| **Podpis** | debug (Android Studio) — stejný na všech tabletech z `assembleDebug` |

| **Nové v 1.6** | Lock Task (Host + spárovaný), autostart po bootu, DO policies, servisní PIN |



## Postup u jednoho tabletu



1. Tablet v režimu **Host** u stolu (WiFi, spárovaný).

2. PC: `https://app.tableflow.cz/admin/devices`.

3. **Aktualizovat APK** → dialog (verze na tabletu vs. server) → potvrdit.

4. Admin ~2 min čeká na hlášení verze; sloupec **APK na tabletu** má ukázat `v1.6 (code 7) ✓`.

5. Na tabletu případně potvrdit **Instalovat** (bez Device Owner).



`KIOSK_APK_VERSION_CODE` na serveru musí být **vyšší** než na tabletu, jinak se nic nestáhne (zelená zpráva = verze už sedí).



## Vercel – proměnné



| Proměnná | Hodnota |

|----------|---------|

| `KIOSK_APK_VERSION_CODE` | `7` |

| `KIOSK_APK_VERSION_NAME` | `1.6` |

| `KIOSK_APK_URL` | (prázdné = `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`) |

| `KIOSK_APK_SHA256` | `675ccd926bcb0ace2a48c4b7cc9ccd232ffd57cd6263e7f5c53f75fb1f141977` |



## Publikace nové verze APK



1. V `Tableordering/app/build.gradle.kts`: zvedněte `versionCode` a `versionName`.

2. `gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`

3. Zkopírujte do `ordering-app/public/releases/tableflow-kiosk.apk`

4. `node scripts/publish-kiosk-apk-hashes.mjs` → `KIOSK_APK_SHA256`

5. Nastavte env na Vercelu, nasaďte web (`vercel --prod`).

6. V adminu u každého tabletu **Aktualizovat APK**.



## Device Owner (doporučeno — kiosk + tiché updaty)



**Lock Task** (Home / Recents nefungují) vyžaduje Device Owner **nebo** ruční whitelist v nastavení Androidu. Pro provoz u stolu nastavte Device Owner:



1. **Factory reset** tabletu.

2. První setup **bez Google účtu** (nebo podle návodu výrobce).

3. Nainstalujte kiosk APK (`adb install` nebo z releases).

4. Připojte USB debugging a spusťte:



```bash

adb shell dpm set-device-owner com.example.tableordering/.KioskDeviceAdminReceiver

```



5. Ověření:



```bash

adb shell dpm get-device-owner

adb shell dumpsys activity activities | findstr /i locktask

```



6. Otevřete APK → **Host (kiosk)** → spárujte v adminu. Po spárování se zapne **Lock Task**.



### Servisní PIN



- Výchozí PIN personálu: **2580**

- Změna: Admin režim → dlouhý stisk → Nastavení URL → pole „Nový servisní PIN“

- PIN je potřeba pro: servisní menu v Admin, přepnutí do Admin ze spárovaného Host, reset režimu



## Stabilní ID tabletu



APK používá `android-…` z `ANDROID_ID` — párování v DB přežije přeinstalaci se stejným podpisem.



## Související docs



- `docs/KIOSK-FULL-MODE-CHECKLIST.md` — audit kiosk režimu


