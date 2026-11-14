# Balancing – Alltagsheld

Alle Zahlen stehen in `src/game/balance.ts`. Dieses Dokument beschreibt, wie sie zustande kommen,
und hält das Ergebnis der Simulation fest (SPEC §11). Stand: **v0.5.0**, nach dem Balancing-Feedback.

```bash
npm run simulate                 # Tabellen, 240 Tage, 7 Durchläufe je Szenario
npm run simulate -- --days=365   # länger
npm run simulate -- --markdown   # Ausgabe als Markdown-Tabelle (wie unten)
```

## Simulationsmodell

Die Simulation (`src/game/simulation.ts`) nutzt **dieselben Funktionen wie die App**: Abhaken, Gewohnheiten,
Tagesabrechnung mit Quote, Tod, Level-Up, Kampf-Engine, Truhen und Boss-Belohnungen.

- **Dein Profil** (aus deinem Backup vom 14.11.2026):
  - 13 tägliche Aufgaben
  - 4 positive und 3 negative Gewohnheiten (Stärke 1), jede höchstens 1× am Tag
- **Erfüllung:** Jede tägliche Aufgabe wird mit dieser Wahrscheinlichkeit erledigt.
  Jede „+“-Gewohnheit wird mit 60 % angetippt, jede „−“-Gewohnheit mit 30 %. Das sind etwa 3–4 Tipps am Tag, wie von dir geschätzt.
- **Szenario „5 verpasst + 2× −“:** genau 5 zufällige Aufgaben fehlen pro Tag, dazu 2 verschiedene „−“-Gewohnheiten.
- **Attributpunkte** werden optimal verteilt: immer das Attribut, das die Wand am weitesten nach hinten schiebt.
- **Shop:**
  - Erst eine Holztruhe für jeden der 4 Plätze.
  - Dann wird je Platz auf eine Eisentruhe gespart, danach auf Goldtruhen.
  - Das bessere Teil wird angelegt, das schlechtere für 25 % verkauft.
  - Boss-Truhen werden sofort für den schwächsten Platz geöffnet.
- **Kampf** nur, solange die App offen ist, 300 s pro Tag. Laufen, Sieg und Rückzug zählen mit.
- **Auswertung:** Median über feste Seeds, jeder Lauf ist reproduzierbar.
  Die Meilensteine unten stammen aus 101 Läufen je Erfüllung, die Verlaufstabelle aus 15.

## Formeln

### Belohnungen und Vitalität

| Was | Formel |
|---|---|
| Tägliche Aufgabe | Alle Aufgaben zusammen: **200 XP und 100 Gold**, gleich verteilt. 13 Aufgaben → je **15 XP, 8 Gold**. Keine Vitalität |
| Gewohnheit „+“ (1× am Tag) | Alle „+“ zusammen: 25 % des Tagesbudgets (50 XP, 25 Gold), gleich verteilt. 4 Gewohnheiten → je 13 XP, 6 Gold, dazu **+2 Vitalität** |
| Gewohnheit „−“ (1× am Tag) | −3 Vitalität und −5 Gold je Stärke, kein XP-Verlust |
| Tagesquote → Vitalität | erledigt ÷ alle Aufgaben (nach Anzahl). **Unter 60 %:** linear −30 (0 %) bis −1. **60–70 %:** ±0. **Über 70 %:** linear bis +15 (100 %) |
| Perfekter Tag (100 %) | zusätzlich **30 Gold** (30 % des Tagesgolds) |
| XP bis zum nächsten Level | `min(520, 80 × Level^0,9)`. Werte: 80, 149, 215, 279, 341, 401, 461, ab Level 8 immer 520 |

Bei 65 % (8–9 von 13 Aufgaben, dazu 3 Tipps) gibt es etwa **155 XP und 75 Gold** am Tag.

| Erledigt (von 13) | Quote | Vitalität |
|---|---|---|
| 0 | 0 % | −30 |
| 4 | 31 % | −15 |
| 6 | 46 % | −7 |
| 7 | 54 % | −3 |
| 8–9 | 62–69 % | ±0 |
| 11 | 85 % | +7 |
| 12 | 92 % | +11 |
| 13 | 100 % | +15 und 30 Gold |

