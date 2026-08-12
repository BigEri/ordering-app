# Tablet u stolu — rychlý návod pro obsluhu

**Aplikace:** Tableflow  
**Administrace:** https://app.tableflow.cz/admin

**Přihlášení:** e-mail a heslo od vedoucího. Bez přihlášení nelze párovat tablety ani obnovovat menu.

---

## 1. Tablet ukazuje „není spárovaný“ / párovací kód

**Na tabletu:** velký **párovací kód** (6 znaků) a text, že tablet není u stolu.

**Co udělat:**

1. Přihlaste se do **administrace** → **Zařízení**.
2. Sjeďte na **Párování u stolů (kiosk)**  
   *(nebo otevřete odkaz z QR na tabletu, pokud ho máte)*.
3. Zadejte **kód z tabletu** (přesně jak je na obrazovce).
4. Vyberte **stůl z Dotykačky** (číslo stolu).
5. Klikněte **Spárovat tablet**.
6. Na tabletu počkejte chvíli nebo otevřete menu znovu (výběr jazyka → menu).

**Když to nejde:** zkontrolujte WiFi na tabletu. Kód vyprší — na tabletu se obnoví nový, zadejte aktuální.

---

## 2. Přivolání obsluhy z tabletu (bon, ne poznámka)

Host stiskne **Přivolat personál** → do Dotykačky se přidá skrytá položka 0 Kč a má se vytisknout **bon** (notifikace) se stolem.

**Jednorázové nastavení (správce + Dotykačka Cloud):**

1. V Dotykačce založte produkt např. **Přivolání obsluhy**, cena **0 Kč**, skrytý z nabídky, štítek **`oa-volani`**.
2. V naší administraci → restaurace → Dotykačka zadejte **product ID** tohoto produktu (pole „Přivolání obsluhy“).
3. V Dotykačce u tiskáren: **tisk objednávek** jen pro štítek `oa-volani` (bon pro obsluhu); **tisk účtenek** bez tohoto štítku, ať položka není na dokladu hosta.

Bez nastaveného product ID přivolání do Dotykačky neodejde.

---

## 3. Změnili jsme cenu nebo jídlo v Dotykačce — na tabletu je pořád staré menu

**Změna v Dotykačce se na tablet sama hned nepropsala.**

**Co udělat:**

1. **Admin** → **Zařízení**.
2. Nahoře klikněte **Obnovit menu z Dotykačky**.
3. Počkejte **cca 15 sekund** — tablety v provozu se samy obnoví (musí být **online**).
4. Na tabletu zkontrolujte cenu / položku v menu.

**Poznámka:** Skrytí jídla jen v naší administraci (bez Dotykačky) se projeví jinak — na tabletu stačí obnovit stránku.

---

## 4. Tablet „zaseklý“, nereaguje, divné menu

**Co udělat (v tomto pořadí):**

1. **Zkuste obnovit stránku** — pokud jde, vraťte se na úvod a znovu do menu.
2. V **administraci** → **Zařízení** → u daného tabletu **Vynutit obnovení**.  
   Tablet se do **~15 s** sám obnoví (**musí mít internet**).
3. Pořád nic → **vypnout a zapnout tablet** (držet power).
4. Pořád nic → volat **vedoucího / technika**.

**Důležité:** Tlačítko **Obnovit** nahoře na stránce Zařízení jen aktualizuje seznam v adminu — na tablet to **nepošle**. Potřebujete **Vynutit obnovení** u konkrétního tabletu.

---

## 5. Host říká, že objednávka nešla / nic se nestalo

**Co zkontrolovat:**

| Kde | Co hledat |
|-----|-----------|
| **Tablet** | Banner **„Problém s připojením“** → slabá WiFi; host ať zkusí znovu nebo přivolá obsluhu |
| **Tablet — košík** | Po potvrzení jsou **3 tečky** `…` cca **10 s** — to je normální čekání |
| **Tablet — chyba** | Červená hláška u tlačítka Potvrdit → host ať zkusí **Potvrdit znovu** nebo přivolá obsluhu |
| **Dotykačka u stolu** | Je účet otevřený? Jsou tam položky od hosta? |
| **Dotykačka** | Není účet zamčený u pokladny? (někdo na něm pracuje) |

**Co udělat vy:**

1. V Dotyce **doplňte objednávku ručně**, pokud na tabletu neodešla.
2. Zkontrolujte **WiFi** na tabletu.
3. V adminu u tabletu **Vynutit obnovení**.
4. Opakuje se to → **vedoucí**.

---

| **Aktualizace APK tabletů** | Native kiosk: Zařízení → **Aktualizovat APK**. AirDroid MDM: v AirDroid App Library → Update → Force Install (ne z adminu). Viz `docs/KIOSK-APK-UPDATE.md` |

---

## Rychlá tabulka

| Problém | Kde v adminu | Tlačítko / akce |
|--------|----------------|------------------|
| Nepárovaný tablet | Zařízení → Párování | **Spárovat tablet** |
| Staré ceny / menu z Dotyce | Zařízení (nahoře) | **Obnovit menu z Dotykačky** |
| Tablet zaseknutý | Zařízení → řádek tabletu | **Vynutit obnovení** |
| Nová verze APK (native kiosk) | Zařízení → řádek tabletu | **Aktualizovat APK** (potvrdit dialog) |
| Nová verze APK (AirDroid MDM) | AirDroid konzole | App Library → Update → Force Install |
| Objednávka nešla | Dotykačka + WiFi | ručně v Dotyce + případně vynutit obnovení |

---

## Kdy volat vedoucího / technika

- Párování opakovaně nefunguje
- Dotykačka není propojená (v adminu hláška u Dotykačky)
- Více tabletů najednou nefunguje
- Cokoli, v čem si nejste jistí

---

## Tisk do PDF

1. Otevřete tento soubor v editoru nebo na GitHubu.
2. Zkopírujte do Word / Google Docs, nebo použijte náhled Markdown → tisk.
3. **Tisk → Uložit jako PDF**.
4. Vytiskněte a dejte k pokladně (ideálně laminovat).
