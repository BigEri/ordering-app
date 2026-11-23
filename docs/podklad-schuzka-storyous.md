# Tableflow × Storyous — podklad na schůzku

Interní podklad (ne pro tisk restauraci). Restaurace: Storyous, 18 stolů.

---

## V jedné větě

Host si u stolu objedná z tabletu, objednávka jde rovnou do pokladny Storyous, na tabletu vidí svůj účet přesně podle pokladny a jedním klepnutím zavolá obsluhu nebo požádá o účet.

---

## Co Tableflow se Storyous umí

| Funkce | Jak to funguje |
| --- | --- |
| **Menu z pokladny** | Položky, ceny a přílohy se načítají ze Storyous — nic se nepřepisuje ručně. Fotky, popisy a štítky se doplní v Tableflow adminu. |
| **Objednávka z tabletu** | Jde přímo do pokladny na stůl, kde tablet stojí. Obsluha ji potvrdí a vytiskne se bon jako u každé objednávky. |
| **Jeden stůl = jeden účet** | Další objednávky se přidávají do otevřeného účtu stolu — i když ho založila obsluha. |
| **Účet na tabletu** | Host vidí, co má na účtu — včetně položek naťukaných obsluhou, storen a změn cen. |
| **Přivolání obsluhy** | Klepnutí na tabletu → obsluha to vidí v pokladně. |
| **Žádost o účet** | Host vybere způsob platby a spropitné, obsluha to vidí v pokladně. Prázdný účet tablet sám pohlídá („Na účtu zatím nic nemáte“). |
| **Konec návštěvy** | Jakmile obsluha účet v pokladně uzavře, tablet se vynuluje a připraví pro dalšího hosta. |
| **Víc jazyků** | Host si přepne jazyk menu (čeština, angličtina, …). |
| **Správa tabletů** | Vše z Tableflow adminu — aktualizace, obnovení, přiřazení ke stolům. Restaurace nic neinstaluje. |

---

## Co říct rovnou (ať to později nepřekvapí)

- **Platba kartou na tabletu u Storyous zatím není.** Host platí u obsluhy jako dnes (hotově nebo terminálem). U Dotykačky už to funguje — u Storyous na tom pracujeme, Storyous to pouští jen partnerům.
- Formulace: *„Objednávání a obsluha od stolu fungují kompletně. Placení kartou přímo na tabletu přidáme, jakmile ho Storyous otevře — u Dotykačky to už máme.“*

---

## Jak probíhá spuštění

1. **Restaurace požádá Storyous o zapnutí online objednávek** pro svou provozovnu (v pokladně pak přibude sekce *Objednávky*). Krátký e-mail nebo telefonát — text dodáme.
2. **Propojení se Storyous** — v Tableflow adminu se zadá Merchant ID a vybere provozovna, menu se načte samo.
3. **Doladění menu** — fotky, popisy, pořadí kategorií. Uděláme spolu s nimi.
4. **Pilot na 3–4 stolech** pár týdnů — obsluha si zvykne, doladíme detaily.
5. **Rozšíření na všech 18 stolů.**

---

## Otázky, které nejspíš padnou

**Musí obsluha každou objednávku potvrzovat?**
Ano, objednávka z tabletu se v pokladně potvrdí (stejně jako objednávky z Wolt/Foodora). Kuchyně tak nedostane nic, co obsluha neviděla.

**Co když vypadne internet?**
Tablet objednávku uloží (přežije i restart tabletu) a sám ji odešle, jakmile se spojení vrátí — host vidí, že nemusí objednávat znovu, a objednávka do kasy nikdy nepřijde dvakrát. Pokud výpadek trvá déle než 30 minut, tablet starou objednávku už nepošle (do kuchyně by přišla pozdě) a host objedná znovu. Obsluha může vždycky objednat ručně v pokladně jako dnes.

**Co když se něco v pokladně změní (storno, sleva)?**
Tablet to do pár vteřin ukáže — účet na tabletu se řídí pokladnou.

**Musíme měnit menu na dvou místech?**
Ne. Ceny a položky jdou z pokladny. V Tableflow se jen doplňují fotky a popisy.

**Kdo tablety spravuje a aktualizuje?**
My, z Tableflow adminu. Restaurace nemusí nic instalovat ani nastavovat.

**Co hosté, kteří tablet nechtějí?**
Obsluha je obslouží normálně. Tablet je možnost navíc, ne povinnost.

**Kdy bude placení kartou?**
Záleží na Storyous — řešíme to s nimi. Restauraci pomůže, když o tu funkci u svého obchodníka ve Storyous sama projeví zájem.

---

## Co zjistit na schůzce

- [ ] Používají **terminály Teya**? (důležité pro budoucí placení kartou)
- [ ] Mají v pokladně v bočním menu **Objednávky**? (pokud ne → žádost u Storyous)
- [ ] Rozdělují často účty u stolu?
- [ ] Kolik mají pokladen / tabletů Storyous a který je hlavní?
- [ ] Souhlas s **pilotem** — kolik stolů a od kdy?
- [ ] Kdo bude kontakt za restauraci (provozní / majitel)?
- [ ] Zájem o placení kartou na tabletu? (argument pro Storyous)

---

## Text pro restauraci → Storyous

> Dobrý den, budeme používat objednávkové tablety Tableflow napojené na Storyous. Prosíme o zapnutí příjmu objednávek přes Delivery API (objednávky na stůl i doobjednávky na otevřený účet) pro naši provozovnu [název]. Do budoucna bychom měli zájem i o placení kartou z tabletu Tableflow. Děkujeme.