### Held

| Was | Formel |
|---|---|
| Lebenspunkte | `100 + 15 × Leben` |
| Schaden | `10 + 3 × Stärke`, −25 % wenn erschöpft |
| Angriffsintervall | `1,2 s / (1 + 0,06 × Tempo)`, mindestens 0,25 s |
| Krit | 10 % + Krit-Chance der Ausrüstung (höchstens 60 %), ×1,5 Schaden |

### Gegner

| Was | Formel |
|---|---|
| Lebenspunkte | `95 × Stärke × Typ` |
| Schaden | `13,7 × √Stärke × Typ` (vorher kaum spürbar, jetzt zählt Leben) |
| Angriff | alle `1 s × Typ` |
| Stärke | je Gebiet vier Ankerpunkte (Tabelle unten), dazwischen gleichmäßiges Wachstum |
| Position | normale Gegner: Stufe − 1. **Boss = Gegner 3 Stufen weiter**, **Gebietsboss = 4,5 Stufen weiter** |
| Runde 2, 3 … | beginnt so stark, wie der Drache war |
| Timer | **immer 10 s**, auch bei Bossen |

Durch den Abstand zum Boss sind die Gegner davor etwas leichter, der Boss hält auf, und die 2–3 Gegner direkt danach
sind leicht (der Held hat dann die Boss-Truhe). `bend` formt den Abschnitt zwischen Boss 10 und Boss 20
(unter 1: kurz nach Boss 10 schon stark, über 1: erst spät). `startBend` macht den Anfang der Straße weich:
Stufe 1 schafft auch ein neuer Held ohne Punkte, danach steigt es schnell.

| Gebiet | Stufe 1 | Boss 10 | Boss 20 | Gebietsboss | bend | LP (Typ „ausgewogen“) |
|---|---|---|---|---|---|---|
| Straße | 0,7 | 1,58 | 3,03 | 3,24 | 0,57 (start 0,45) | 67 → 308 |
| Wald | 2,96 | 4,07 | 4,69 | 5,49 | 0,72 | 281 → 522 |
| Dunkler Wald | 5,15 | 6,28 | 7,51 | 8,39 | 1,29 | 489 → 797 |
| Sumpf | 7,67 | 9,55 | 10,9 | 12,4 | 0,56 | 729 → 1178 |
| Wüste | 11,8 | 14 | 15,7 | 17,4 | 0,54 | 1121 → 1653 |
| Strand | 16,4 | 19 | 22,1 | 24,8 | 1,22 | 1558 → 2356 |
| Schnee | 23,1 | 28,5 | 32,6 | 36 | 1,19 | 2195 → 3420 |
| Vulkan | 33,7 | 39,7 | 44,5 | 48,9 | 1,6 | 3202 → 4646 (Drache) |

Die Ankerpunkte sind mit der Simulation so gesetzt, dass ein Held mit 65 % Erfüllung jeden Boss zur geplanten Zeit schafft
(Gebietsbosse etwa an Tag 13, 32, 49, 70, 92, 119, 145, 171).

**Gegnertypen** sind seit v0.5 etwa **gleich schwer**. Vorher war ein einzelner „Panzer“ eine Wand von mehreren Tagen.
Sie unterscheiden sich im Rhythmus und darin, was sie prüfen:

| Typ | LP | Schaden | Angriffsintervall | prüft vor allem |
|---|---|---|---|---|
| ausgewogen | ×1 | ×1 | ×1 | – |
| flink | ×1 | ×0,64 | ×0,65 | – (viele kleine Treffer) |
| Rohling | ×0,98 | ×1,36 | ×1,4 | Leben (wenige harte Treffer) |
| Panzer | ×1 | ×1,2 | ×1,3 | Stärke und Tempo |
| Magier | ×1 | ×1,19 | ×1,25 | Leben |

### Boss-Belohnungen

