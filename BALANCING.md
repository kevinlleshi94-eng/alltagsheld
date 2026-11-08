# Balancing – Alltagsheld

Alle Zahlen stehen in `src/game/balance.ts`. Dieses Dokument beschreibt, wie sie zustande kommen,
und hält das Ergebnis der Simulation fest (SPEC §11). Stand: v0.4.1, nach dem Feedback zu Phase 4.

```bash
npm run simulate                 # Tabellen, 240 Tage, 7 Durchläufe je Szenario
npm run simulate -- --days=365   # länger
npm run simulate -- --markdown   # Ausgabe als Markdown-Tabelle (wie unten)
```

## Simulationsmodell

Die Simulation (`src/game/simulation.ts`) nutzt **dieselben Funktionen wie die App**: Abhaken, Gewohnheiten,
Tagesabrechnung, Strafen, Tod, Level-Up, Kampf-Engine, Truhen und Boss-Belohnungen.

- **Dein Profil** (Standard seit Phase 4):
  - 15 tägliche Aufgaben mit zusammen 25 Punkten (3, 3, 2, 2, 2, 2, 2, 2 und 7× 1)
  - 10 positive Gewohnheiten mit je 1 Punkt
  - 1 negative Gewohnheit

  Ein perfekter Tag bringt **35 Punkte = 350 XP und 175 Gold**.
- **Erfüllung:** Jede Aufgabe und jede „+“-Gewohnheit wird mit dieser Wahrscheinlichkeit erledigt.
  Die „−“-Gewohnheit wird mit der Gegenwahrscheinlichkeit getippt.
- **Szenario „5 verpasst + 2× −“:** Es rechnet weiter mit den 13 Startaufgaben (22 Punkte), damit es mit den Zahlen von vorher vergleichbar bleibt.
  Dort fehlen genau 5 zufällige Aufgaben pro Tag, dazu kommen 2× „−“.
- **Attributpunkte** werden optimal verteilt: immer das Attribut, das die Wand am weitesten nach hinten schiebt.
- **Shop:**
  - Erst eine Holztruhe für jeden der 4 Plätze.
  - Dann wird je Platz auf eine Eisentruhe gespart, danach auf Goldtruhen.
  - Das bessere Teil wird angelegt, das schlechtere für 25 % verkauft. Truhen von Bossen zählen mit.
- **Kampf** nur, solange die App offen ist, 300 s pro Tag. Laufen, Sieg und Rückzug zählen mit.
- **Auswertung:** Median aus 7 Durchläufen mit festen Seeds, jeder Lauf ist reproduzierbar.

## Formeln

| Was | Formel |
|---|---|
| Belohnung pro Punkt | 10 XP, 5 Gold |
| XP bis zum nächsten Level | `min(1000, 50 × Level^1,5)`. Werte: 50, 141, 260, 400, 559, 735, 926, ab Level 8 immer 1000 |
| Held: Lebenspunkte | `100 + 15 × Leben` |
| Held: Schaden | `10 + 3 × Stärke`, −25 % wenn erschöpft |
| Held: Angriffsintervall | `1,2 s / (1 + 0,06 × Tempo)`, mindestens 0,25 s |
| Held: Krit | 10 % + Krit-Chance der Ausrüstung (höchstens 60 %), ×1,5 Schaden |
| Gegner-Grundwerte (Straße 1) | 56 LP, 6 Schaden, Angriff alle 1,5 s (je nach Gegnertyp ×0,8–1,5) |
| Gegner-Skalierung | Gebietsfaktor × `(1 + 0,07 × (Stufe − 1))` |
| Gebietsfaktor | LP `1,44^a`, Schaden `1,12^a`. `a` = Gebiet über alle Runden (Straße R1 = 0 … Vulkan R1 = 7, Straße R2 = 8) |
| Zwischenboss (Stufe 10/20) | ×3 LP, ×1,5 Schaden |
| Gebietsboss (Stufe 25) | ×2,5 LP, ×1,5 Schaden. Durch die höhere Stufe hat er etwa so viele LP wie Boss 20, trifft aber 15 % härter |
| Timer | **immer 10 s**, auch bei Bossen |

### Boss-Belohnungen (neu in v0.4.1)

Belohnung gibt es nur beim **ersten** Sieg über einen Boss. Nach einem Tod lassen sich dieselben Bosse also nicht erneut abgrasen.

