# Kiosk APK – aktualizace z administrace



## Princip



1. **Web** (menu, admin, objednávky) se aktualizuje z Vercelu automaticky — tablety nic nemusí.

2. **Nativní APK** (`Tableordering`) — vedoucí v **Admin → Zařízení** u konkrétního tabletu: **Aktualizovat APK** → potvrdit dialog.

3. Tablet v **Host** režimu polluje `GET /api/devices/config` a při vyšším `apkUpdateNonce` stáhne APK z `appRelease.apkUrl`.

4. **Tichá instalace** jen s **Device Owner**; jinak systémový dialog **Instalovat** na tabletu.



## Aktuální release



| | |

|--|--|

| **Verze** | **1.7** (`versionCode` **8**) |

| **APK URL** | `https://app.tableflow.cz/releases/tableflow-kiosk.apk` |

| **Podpis** | debug (Android Studio) — stejný na všech tabletech z `assembleDebug` |

| **SHA256** | `d43427c2df4794192daa535954d934051f6569021bb5d18cb7640d9a788eb938` |

| **Nové v 1.7** | Tvrdší DO lock (uninstall block, restrikce, re-lock, Home launcher), ven jen servisní PIN |



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

| `KIOSK_APK_VERSION_CODE` | `8` |

| `KIOSK_APK_VERSION_NAME` | `1.7` |

| `KIOSK_APK_URL` | (prázdné = `{NEXT_PUBLIC_APP_URL}/releases/tableflow-kiosk.apk`) |

| `KIOSK_APK_SHA256` | `d43427c2df4794192daa535954d934051f6569021bb5d18cb7640d9a788eb938` |



## Publikace nové verze APK



1. V `Tableordering/app/build.gradle.kts`: zvedněte `versionCode` a `versionName`.

2. `gradlew assembleDebug` → `app/build/outputs/apk/debug/app-debug.apk`

3. Zkopírujte do `ordering-app/public/releases/tableflow-kiosk.apk`

4. `node scripts/publish-kiosk-apk-hashes.mjs` → `KIOSK_APK_SHA256`

5. Nastavte env na Vercelu, nasaďte web (`vercel --prod`).

6. V adminu u každého tabletu **Aktualizovat APK** (jen native Device Owner — viz níže AirDroid).



## AirDroid Business MDM (doporučeno pro víc poboček)



Tablety enrollnuté v **AirDroid** jako Device Owner + kiosk Single App → Tableflow **nejsou** Device Owner v naší APK. Na nich:



| Co | Kde |
|----|-----|
| Kiosk zámek | AirDroid → Policy & Kiosk |
| Update **APK** | AirDroid → Apps → App Library → **Update** → **Force Install** (stejný soubor jako na serveru) |
| Párování stůl / restaurace | Tableflow admin → Zařízení → Párování |
| Menu, ceny, objednávky | Tableflow admin (web deploy) |
| Vynutit obnovení stránky | Tableflow admin → Zařízení |

**Nepoužívejte** `adb dpm set-device-owner` pro Tableflow na AirDroid tabletech — Device Owner drží AirDroid Biz Daemon.



### Release checklist (jedna verze APK)



1. `assembleDebug` → `tableflow-kiosk.apk` na Vercel (`public/releases/`).
2. Stejný soubor → AirDroid **Organization App Library** → Update → Force Install + Autorun App.
3. Native tablety (pokud máte) → navíc Admin → **Aktualizovat APK**.

Párování restaurace/stolu **přežije** update APK — drží server pod `deviceId` tabletu.



## Device Owner (native kiosk — bez AirDroid)



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