Belohnung gibt es nur beim **ersten** Sieg über einen Boss. Nach einem Tod lassen sich dieselben Bosse also nicht erneut abgrasen.
Seit v0.5 bringt **jeder** Boss eine Truhe. Den Platz wählst du beim Öffnen; bis dahin wartet sie im Shop unter „Boss-Beute“.

| Gebiet | Zwischenboss 10/20 | Gebietsboss 25 | Gold Zwischenboss / Gebietsboss |
|---|---|---|---|
| Straße | Holz | Holz | 60 / 150 |
| Wald | Holz | Eisen | 78 / 195 |
| Dunkler Wald | Eisen | **Gold** | 101 / 254 |
| Sumpf | Eisen | Gold | 132 / 330 |
| Wüste | Eisen | Gold | 171 / 428 |
| Strand | Gold | Gold | 223 / 557 |
| Schnee | Gold | Gold | 290 / 724 |
| Vulkan | Gold | **Drachenschatz** | 377 / 941 |

Gold wächst ×1,3 je Gebiet (auch über Runden hinweg). Der **Drachenschatz** sind 4 legendäre Teile, je Platz eins,
jeweils mit dem bestmöglichen Wurf für dein Level. Danach ist das Spiel im Grunde durchgespielt (Runde 2 geht weiter).
Die erste Goldtruhe kommt so vom Gebietsboss des Dunklen Walds (65 %: etwa Tag 49), nicht erst beim Drachen.

### Truhen und Ausrüstung

| Truhe | Preis | Gewöhnlich / Ungewöhnlich / Selten / Episch / Legendär |
|---|---|---|
| Holz | 250 | 70 / 25 / 5 / 0 / 0 % |
| Eisen | 1000 | 35 / 40 / 20 / 4,5 / 0,5 % |
| Gold | 3750 | 10 / 35 / 40 / 13 / 2 % |

**Wert eines Teils:**

```
Budget = (1,5 + 0,12 × Level) × Seltenheit × (1 ± 0,15)
```

- Seltenheitsfaktor seit v0.5: **1 / 1,35 / 1,8 / 2,4 / 3,2** (vorher 1 / 1,5 / 2,2 / 3,2 / 5).
- Episch und Legendär bekommen zusätzlich **+15 %** (vorher +50 %).
- Grund: Mit den alten Faktoren entschied Glück bei der Truhe über Wochen Fortschritt; zwei Spieler mit gleicher Erfüllung lagen ganze Gebiete auseinander.

Das Budget wird nach Platz verteilt:

| Platz | Werte |
|---|---|
| Waffe | Stärke. 40 % der Waffen haben 70 % Stärke und 30 % Tempo |
| Helm | nur Tempo |
| Rüstung | nur Leben |
| Schild | 60 % Leben, 40 % Krit-Chance (1 Budgetpunkt = 2 % Krit) |

„Gesamtwert“ (Vergleich, Sortierung, Simulation) = Stärke + Tempo + Leben + Krit ÷ 2.

## Änderungen in v0.5

| Wert | v0.4.1 | v0.5 | Grund |
|---|---|---|---|
| Belohnung tägliche Aufgabe | Punkte × 10 XP / × 5 Gold, + Vitalität | Tagesbudget 200 XP / 100 Gold, gleich verteilt | „alle Aufgaben gleich viel Wert“ |
| Gewohnheiten | beliebig oft, Punkte × 10 / × 5 | 1× am Tag; „+“ kleiner Bonus (25 % des Budgets) + 2 Vitalität | Feedback: nur einmal am Tag |
| Vitalität | Heilung je Aufgabe, Strafe Punkte × 1,5 | nur noch über die Tagesquote | Feedback: Quote nach Aufgaben, unter 60 % immer Verlust |
| Perfekter Tag | – | +30 % Tagesgold | Feedback |
| XP-Kurve | `min(1000, 50 × L^1,5)` | `min(520, 80 × L^0,9)` | anfangs fast täglich ein Level, ab Level 8 alle 3–4 Tage |
| Boss-Truhen | 15 % Holz / 35 % Eisen / Drache Goldtruhe | immer, Platz selbst wählen, Gold ab Gebiet 3 | Feedback: Goldtruhe deutlich früher |
| Drache | Goldtruhe | 4 beste Teile | Feedback |
| Gegner-Stärke | 56 LP × 1,07 je Stufe × 1,44 je Gebiet | Ankerpunkte je Gebiet | Tempo-Ziele je Boss |
| Gegner-Schaden | 6, ×1,12 je Gebiet, alle 1,5 s | 13,7 × √Stärke, alle 1 s | Leben war nutzlos |
| Bosse | ×3 / ×2,5 LP, ×1,5 Schaden | wie ein Gegner 3 / 4,5 Stufen weiter | Bosse halten auf, danach leichte Gegner |
| Gegnertypen | sehr unterschiedlich stark | gleich schwer | sonst mehrtägige Wände mitten im Gebiet |
| Seltenheit | 1 / 1,5 / 2,2 / 3,2 / 5, +50 % | 1 / 1,35 / 1,8 / 2,4 / 3,2, +15 % | weniger Zufall im Fortschritt |
| Simulation | 15 Aufgaben + 10 Gewohnheiten | 13 Aufgaben + 4/3 Gewohnheiten | dein Backup |