| Boss | Gold (Straße) | pro Gebiet | Truhe |
|---|---|---|---|
| Zwischenboss Stufe 10/20 | 60 | ×1,3 | 15 % Holztruhe |
| Gebietsboss Stufe 25 | 150 | ×1,3 | 35 % Eisentruhe |
| Drache (Vulkan 25) | 150 × 1,3⁷ ≈ 941 | – | **immer** Goldtruhe |

### Truhen und Ausrüstung

| Truhe | Preis (vorher) | Gewöhnlich / Ungewöhnlich / Selten / Episch / Legendär |
|---|---|---|
| Holz | **250** (100) | 70 / 25 / 5 / 0 / 0 % |
| Eisen | **1000** (400) | 35 / 40 / 20 / 4,5 / 0,5 % |
| Gold | **3750** (1500) | 10 / 35 / 40 / 13 / 2 % |

**Wert eines Teils:**

```
Budget = (1,5 + 0,12 × Level) × Seltenheit × (1 ± 0,15)
```

- Seltenheitsfaktor: 1 / 1,5 / 2,2 / 3,2 / 5.
- Episch und Legendär bekommen zusätzlich **+50 %**.

Das Budget wird nach Platz verteilt:

| Platz | Werte |
|---|---|
| Waffe | Stärke. 40 % der Waffen haben 70 % Stärke und 30 % Tempo |
| Helm | nur Tempo |
| Rüstung | nur Leben |
| Schild | 60 % Leben, 40 % Krit-Chance (1 Budgetpunkt = 2 % Krit) |

„Gesamtwert“ (Vergleich, Sortierung, Simulation) = Stärke + Tempo + Leben + Krit ÷ 2.

Gegenstände von vor v0.4.1 werden beim Update auf diese Regeln umgerechnet. Der Gesamtwert bleibt dabei gleich (Schema v4).

### Level-Tempo mit deinem Profil (350 XP pro perfektem Tag)

| Phase | Level-Ups |
|---|---|
| Erster Tag | Level 3 |
| Tag 3 | Level 5 |
| Ab Level 8 (etwa Tag 9) | gleichmäßig alle **3 Tage** (1000 XP) |

Ein Tod kostet ein Level, also etwa 3 Tage Arbeit.

## Änderungen

| Wert | SPEC-Start | v0.4.0 | Jetzt (v0.4.1) | Grund |
|---|---|---|---|---|
| XP-Kurve | `100 × L^1,2` | `50 × L^1,5`, max. 1000 | unverändert | Level 3 am ersten Tag (Feedback A3) |
| Boss-Timer | 15 s / 20 s | 10 s | 10 s | Feedback C3 |
| Boss-LP | ×3 / ×5 | ×2 / ×3 | **×3 / ×2,5** | Feedback Phase 4: erster Boss nach 3–4 Tagen, zweiter 4–5 Tage später |
| Gegner pro Stufe | +4 % | +4 % | **+7 %** | Die Wand liegt wieder vor dem Zwischenboss, nicht schon bei Stufe 3–4 des nächsten Abschnitts |
| Gegner je Gebiet | – | ×1,36 LP / ×1,12 Schaden | **×1,44 LP** / ×1,12 Schaden | Dein Profil bringt 60 % mehr XP und Gold als die Startaufgaben. Ohne Ausgleich wäre der Drache nach 3 Monaten fällig |
| Truhenpreise | 100 / 400 / 1500 | 100 / 400 / 1500 | **250 / 1000 / 3750** | 2–3 Truhen bis zum ersten Boss, 3–4 weitere bis zum zweiten (Feedback Phase 4) |
| Boss-Gold, Boss-Truhen | – | – | **neu** | Feedback Phase 4 |
| Item-Werte | frei verteilt | je Platz mit Bonus | **feste Werte je Platz** | Feedback Phase 4: Waffe Stärke (+ Tempo), Helm Tempo, Rüstung Leben, Schild Leben + Krit |
| Gegner-Grund-LP | 45 | 56 | 56 | iPhone-Test Phase 2 |
| Strafe verpasste Aufgabe | Punkte × 3 | Punkte × 1,5 | Punkte × 1,5 | Feedback I1 (siehe Szenario) |

## Ergebnis: Meilensteine mit deinem Profil (Median aus 7 Läufen)

„Tag“ = Tag des ersten Siegs über diesen Boss. „Truhen“ = gekaufte und von Bossen erhaltene Truhen bis dahin.

