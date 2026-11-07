# Balancing – Alltagsheld

Alle Zahlen stehen in `src/game/balance.ts`. Dieses Dokument beschreibt, wie sie zustande kommen,
und hält das Ergebnis der Simulation fest (SPEC §11, angepasst nach dem Feedback zu Phase 2).

```bash
npm run simulate                 # Tabelle, 180 Tage, 7 Durchläufe je Erfüllungsgrad
npm run simulate -- --days=365   # länger
npm run simulate -- --markdown   # Ausgabe als Markdown-Tabelle (wie unten)
```

## Simulationsmodell

Die Simulation (`src/game/simulation.ts`) nutzt **dieselben Funktionen wie die App**: Abhaken, Gewohnheiten,
Tagesabrechnung, Strafen, Tod, Level-Up und Kampf-Engine.

- **Tägliche Aufgaben:** die 13 Startaufgaben mit zusammen 22 Punkten.
  Jede wird mit der Wahrscheinlichkeit „Erfüllung“ erledigt. Im Szenario fehlen dagegen genau 5 zufällige Aufgaben pro Tag.
- **Gewohnheiten:**
  - „Selbst gekocht“ (+1) wird mit der Wahrscheinlichkeit „Erfüllung“ getippt.
  - „Fertigessen bestellt“ (−1) wird mit der Wahrscheinlichkeit 1 − Erfüllung getippt. Im Szenario fest 2× pro Tag.
- **Attributpunkte** werden optimal verteilt: immer das Attribut, das die Wand am weitesten nach hinten schiebt.
- **Shop:** Sobald genug Gold da ist, wird die beste bezahlbare Truhe für den schwächsten Platz gekauft.
  Das bessere Teil wird angelegt, das schlechtere für 25 % verkauft. Die Shop-Oberfläche kommt in Phase 4.
- **Kampf** nur, solange die App offen ist, 300 s pro Tag. Laufen, Sieg und Rückzug zählen mit.
- **Auswertung:** Median aus 7 Durchläufen mit festen Seeds, jeder Lauf ist reproduzierbar.

## Formeln

| Was | Formel |
|---|---|
| XP bis zum nächsten Level | `min(1000, 50 × Level^1,5)`. Werte: 50, 141, 260, 400, 559, 735, 926, ab Level 8 immer 1000 |
| Held: Lebenspunkte | `100 + 15 × Leben` |
| Held: Schaden | `10 + 3 × Stärke`, −25 % wenn erschöpft |
| Held: Angriffsintervall | `1,2 s / (1 + 0,06 × Geschwindigkeit)`, mindestens 0,25 s |
| Held: Krit | 10 % Chance, ×1,5 Schaden |
| Gegner-Grundwerte (Straße 1) | 56 LP, 6 Schaden, Angriff alle 1,5 s (je nach Gegnertyp ×0,8–1,5) |
| Gegner-Skalierung | Gebietsfaktor × `(1 + 0,04 × (Stufe − 1))` |
| Gebietsfaktor | LP `1,36^a`, Schaden `1,12^a`. `a` = Gebiet über alle Runden (Straße R1 = 0 … Vulkan R1 = 7, Straße R2 = 8) |
| Zwischenboss (Stufe 10/20) | ×2 LP, ×1,5 Schaden |
| Gebietsboss (Stufe 25) | ×3 LP, ×1,5 Schaden |
| Timer | **immer 10 s**, auch bei Bossen |

**Level-Tempo:** Ein perfekter Tag bringt 220 XP.

| Phase | Level-Ups |
|---|---|
| Erster Tag | Level 3 |
| Danach | alle 1–3 Tage |
| Ab Level 8 (nach gut 2 Wochen) | gleichmäßig alle **4–5 Tage** |

Ein Tod kostet ein Level, also etwa 5 Tage Arbeit.

## Änderungen