## Ergebnis: Meilensteine (Median aus 101 Läufen)

„erreicht → besiegt“ = Tag, an dem der Held vor dem Boss steht, und Tag des ersten Siegs.

| Meilenstein | 65 % | 80 % | 90 % | 100 % |
|---|---|---|---|---|
| Tag 1 / Tag 2 | Stufe 5 / 6 | 5 / 6 | 5 / 7 | 5 / 10 |
| Boss Stufe 10 | Tag 4 → 5 | 3 → 4 | 3 → 4 | 2 → 4 |
| Boss Stufe 20 | 8 → 10 | 7 → 9 | 6 → 8 | 5 → 7 |
| Straße geschafft | 11 → 13 | 10 → 11 | 9 → 10 | 9 → 9 |
| Wald geschafft | 28 → 32 | 23 → 28 | 22 → 25 | 19 → 22 |
| Dunkler Wald geschafft | 46 → 49 | 39 → 42 | 36 → 38 | 33 → 34 |
| Sumpf geschafft | 65 → 70 | 55 → 59 | 50 → 53 | 45 → 50 |
| Wüste geschafft | 90 → 92 | 75 → 76 | 68 → 70 | 64 → 66 |
| Strand geschafft | 113 → 119 | 95 → 99 | 86 → 88 | 78 → 82 |
| Schnee geschafft | 142 → 145 | 115 → 121 | 104 → 107 | 94 → 98 |
| **Drache** | **163 → 171** (5,6 Monate) | 140 → 147 | **122 → 127** (4,2 Monate) | 111 → 118 |

„Stufe 5“ an Tag 1 heißt: der Held steht vor Stufe 5, Stufe 1–4 sind besiegt.

**Level (65 %):** Tag 1 Level 2 · Tag 7 Level 6 · Tag 14 Level 8 · Tag 30 Level 13 · Tag 60 Level 22 · Tag 100 Level 34 · Tag 182 Level 59.
Ab Level 8 kommt bei 65 % etwa alle 3,5 Tage ein Level.

**Truhen (65 %, gekauft + Boss):** 2 bis Boss 10, 5 bis Boss 20, 6 nach der Straße, 11 nach dem Wald, etwa 38 bis zum Drachen.

**Aufenthalt pro Spieler (65 %, Median je Gebiet):**

| | Straße | Wald | Dunkler Wald | Sumpf | Wüste | Strand | Schnee | Vulkan |
|---|---|---|---|---|---|---|---|---|
| Boss 10 | 1 | 3 | 2 | 2 | 2 | 1 | 1 | 1 |
| Boss 20 | 3 | 1 | 2 | 1 | 1 | 4 | 1 | 1 |
| Gebietsboss | 1 | 4 | 2 | 5 | 2 | 3 | 2 | 2 |
| längste Wand (normaler Gegner) | 2 | 3 | 3 | 3 | 4 | 3 | 4 | 4 |

### Verlauf (Auszug, `npm run simulate`, 15 Läufe)

