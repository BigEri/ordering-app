# Administrace Tableflow — návod pro vedoucího

**Adresa:** https://app.tableflow.cz/admin  
**Přihlášení:** e-mail a heslo (vpravo dole **Můj účet** = změna hesla).

Po přihlášení jste rovnou v **Menu** své provozovny. Vlevo jsou záložky. Ceny a jídla se berou z **Dotykačky** — v Tableflow je jen skrýváte, řadíte, fotíte a překládáte.

---

## Menu

Hlavní stránka. Vidíte stejné menu jako host na tabletu, plus tlačítka úprav.

**Nahoře**
- **Jazyk náhledu** — jak menu vypadá v daném jazyce (samotné překlady se píší jinde).
- **Náhled pro zákazníka** — otevře menu tak, jak ho vidí host.
- **Překlady jazyků** — názvy a popisy v EN / KO (viz níže).
- **Obnovit z Dotykačky** — stáhne aktuální jídla a ceny z pokladny a obnoví tablety. Použijte po změně v Dotyce.

**U kategorie**
- **Skrýt kategorii / Zobrazit kategorii** — celá sekce zmizí nebo se vrátí hostům.

**U jídla (lišta Úpravy)**
- **Skrýt / Zobrazit** — položka zmizí z tabletu, v Dotyce zůstane.
- **↑ ↓** — pořadí v kategorii (jen v Tableflow, ne v Dotyce).
- **Foto** — nahrát soubor (JPEG/PNG/WebP, max. 5 MB) nebo vložit HTTPS odkaz. Lepší jsou fotky **na šířku** (16:9).

Skrytí jen tady (bez změny v Dotyce) se na tabletu projeví po obnovení stránky. Nové ceny z Dotyky až po **Obnovit z Dotykačky**.

---

## Překlady menu

Otevře se z Menu tlačítkem **Překlady jazyků**.

Přepněte jazyk nahoře. V **češtině** většinou nic nevyplňujte — prázdné pole = text z Dotykačky. Doplňujte hlavně **angličtinu** a **korejštinu**.

**Co se dá vyplnit**
1. **Kategorie** — nadpisy sekcí (Předkrmy, Hlavní jídla…).
2. **Položky** — název, volitelný popis, ingredience („odebrat z jídla“).
3. **Doplňky** — názvy příloh a úprav u jídla (z Dotykačky).

Změna se uloží, když **odejdete z pole** (klik jinam / Tab), přepnete jazyk, nebo kliknete **Uložit**.

Ingredience: **Interní název** je klíč (stejný ve všech jazycích), **Zobrazení v menu** je text, který vidí host.

---

## Uživatelé

Účty do administrace této provozovny.

**Přidat účet:** e-mail, heslo (min. 8 znaků), role → **Uložit**.
- **Personál** — párování tabletů, obnova menu, běžný provoz.
- **Vedoucí (admin)** — totéž plus úpravy úvodní obrazovky a uživatelů.

Stejný e-mail znovu s novým heslem účet obnoví.

**Seznam:** u personálu **Odebrat** (ztratí přístup). Jiného vedoucího odebrat nemůžete — to umí jen technik. Sebe taky ne.

Heslo sobě měňte v **Můj účet**, ne tady.

---

## Zařízení

Tablety u stolů, online/offline, stůl v Dotyce, verze aplikace.

**Tlačítka nahoře**
- **Obnovit seznam** — jen aktualizuje tuto stránku, na tablety nic nepošle.
- **Vynutit obnovení všech tabletů** — všechny online tablety se do ~15 s obnoví.
- **Obnovit menu z Dotykačky** — nové ceny/jídla z pokladny + obnoví tablety.
- **Párování u stolů** — nový tablet (viz další kapitola).

**U každého tabletu**
- **Upravit stůl** — přesunout tablet na jiný stůl z Dotykačky.
- **Aktualizovat APK** — nová verze aplikace na tabletu (potvrdit dialog). Tablet musí být online. Neplatí pro tablety spravované přes AirDroid.
- **Vynutit obnovení** — zaseklý tablet / divné menu. Musí mít internet.
- **Odstranit zařízení** — tablet zmizí ze seznamu; u stolu ho znovu spárujte.

