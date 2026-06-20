# Kiosk APK — checklist plného režimu (Tableordering)

Audit projektu `AndroidStudioProjects/Tableordering` vůči „opravdovému“ kiosku, ze kterého host neodejde do systému.

**Stav od verze 1.6 (versionCode 7):** Lock Task, autostart po bootu, Device Owner policies, servisní PIN, blokace `/admin` a file chooser v Host režimu — **implementováno**. Bez Device Owner lock task nemusí fungovat (viz níže).

---

## Co funguje (včetně 1.6)

| Oblast | Stav | Kde |
|--------|------|-----|
| WebView pro Host / Admin | ✅ | `MainActivity.kt` |
| Fullscreen + displej vždy zapnutý | ✅ | `enterFullscreen()`, `FLAG_KEEP_SCREEN_ON` |
| Filtrování URL (jen stejný host) | ✅ | `shouldOverrideUrlLoading` |
| Back tlačítko neukončí app | ✅ | `onKeyDown(KEYCODE_BACK)` |
| Režim Host po spárování bez nastavení | ✅ | `isHostConfigured()` |
| Polling reload + APK update | ✅ | `KioskConfigPoller.kt` |
| Device Owner → tichá instalace APK | ✅ | `KioskApkUpdater.installSilently()` |
| **Lock Task (Host + spárovaný)** | ✅ 1.6 | `KioskLockManager.kt`, `updateKioskLockState()` |
| **Autostart po bootu** | ✅ 1.6 | `KioskBootReceiver.kt` |
| **DO policies (status bar, skrytí app)** | ✅ 1.6 | `KioskLockManager.applyDeviceOwnerPolicies()` |
| **Servisní PIN** | ✅ 1.6 | `KioskServicePin.kt` (výchozí 2580) |
| **Blokace /admin v Host** | ✅ 1.6 | `shouldOverrideUrlLoading` |
| **Blokace file chooser v Host** | ✅ 1.6 | `onShowFileChooser` |
| Stabilní ID tabletu | ✅ | `KioskDeviceId.kt` |
| User-Agent pro web | ✅ | `TableOrderingKiosk/1.0` |

---

## Co dál volitelně (nice to have)

### HOME launcher / single-app režim

S Lock Task + Device Owner je Home obvykle blokované. Dedikovaný HOME intent filter zatím **není** — lock task stačí.

**Priorita:** 🟢 nízká

---

## Historický audit (před 1.6)

Níže původní seznam mezer — většina kritických bodů je vyřešena v 1.6.

### 1. Lock Task Mode — ✅ hotovo v 1.6

**Doplnit:**

```kotlin
// MainActivity — po startu v MODE_HOST + isHostConfigured()
private fun enterKioskLockIfHost() {
    if (getMode() != MODE_HOST || !isHostConfigured()) return
    val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val admin = ComponentName(this, KioskDeviceAdminReceiver::class.java)
    if (dpm.isDeviceOwnerApp(packageName)) {
        dpm.setLockTaskPackages(admin, arrayOf(packageName))
    }
    if (dpm.isLockTaskPermitted(packageName)) {
        startLockTask()
    }
}
```

V `AndroidManifest.xml` u `MainActivity`:

```xml
android:lockTaskMode="if_whitelisted"
```

Volat v `onResume()` (lock task po updatu / pádu může spadnout) a `stopLockTask()` jen při přepnutí do Admin nebo servisního režimu.

**Priorita:** ~~🔴 nejvyšší~~ hotovo

---

### 2. Autostart po restartu tabletu — ✅ hotovo v 1.6

Po vypnutí/zapnutí tablet skončí mimo aplikaci, dokud ho personál znovu neotevře.

**Doplnit:**

- permission `RECEIVE_BOOT_COMPLETED` v manifestu
- `KioskBootReceiver` → `Intent` na `MainActivity` + `FLAG_ACTIVITY_NEW_TASK`
- volitelně `setShowWhenLocked(true)` / `setTurnScreenOn(true)` na Activity (API 27+)

**Priorita:** ~~🔴 vysoká~~ hotovo

---

### 3. Device Owner policies — ✅ hotovo v 1.6

**Doplnit po `adb shell dpm set-device-owner …`:**

| Policy | API | Účel |
|--------|-----|------|
| Lock task whitelist | `setLockTaskPackages()` | viz bod 1 |
| Skrýt status bar | `setStatusBarDisabled(admin, true)` | host neotevře rychlé nastavení |
| Zakázat keyguard | `setKeyguardDisabled(admin, true)` | žádná obrazovka PIN při probuzení |
| Omezit factory reset | `addUserRestriction(DISALLOW_FACTORY_RESET)` | obtížnější únik |
| Skrýt ostatní aplikace | `setApplicationHidden()` | Settings, Chrome, Play Store |
| Lock task features | `setLockTaskFeatures()` | vypnout notifikace v lock task (API 28+) |

Rozšířit `device_admin.xml` o potřebné `<uses-policies>` (např. `limit-password`, `disable-keyguard-features` dle API).

**Priorita:** ~~🔴 vysoká~~ hotovo

---

### 5. PIN / skryté gesto pro personál — ✅ hotovo v 1.6

Před spárováním funguje long-press → **Reset režimu** (návrat na dialog Host/Admin).

**Doplnit:**