| Wert | SPEC-Start | Nach Phase 2 | Jetzt | Grund |
|---|---|---|---|---|
| XP-Kurve | `100 × L^1,2` | `50 × L^1,5` | `50 × L^1,5`, **max. 1000 pro Level** | Level 3 am ersten Tag, später Level-Ups alle 4–5 Tage (Feedback A3) |
| Boss-Timer | 15 s / 20 s | 15 s / 20 s | **10 s** | Feedback C3: man soll nicht lange zuschauen müssen |
| Boss-LP | ×3 / ×5 | ×3 / ×5 | **×2 / ×3** | Ausgleich für den kürzeren Timer |
| Gegner je Gebiet | – | ×1,25 LP / ×1,10 Schaden | **×1,36 LP / ×1,12 Schaden** | Mehr Level bedeutet einen stärkeren Helden. Das gleicht diesen Zuwachs aus. (v0.2.1: ×1,38, jetzt flacher als Ausgleich für die höheren Grund-LP) |
| Gegner-Grund-LP | 45 | 45 | **56** | iPhone-Test: Der Start war zu leicht. Ein neuer Held kommt jetzt höchstens bis Stufe 9, der erste Boss braucht 1–2 Level-Ups |
| Strafe verpasste Aufgabe | Punkte × 3 | Punkte × 3 | **Punkte × 1,5** | Feedback I1: 5 verpasste Aufgaben + 2× „−“ pro Tag sollen etwa 8 Tode im halben Jahr bedeuten (siehe Szenario) |

Halbe Punkte werden pro Tag gerundet und auf die Aufgaben verteilt, die Vitalität bleibt also eine ganze Zahl.
Beispiel: 3 verpasste 1-Punkt-Aufgaben kosten zusammen 4,5 → 5 Vitalität (2 + 1 + 2).

Unverändert aus der SPEC: Belohnungen, Gewohnheit „−“ (Punkte × 3), Vitalität, Tod, +4 % pro Stufe im Gebiet.

## Ergebnis (180 Tage, Median aus 7 Läufen)

„Höchste Stufe“ ist die weiteste Stufe, die erreicht wurde. Der Gegner dort ist noch nicht besiegt.
Gebiete: Straße, Wald, Dunkler Wald, Sumpf, Wüste, Strand, Schnee, Vulkan.
„Ausrüstung“ ist die Summe der Attributpunkte aller angelegten Teile.