| Meilenstein | 100 % | 90 % | 80 % | 50 % |
|---|---|---|---|---|
| Boss Stufe 10 | Tag 3 (Level 5, 2 Truhen) | Tag 3 (L5, 2) | Tag 4 (L5, 2) | Tag 6 (L5, 2) |
| Boss Stufe 20 | Tag 9 (L8, 4) | Tag 7 (L7, 4) | Tag 8 (L7, 4) | Tag 14 (L7, 5) |
| Straße geschafft | Tag 12 (L9, 5) | Tag 12 (L8, 5) | Tag 12 (L8, 4) | Tag 18 (L8, 5) |
| Wald geschafft | Tag 21 (L12, 8) | Tag 25 (L12, 8) | Tag 33 (L13, 9) | Tag 43 (L11, 9) |
| Dunkler Wald geschafft | Tag 52 (L23, 12) | Tag 54 (L22, 11) | Tag 66 (L23, 12) | Tag 146 (L22, 18) |
| Sumpf geschafft | Tag 60 (L25, 12) | Tag 63 (L25, 12) | Tag 71 (L24, 12) | Tag 160 (L26, 20) |
| Wüste geschafft | Tag 91 (L36, 15) | Tag 98 (L35, 14) | Tag 107 (L34, 14) | nur 2 von 7 Läufen |
| Strand geschafft | Tag 100 (L39, 16) | Tag 117 (L41, 16) | Tag 123 (L39, 16) | 1 von 7 |
| Schnee geschafft | Tag 130 (L50, 19) | Tag 168 (L57, 20) | Tag 174 (L53, 20) | – |
| **Drache** | **Tag 170** (L64, 23) | **Tag 203** (L68, 23) | **Tag 188** (L57, 22), 5 von 7 Läufen | – |

Wunsch aus dem Feedback: erster Zwischenboss nach 3–4 Tagen mit 2–3 Truhen, der nächste 4–5 Tage später mit 3–4 weiteren Truhen.
Ergebnis bei 90–100 %: Boss 10 an **Tag 3** mit 2 Truhen, Boss 20 an **Tag 7–9** mit 4 Truhen. Danach folgen etwa 2 Truhen pro Gebiet bzw. eine alle 7–10 Tage.
Ein neuer Held schafft nur Stufe 1–9, für Boss 10 braucht er etwa Level 5 und die ersten Holztruhen (Unit-Tests).

### Verlauf (Auszug, `npm run simulate`)

| Erfüllung | Tag | Level | Höchste Stufe | Tode | Truhen | Attribute S/T/L | Ausrüstung | Drache |
|---|---|---|---|---|---|---|---|---|
| 100 % | 7 | 7 | Straße 20 | 0 | 4 | 6/0/0 | 11 | – |
| 100 % | 30 | 15 | Dunkler Wald 20 | 0 | 10 | 11/0/2 | 22 | – |
| 100 % | 90 | 36 | Wüste 25 | 0 | 15 | 22/4/9 | 50 | – |
| 100 % | 180 | 67 | R2 Wald 20 | 0 | 26 | 36/17/13 | 179 | Tag 170 (7/7) |
| 80 % | 7 | 6 | Straße 20 | 0 | 4 | 5/0/0 | 11 | – |
| 80 % | 30 | 13 | Wald 20 | 0 | 9 | 9/0/3 | 18 | – |
| 80 % | 90 | 30 | Wüste 25 | 0 | 14 | 18/3/8 | 40 | – |
| 80 % | 180 | 55 | Vulkan 20 | 0 | 22 | 29/10/14 | 113 | Tag 161 (2/7) |
| 50 % | 30 | 9 | Wald 20 | 1 | 7 | 7/0/1 | 17 | – |
| 50 % | 90 | 15 | Dunkler Wald 20 | 3 | 14 | 10/0/3 | 21 | – |
| 50 % | 180 | 27 | Wüste 10 | 6 | 21 | 15/2/7 | 26 | – |

„Höchste Stufe“ ist die weiteste Stufe, die erreicht wurde; der Gegner dort ist noch nicht besiegt.
„Ausrüstung“ ist der Gesamtwert aller angelegten Teile.

## Abgleich mit den Zielen

| Ziel | Ergebnis | |
|---|---|---|
| Erster Zwischenboss nach 3–4 Tagen mit 2–3 Truhen (Feedback Phase 4) | Tag 3–4, 2 Truhen | ✅ (Unit-Test) |
| Nächster Zwischenboss 4–5 Tage später mit 3–4 weiteren Truhen | 4–6 Tage später, 2 weitere Truhen (4 insgesamt) | ⚠️ eine Truhe weniger als gewünscht |
| Drache nach etwa einem halben Jahr (gute Erfüllung) | 100 %: Tag 170, 90 %: Tag 203, 80 %: Tag 188 (5 von 7) | ✅ |
| 50 %: regelmäßige Tode, kaum über Gebiet 2–3 hinaus | Sumpf (Gebiet 4) erst nach gut 5 Monaten, 6 Tode im halben Jahr | ⚠️ ein Gebiet weiter |
| 5 verpasst + 2× „−“ pro Tag: etwa 8 Tode im halben Jahr (Feedback I1) | 9 Tode, Level 17, Dunkler Wald | ✅ (Unit-Test) |
| Kein Kampf länger als 10 s | alle Timer 10 s (Unit-Test) | ✅ |