- servisní menu jen po zadání **PIN** (uložený v prefs nebo na serveru)
- v Host režimu **žádný** long-press (už sk casi je — držet)
- `/kiosk/reset-mode` z webu v Host režimu **ignorovat** nebo vyžadovat native PIN

**Priorita:** ~~🟠 střední~~ hotovo

---

### 6. Uzavření úniků z WebView — ✅ částečně v 1.6

| Riziko | Stav | Návrh |
|--------|------|-------|
| File chooser (`onShowFileChooser`) | Otevře systémový picker | V Host režimu zakázat nebo povolit jen fotoaparát in-app |
| APK update bez DO | `installWithIntent` → systémový instalátor | OK pro setup; v produkci vyžadovat DO |
| Interní URL `/admin` | WebView načte, pokud na ni někdo naviguje | V Host režimu v `shouldOverrideUrlLoading` blokovat cesty `/admin`, `/kiosk/reset-mode` |
| `mixedContentMode = ALWAYS_ALLOW` | HTTP v HTTPS | Zvážit `COMPATIBILITY_MODE` pro produkci |

**Priorita:** 🟠 střední

---

### 7. Dokumentace a provisioning

V `KIOSK-APK-UPDATE.md` je jen jeden řádek o Device Owner. Chybí:

- krok za krokem: factory reset → bez Google účtu → ADB → ověření `dpm get-device-owner`
- ověření lock task: `adb shell dumpsys activity activities | grep mLockTaskMode`
- co dělat, když DO nejde nastavit (work profile, účet, jiný MDM)

**Priorita:** 🟠 střední (provoz)

---

### 8. Release podpis místo debug

Docs uvádějí **debug podpis** z `assembleDebug`. Pro Device Owner a konzistentní OTA na všech tabletech:

- sjednotit **release keystore** (`keystore.properties`)
- publikovat podepsané release APK
- `KIOSK_APK_SHA256` pro release build

**Priorita:** 🟠 střední (nasazení)

---

## Co chybí — nice to have

| Položka | Poznámka |
|---------|----------|
| `WindowInsetsController` místo deprecated `systemUiVisibility` | API 30+, čistší fullscreen |
| `allowBackup="false"` | méně rizika obnovy prefs jinam |
| Wake na touch po screensaveru | `FLAG_KEEP_SCREEN_ON` už je |
| Blokace power tlačítka | HW — řeší kiosk stojan nebo MDM |
| Kiosk health heartbeat do adminu | částečně přes `lastSeen` v DB |
| Detekce „lock task spadl“ + alert | log / Sentry native |

**Priorita:** 🟢 nízká

---

## Mapa: režim tabletu vs. zámek

```
┌─────────────────────────────────────────────────────────────┐
│  První spuštění (mode == null)                              │
│  Dialog Host / Admin — NENÍ lock task                       │
│  Long-press → nastavení URL, reset režimu                   │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────┐
│  Host — nepárovaný   │              │  Admin               │
│  /kiosk/pair         │              │  /admin              │
│  Long-press → setup  │              │  Long-press → menu   │
│  NENÍ lock task      │              │  NENÍ lock task      │
└──────────────────────┘              └──────────────────────┘
          │ spárování
          ▼
┌──────────────────────┐
│  Host — spárovaný    │  ← TADY má být lock task + DO policies
│  /?deviceId=…        │
│  Long-press vypnutý  │
│  ALE: Home, Recents, │  ← Dnes stále funguje (bez lock task)
│  Settings, restart   │
└──────────────────────┘
```

---

## Doporučené pořadí implementace

1. **Lock Task** v Host + spárovaný (`startLockTask` + manifest `lockTaskMode`)
2. **`setLockTaskPackages`** při Device Owner
3. **Boot receiver** — autostart MainActivity
4. **DO policies** — status bar, skrytí Settings/Chrome
5. **Blokace `/admin` a reset-mode** v Host WebView
6. **PIN pro servisní menu** (Admin + setup)
7. **Release keystore** + aktualizace docs
8. Drobnosti (Insets, backup, file chooser)

---

## Ověření po nasazení (QA)

| Test | Očekávání |
|------|-----------|
| Home | Nic — zůstane v Tableflow |
| Recents / Overview | Nic — lock task |
| Back na úvodní stránce | Nic (nebo webová navigace) |
| Stažení lišty / rychlé nastavení | Skryté (DO) |
| Restart tabletu | App se sama spustí do Host menu |
| Long-press na spárovaném Host | Nic |
| Otevření Chrome / Settings | Skryté nebo nedostupné (DO) |
| Aktualizace APK z adminu | Tiše (DO) nebo dialog (bez DO) |
| Přepnutí do Admin | Jen přes PIN / servisní postup |

---

## Související soubory

| Projekt | Soubor |
|---------|--------|
| Android | `Tableordering/app/src/main/java/.../MainActivity.kt` |
| Android | `KioskApkUpdater.kt`, `KioskConfigPoller.kt`, `KioskDeviceAdminReceiver.kt` |
| Android | `app/src/main/AndroidManifest.xml`, `res/xml/device_admin.xml` |
| Web | `ordering-app/lib/kiosk/modeSwitch.ts`, `KioskStaffBackButton.tsx` |
| Docs | `docs/KIOSK-APK-UPDATE.md` |

---

*Checklist: audit + implementace 1.6 (versionCode 7).*