| Erfüllung | Tag | Level | Höchste Stufe | Aktuell | Tode | Gold | Attribute S/G/L | Ausrüstung | Erschöpft-Tage | Drache |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 % | 1 | 2 | Straße 18 | Straße 18 | 0 | 65 | 1/0/0 | 0 | 0 | – |
| 50 % | 7 | 5 | Straße 25 | Straße 25 | 0 | 20 | 3/0/0 | 8 | 0 | – |
| 50 % | 30 | 7 | Dunkler Wald 25 | Dunkler Wald 20 | 2 | 40 | 5/0/1 | 14 | 3 | – |
| 50 % | 90 | 8 | Dunkler Wald 25 | Dunkler Wald 25 | 6 | 55 | 6/0/1 | 17 | 14 | – |
| 50 % | 180 | 9 | Dunkler Wald 25 | Dunkler Wald 25 | 12 | 65 | 6/0/1 | 21 | 27 | – |
| 75 % | 1 | 2 | Straße 20 | Straße 20 | 0 | 75 | 1/0/0 | 0 | 0 | – |
| 75 % | 7 | 5 | Straße 25 | Straße 25 | 0 | 55 | 4/0/0 | 9 | 0 | – |
| 75 % | 30 | 10 | Dunkler Wald 25 | Dunkler Wald 25 | 0 | 65 | 8/0/1 | 19 | 0 | – |
| 75 % | 90 | 20 | Wüste 25 | Wüste 25 | 0 | 65 | 10/6/3 | 35 | 0 | – |
| 75 % | 180 | 35 | Schnee 25 | Schnee 25 | 0 | 50 | 15/15/4 | 59 | 0 | – |
| 90 % | 1 | 3 | Straße 20 | Straße 20 | 0 | 15 | 2/0/0 | 2 | 0 | – |
| 90 % | 7 | 6 | Straße 25 | Straße 25 | 0 | 60 | 4/0/0 | 11 | 0 | – |
| 90 % | 30 | 11 | Dunkler Wald 25 | Dunkler Wald 25 | 0 | 80 | 8/1/2 | 21 | 0 | – |
| 90 % | 90 | 23 | Wüste 25 | Wüste 25 | 0 | 65 | 11/8/3 | 38 | 0 | – |
| 90 % | 180 | 42 | R2 Straße 25 | R2 Straße 25 | 0 | 60 | 17/21/4 | 70 | 0 | Tag 165 (5/7) |
| 100 % | 1 | 3 | Straße 20 | Straße 20 | 0 | 15 | 2/0/0 | 2 | 0 | – |
| 100 % | 7 | 6 | Dunkler Wald 10 | Dunkler Wald 10 | 0 | 30 | 5/0/0 | 13 | 0 | – |
| 100 % | 30 | 11 | Dunkler Wald 25 | Dunkler Wald 25 | 0 | 50 | 9/0/1 | 23 | 0 | – |
| 100 % | 90 | 25 | Wüste 25 | Wüste 25 | 0 | 50 | 12/9/2 | 43 | 0 | – |
| 100 % | 180 | 46 | R2 Straße 25 | R2 Straße 25 | 0 | 50 | 18/22/5 | 75 | 0 | Tag 162.5 (6/7) |
| 5 verpasst + 2× „−“ | 1 | 2 | Straße 20 | Straße 20 | 0 | 70 | 1/0/0 | 0 | 0 | – |
| 5 verpasst + 2× „−“ | 7 | 5 | Straße 25 | Straße 25 | 0 | 15 | 4/0/0 | 8 | 0 | – |
| 5 verpasst + 2× „−“ | 30 | 8 | Dunkler Wald 25 | Dunkler Wald 25 | 1 | 80 | 6/0/1 | 16 | 4 | – |
| 5 verpasst + 2× „−“ | 90 | 10 | Dunkler Wald 25 | Dunkler Wald 25 | 4 | 50 | 8/1/1 | 21 | 18 | – |
| 5 verpasst + 2× „−“ | 180 | 15 | Wüste 25 | Wüste 25 | 10 | 60 | 10/3/2 | 27 | 41 | – |

## Abgleich mit den Zielen

| Ziel | Ergebnis | |
|---|---|---|
| Nach einem halben Jahr den Endboss besiegt (gute Erfüllung) | 90 %: Tag 165 (5 von 7 Läufen), 100 %: Tag 162,5 | ✅ |
| 5 verpasst + 2× „−“ pro Tag: etwa 8 Tode im halben Jahr (Feedback I1) | 10 Tode, Level 15, Wüste (Gebiet 5) | ✅ (Unit-Test) |
| 75 %: nach 6 Monaten Gebiet 5–6 | Schnee (Gebiet 7) erreicht, 0 Tode, Drache in keinem Lauf | ⚠️ ein Gebiet weiter |
| 50 %: regelmäßige Tode, kaum über Gebiet 2–3 hinaus | Dunkler Wald (Gebiet 3), 12 Tode | ✅ |
| Level 3 am ersten Tag, danach alle 2–3 Tage, später alle 4–5 Tage | siehe Level-Tempo oben | ✅ |
| Neuer Held: höchstens bis zum ersten Boss (iPhone-Test) | Stufe 1–9 schaffbar, Boss Stufe 10: 0 % Siege. Mit 1 Punkt ca. 20 % (nach ein paar Versuchen geschafft), mit 2 Punkten sicher. Danach ist bei Stufe 20 Schluss (Unit-Tests) | ✅ |
| Erste Woche nicht zu schnell | 90 %: Tag 1 bis Straße 20, nach einer Woche am Gebietsboss der Straße (vorher schon Dunkler Wald 20) | ✅ |
| Kein Kampf länger als 10 s | alle Timer 10 s (Unit-Test) | ✅ |