| Erfüllung | Tag | Level | Höchste Stufe | Tode | Truhen | Attribute S/T/L | Ausrüstung | Erschöpft-Tage |
|---|---|---|---|---|---|---|---|---|
| 100 % | 30 | 17 | Dunkler Wald 20 | 0 | 15 | 9/1/5 | 22 | 0 |
| 100 % | 90 | 43 | Schnee 20 | 0 | 32 | 26/4/12 | 69 | 0 |
| 90 % | 30 | 16 | Dunkler Wald 12 | 0 | 13 | 9/1/4 | 21 | 0 |
| 90 % | 90 | 40 | Schnee 8 | 0 | 28 | 24/4/10 | 59 | 0 |
| 65 % | 7 | 6 | Straße 19 | 0 | 3 | 4/0/0 | 7 | 0 |
| 65 % | 30 | 13 | Wald 25 | 0 | 10 | 7/1/4 | 18 | 0 |
| 65 % | 90 | 31 | Strand 5 | 0 | 24 | 18/3/8 | 45 | 0 |
| 65 % | 180 | 58 | R2 Straße 19 | 0 | 41 | 37/5/16 | 168 | 0 |
| 50 % | 30 | 10 | Wald 10 | 1 | 8 | 6/0/2 | 13 | 5 |
| 50 % | 90 | 22 | Sumpf 10 | 3 | 18 | 12/1/7 | 24 | 18 |
| 50 % | 180 | 40 | Strand 20 | 6 | 31 | 22/5/10 | 49 | 41 |
| 30 % (schlechte Phase) | 30 | 6 | Straße 17 | 3 | 4 | 4/0/1 | 4 | 8 |
| 30 % (schlechte Phase) | 180 | 8 | Straße 19 | 22 | 20 | 5/0/2 | 3 | 47 |
| 5 verpasst + 2× „−“ | 90 | 28 | Wüste 11 | 1 | 21 | 17/3/8 | 38 | 21 |
| 5 verpasst + 2× „−“ | 180 | 53 | Vulkan 14 | 2 | 35 | 32/4/15 | 78 | 44 |

„Höchste Stufe“ ist die weiteste Stufe, die erreicht wurde; der Gegner dort ist noch nicht besiegt.
„Ausrüstung“ ist der Gesamtwert aller angelegten Teile (nach dem Drachen inklusive Drachenschatz).

## Abgleich mit den Zielen (65 %)

| Ziel aus dem Feedback | Ergebnis | |
|---|---|---|
| Tag 1 Stufe 3–4, Tag 2 Stufe 6–8 | Tag 1: Stufe 4 besiegt (steht vor 5), Tag 2: Stufe 6 | ✅ |
| Neuer Held gewinnt den ersten Kampf | Stufe 1 ohne Punkte immer gewonnen, Stufe 2 braucht Level 2 | ✅ (Unit-Test) |
| Boss 10 nach 3–4 Tagen erreicht, in 2–3 Tagen besiegt | erreicht Tag 4, besiegt Tag 5 | ⚠️ meist schon nach 1 Tag |
| Danach 3–4 leichte Gegner, dann Wände von 1–2 Tagen | 2–3 leichte Gegner, längste Wand je Gebiet 2–4 Tage | ⚠️ Wände etwas länger |
| Boss 20: 2–3 Tage | Straße 2 Tage (8 → 10), später 1–4 | ✅ im Schnitt |
| Gebietsboss: 3–4 Tage | 1–5 Tage, im Schnitt 2,6 | ⚠️ etwas kürzer |
| Spätere Gebiete dauern länger | Gebiet 1: 13 Tage, dann 19, 17, 21, 22, 27, 26, 26 | ✅ |
| Drache nach etwa 6 Monaten | Tag ~171 (5,6 Monate) | ✅ |
| 90 %: etwa 4 Monate, Bosse 1–2 Tage | Tag ~127, Bosse meist 1–2 Tage | ✅ |
| Level-Ups anfangs fast täglich, ab Level 8 alle 3–4 Tage | Level 6 nach einer Woche, ab Level 8 alle ~3,5 Tage | ✅ |
| Unter 60 % immer Vitalitätsverlust | −1 bis −30 je nach Quote | ✅ (Unit-Test) |
| Goldtruhe deutlich früher als beim Drachen | erste Boss-Goldtruhe etwa Tag 49 | ✅ |
| Kein Kampf länger als 10 s | alle Timer 10 s | ✅ (Unit-Test) |