Nahoře je **Stav API** — zelená hláška u Dotykačky = objednávky můžou chodit. Žlutá = propojení není hotové (záložka Dotykačka).

---

## Párování tabletu

Ze **Zařízení** → **Párování u stolů**, nebo z QR na tabletu.

1. Na tabletu je 6místný kód (vyprší — zadejte vždy aktuální).
2. Kód opsat sem.
3. Vybrat **stůl z Dotykačky** (ne jen název z plánku — jde o stůl v pokladně).
4. **Spárovat tablet**.
5. Na tabletu počkat, nebo znovu otevřít menu.

Když seznam stolů chybí, není hotové propojení v záložce **Dotykačka**.

---

## Úvodní obrazovka

Fotky a rozložení první obrazovky tabletu (výběr jazyka). Vpravo je živý náhled.

**Rozložení:** mozaika · dvě poloviny · čtyři čtvrtiny · jedna plocha (střídání fotek).

**Obrázky** (max. 6, max. 10 MB)
- **Nahrát** — soubor z počítače (uloží se hned).
- **Vybrat z menu** — už nahrané fotky jídel.
- nebo vložit HTTPS odkaz a kliknout **Uložit**.

Pořadí řádků = pořadí střídání. Každý řádek jiná fotka. **Otevřít welcome** ukáže výsledek v novém okně.

---

## Dotykačka

Propojení s pokladnou. Bez něj tablety nenačtou stoly ani nepošlou objednávku.

1. **Připojit Dotykačku (OAuth)** — přihlášení k účtu Dotypos.
2. Vybrat **pobočku** ze seznamu (ne Cloud ID — to je účet, pobočka je konkrétní provozovna).
3. Vyplnit, pokud používáte přivolání / účet (bez toho tlačítka na tabletu neodešlou nic):
   - produkt **Přivolání obsluhy** (skrytá položka 0 Kč v Dotyce, štítek `oa-volani` — tisk bonu)
   - produkt **Žádost o platbu** (stejný princip; ne do poznámky u účtu hosta)
   - stůl **Tableflow obsluha** — sem jdou volání, ne na účet hosta; prázdné = účty mimo stoly
4. **Uložit pobočku a mapu**.

**Odpojit / Zapnout** — dočasně vypne odesílání do Dotyky. **Mapa produktů** a **API base** neměňte, pokud k tomu nemáte pokyn od technika.

Stav nahoře: **aktivní** = v pořádku. Červená chyba = znovu OAuth, nebo volat technika.

---

## Můj účet

Jen **změna vlastního hesla**: staré → nové (min. 8 znaků, dvakrát) → **Uložit nové heslo**.

---

## Veřejné menu ↗

Odkaz vlevo. Menu v prohlížeči, jak ho vidí host (bez tabletu). Hodí se na kontrolu fotek a překladů. Objednávka odsud nejde na konkrétní stůl.

---

## Rychlá pomoc

| Co potřebujete | Kam | Co kliknout |
|----------------|-----|-------------|
| Nový tablet u stolu | Zařízení → Párování | **Spárovat tablet** |
| Staré ceny z Dotyky | Menu nebo Zařízení | **Obnovit z Dotykačky** |
| Zaseklý tablet | Zařízení | u tabletu **Vynutit obnovení** |
| Schovat jídlo jen na tabletu | Menu | u jídla **Skrýt** |
| Fotka jídla | Menu | u jídla **Foto** |
| Anglický / korejský název | Menu → Překlady | vyplnit pole, odejít z něj |
| Účet pro obsluhu | Uživatelé | role Personál → **Uložit** |
| Nová verze appky na tabletu | Zařízení | **Aktualizovat APK** |

**Volat technika:** párování opakovaně selhává, Dotykačka hlásí chybu, nejde více tabletů najednou, nebo si nejste jistí u OAuth / pobočky.