**Zur Truhenzahl beim zweiten Boss:** Für 3–4 weitere Truhen müssten Holztruhen wieder billiger werden.
Das würde aber auch den ersten Boss beschleunigen (schon Tag 2). Ich habe deshalb 2 Truhen bis Boss 10 und 4 bis Boss 20 gewählt.
Stellschraube: `items.chests.wood.price`.

## Szenario: 5 Aufgaben verpasst + 2× Gewohnheit „−“ pro Tag (Startaufgaben)

| Tag | Level | Höchste Stufe | Tode | Erschöpft-Tage |
|---|---|---|---|---|
| 30 | 7 | Wald 20 | 1 | 5 |
| 90 | 11 | Wald 20 | 4 | 21 |
| 180 | 17 | Dunkler Wald 20 | 9 | 42 |
| 240 | 20 | Dunkler Wald 20 | 13 | 59 |

**Rechnung pro Tag:** Die 5 verpassten Aufgaben sind im Schnitt 8,5 Punkte.

| Posten | Vitalität pro Tag |
|---|---|
| Heilung durch erledigte Aufgaben (13,5 Punkte × 1) | +13,5 |
| Strafe für verpasste Aufgaben (8,5 Punkte × 1,5) | −12,75 |
| Gewohnheit „−“ (2 × 1 Punkt × 3) | −6 |
| **Summe** | **−5,25** → Tod etwa alle 3 Wochen |

Halbe Punkte werden pro Tag gerundet und auf die Aufgaben verteilt, die Vitalität bleibt also eine ganze Zahl.
Beispiel: 3 verpasste 1-Punkt-Aufgaben kosten zusammen 4,5 → 5 Vitalität (2 + 1 + 2).

Wie die Strafhöhe das Szenario verändert (Messung aus Phase 2, mit den Gegnerwerten von v0.2.1):

| Strafe verpasste Aufgabe | Strafe Gewohnheit „−“ | Szenario: Tode | 50 %: Tode |
|---|---|---|---|
| 3 (SPEC-Start) | 3 | 32 | 41 |
| 2 | 3 | 17 | 22 |
| **1,5** (aktuell) | 3 | **9** | 12 |
| 1,5 | 1,5 | 3 | 11 |

## Stellschrauben

| Wenn … | dann in `balance.ts` … |
|---|---|
| der erste Boss zu früh oder zu spät fällt | `combat.bossHpMultiplier` (3) und `items.chests.wood.price` (250) |
| alles zu schnell oder zu langsam geht | `enemies.areaHpGrowthExponential` (0,44). Das ist der stärkste Hebel für den Drachen-Tag |
| die Wand in einem Gebiet zu früh oder zu spät kommt | `enemies.stageHpGrowth` / `stageDamageGrowth` (0,07) |
| Gebietsbosse zu hart oder zu weich sind | `combat.areaBossHpMultiplier` (2,5) |
| zu viele oder zu wenige Truhen kommen | `items.chests.*.price` und `bossRewards.*` (Gold, Truhen-Chancen) |
| Ausrüstung zu viel oder zu wenig bringt | `items.basePoints` (1,5), `items.levelFactor` (0,12) und `items.highRarityBonus` (0,5) |
| der Schild zu viel oder zu wenig Krit gibt | `items.shieldCritShare` (0,4), `items.critPercentPerPoint` (2) und `combat.maxCritChance` (0,6) |
| Level-Ups zu oft oder zu selten kommen | `levels.xpMaxPerLevel` (1000), `xpBase` (50) und `xpExponent` (1,5) |
| verpasste Aufgaben zu hart oder zu mild bestraft werden | `vitality.missedDailyLossPerPoint` (1,5) und `habitMinus.vitalityLossPerPoint` (3) |

Nach jeder Änderung `npm run simulate` und `npm test` laufen lassen.
`simulation.test.ts` prüft die Leitplanken: Tempo bis Boss 10 und Boss 20 sowie die Tode im Szenario.