**Zu den Boss-Aufenthalten:** Ein Boss hält auf, solange der Held noch nicht stark genug ist. Ob das 1 oder 3 Tage sind, hängt davon ab,
ob gerade ein Level-Up oder eine Truhe dazukommt. Längere Bosse bekommt man über `combat.bossStageBonus` (3) und `areaBossStageBonus` (4,5):
Mit 1,5 / 2,5 lagen die Bosse meist bei 1 Tag und die längsten Wände bei 5–6 Tagen. Noch größere Abstände machen die Gegner vor dem Boss zu leicht.

## Szenarien mit schlechten Tagen

| Szenario | Ergebnis |
|---|---|
| 30 % Erfüllung (schlechte Phase) | −15 Vitalität am Tag, erster Tod nach etwa **7–8 Tagen**, danach etwa alle 8 Tage. Kommt nicht über die Straße hinaus |
| 50 % | −3 bis −7 am Tag: 6 Tode im halben Jahr, Strand nach 6 Monaten |
| 5 verpasst + 2× „−“ pro Tag | 8 von 13 = 62 % ist neutral, nur die „−“-Gewohnheiten kosten (−6, „+“ heilt etwa +5): **2 Tode** im halben Jahr |
| 4 komplett verpasste Tage | −30 je Tag → Tod |

Das alte Ziel „5 verpasst + 2× − ≈ 8 Tode im halben Jahr“ gilt mit der neuen Quote nicht mehr: 62 % liegt im neutralen Bereich, den du so gewählt hast.
Wer das Szenario wieder härter möchte: `vitality.quota.neutralFrom` auf 0,65 setzen, dann kosten 8 von 13 Aufgaben −2 am Tag.

## Stellschrauben

| Wenn … | dann in `balance.ts` … |
|---|---|
| ein bestimmter Boss zu früh oder zu spät fällt | den passenden Ankerpunkt in `enemies.areas` (`boss10`, `boss20`, `areaBoss`) |
| ein ganzes Gebiet zu schnell oder zu langsam ist | alle Ankerpunkte dieses und der folgenden Gebiete zusammen |
| Bosse zu kurz oder zu lang aufhalten | `combat.bossStageBonus` (3) und `areaBossStageBonus` (4,5) |
| die Gegner nach Boss 10 zu früh oder zu spät hart werden | `bend` des Gebiets |
| der Anfang zu leicht oder zu schwer ist | `enemies.areas[0].stage1` (0,7) und `startBend` (0,45) |
| Leben zu viel oder zu wenig zählt | `enemies.baseDamage` (13,7) und `damageExponent` (0,5) |
| Level-Ups zu oft oder zu selten kommen | `levels.xpMaxPerLevel` (520), `xpBase` (80) und `xpExponent` (0,9) |
| zu viele oder zu wenige Truhen kommen | `items.chests.*.price` und `bossRewards.chests` / `goldBoss` / `goldAreaBoss` |
| Truhenglück zu viel ausmacht | `items.rarityFactors` und `items.highRarityBonus` |
| schlechte Tage zu hart oder zu mild sind | `vitality.quota` (`neutralFrom` 0,6, `neutralTo` 0,7, `lossAtZero` 30, `gainAtFull` 15) und `habitMinus.vitalityLossPerPoint` (3) |
| der perfekte Tag mehr bringen soll | `vitality.perfectDayGoldShare` (0,3) |

Nach jeder Änderung `npm run simulate` und `npm test` laufen lassen.
`simulation.test.ts` prüft die Leitplanken: Level in der ersten Woche, Tage bis Boss 10/20 und Gebietsboss,
Tod in einer schlechten Phase und das Szenario „5 verpasst + 2× −“. `combat.test.ts` prüft Ankerpunkte, Bossabstand und den Spielstart.