## Dein Szenario: 5 Aufgaben verpasst + 2× Gewohnheit „−“ pro Tag

**Rechnung pro Tag:** Die 5 verpassten Aufgaben sind im Schnitt 8,5 Punkte.

| Posten | mit Strafe 3 (vorher) | mit Strafe 1,5 (jetzt) |
|---|---|---|
| Heilung durch erledigte Aufgaben (13,5 Punkte × 1) | +13,5 | +13,5 |
| Strafe für verpasste Aufgaben (8,5 Punkte × Faktor) | −25,5 | −12,75 |
| Gewohnheit „−“ (2 × 1 Punkt × 3) | −6 | −6 |
| **Summe Vitalität pro Tag** | **−18** | **−5,25** |
| Tod etwa alle … | 5–6 Tage | 3 Wochen |

Bei 100 Vitalität stirbt man mit Strafe 1,5 etwa alle drei Wochen. Bei jedem Tod gehen ein Level und alles Gold verloren.
Ergebnis nach 6 Monaten: **10 Tode**, Level 15, Wüste. Mit Strafe 3 waren es 32 Tode und man kam nie über Level 5 hinaus.

Wie die Strafhöhe das Szenario verändert (7 Läufe, 180 Tage, gerechnet mit den Gegnerwerten von v0.2.1):

| Strafe verpasste Aufgabe | Strafe Gewohnheit „−“ | Szenario: Tode | Szenario: Level | Szenario: weiteste Stufe | 50 %: Tode / Stufe | 75 %: Tode |
|---|---|---|---|---|---|---|
| 3 (SPEC-Start) | 3 | 32 | 5 | Dunkler Wald 25 | 41 / Dunkler Wald 25 | 2 |
| 2 | 3 | 17 | 7 | Dunkler Wald 25 | 22 / Dunkler Wald 25 | 0 |
| **1,5** (aktuell) | 3 | **9** | 17 | Wüste 25 | 12 / Sumpf 25 | 0 |
| 1,5 | 1,5 | 3 | 26 | Schnee 25 | 11 / Sumpf 25 | 0 |

**Folge der milderen Strafe:** Wer 75 % schafft, stirbt praktisch nie mehr. Auch bei 50 % kommt man ein Gebiet weiter als vorher.
Die Heilung gleicht die Strafe jetzt schon ab etwa 60 % erledigten Punkten aus (vorher ab 75 %), Gewohnheiten nicht mitgerechnet.

## Stellschrauben

| Wenn … | dann in `balance.ts` … |
|---|---|
| der Start zu leicht oder zu schwer ist | `enemies.baseHp` (56). Danach `areaHpGrowthExponential` so anpassen, dass der Drachen-Tag bleibt |
| alles zu schnell oder zu langsam geht | `enemies.areaHpGrowthExponential` (0,36) und `areaDamageGrowthExponential` (0,12). Das ist der stärkste Hebel für den Drachen-Tag. |
| die Wand in einem Gebiet zu früh oder zu spät kommt | `enemies.stageHpGrowth` / `stageDamageGrowth` (0,04) |
| Bosse zu hart oder zu weich sind | `combat.bossHpMultiplier` (2) und `areaBossHpMultiplier` (3) |
| Level-Ups zu oft oder zu selten kommen | `levels.xpMaxPerLevel` (1000 ≈ 4,5 perfekte Tage), `xpBase` (50), `xpExponent` (1,5) |
| verpasste Aufgaben zu hart oder zu mild bestraft werden | `vitality.missedDailyLossPerPoint` (1,5) und `habitMinus.vitalityLossPerPoint` (3), siehe Szenario |
| Ausrüstung zu viel oder zu wenig bringt | `items.basePoints` (1,5) und `items.levelFactor` (0,12) |

Nach jeder Änderung `npm run simulate` und `npm test` laufen lassen. `simulation.test.ts` prüft grobe Leitplanken.
