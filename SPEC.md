# SPEC – „Alltagsheld“ (Arbeitstitel)

Private, nicht-kommerzielle Habit-Tracking-App im Stil von Habitica, kombiniert mit einem automatischen Fantasy-Kampf (Auto-Battler). Echte Aufgaben im Alltag erledigen → in der App abhaken → Gold & Erfahrung → Charakter wird stärker → besiegt im Spiel stärkere Gegner.

Du (der Coding-Agent) baust diese App vollständig nach dieser Spezifikation. Lies das Dokument komplett, bevor du anfängst.

---

## 0. Arbeitsweise (wichtig)

- Arbeite **in Phasen** (siehe Abschnitt 12). Nach jeder Phase: kurz zusammenfassen, was fertig ist, wie ich es teste, und **stoppen**. Ich gebe Feedback, dann geht es mit der nächsten Phase weiter.
- Lege eine Datei `CLAUDE.md` an mit: Kurzbeschreibung, Tech-Stack, Befehle (dev/test/build/deploy), Projektstruktur und aktuellem Stand (welche Phase erledigt). Halte sie aktuell, damit neue Sessions sofort weiterarbeiten können.
- Alle Spielwerte (Punkte-Faktoren, Strafen, Kampfformeln, Truhen-Wahrscheinlichkeiten, Timer) gehören zentral in **eine** Konfigurationsdatei (`src/game/balance.ts`). Nichts davon hart im Code verstreuen – ich will später daran drehen.
- Spiellogik (Tageswechsel, Strafen, XP, Level, Tod, Kampfberechnung, Truhen) ist **reine, testbare Logik** ohne UI-Abhängigkeit. Schreibe dafür Unit-Tests.
- Bei Unklarheiten: sinnvolle Annahme treffen, im Phasen-Abschluss auflisten.
- **UI-Sprache: Deutsch.** Code, Variablen und Kommentare dürfen Englisch sein.

---

## 1. Plattform & Tech-Stack

- **Zielgerät: iPhone** (Hochformat). Umsetzung als **PWA** (Web-App, über Safari „Zum Home-Bildschirm“ installierbar, startet im Vollbild ohne Browserleiste).
- Empfohlener Stack (Abweichung nur mit Begründung):
  - TypeScript + Vite
  - React für die App-Oberfläche (Listen, Dialoge, Shop, Statistik)
  - **Phaser 3** für die Kampfszene (Sprites, Animationen, Tweens, Partikel, Sound)
  - **Dexie** (IndexedDB) für lokale Speicherung
  - `vite-plugin-pwa` (Manifest, Service Worker, offline-fähig)
  - Vitest für Tests
- **Daten nur lokal** auf dem Gerät. Kein Server, kein Login.
  - `navigator.storage.persist()` anfragen.
  - **Export/Import** des kompletten Spielstands als JSON-Datei (Einstellungen). Dezenter In-App-Hinweis, wenn das letzte Backup > 14 Tage her ist.
- **Hosting:** GitHub Pages (kostenlos, HTTPS – nötig für die PWA-Installation). Richte ein GitHub-Actions-Deployment ein und beschreibe in der README Schritt für Schritt, wie ich das Repo anlege, deploye und die App auf dem iPhone installiere.
- Keine Push-Benachrichtigungen.
- Safe Areas des iPhones (Notch, Home-Indicator) berücksichtigen.

---

## 2. Aufgaben

Es gibt genau **zwei Aufgabentypen**:

### 2.1 Tägliche Aufgaben (Dailies)
- Gelten **jeden Tag** (keine Wochentags-Regeln).
- Felder: Titel, Reihenfolge, archiviert ja/nein. **Seit v0.5 sind alle täglichen Aufgaben gleich viel wert** (Feedback: „alle Aufgaben gleich viel Wert“); das alte Feld „Punkte“ bleibt im Datenmodell, spielt aber keine Rolle mehr.
- Abhaken → sofort Belohnung (siehe 4.1). Wieder abwählen am selben Tag → Belohnung wird zurückgenommen.
- Bei der Tagesabrechnung zählt die **Quote** (erledigte / alle täglichen Aufgaben, siehe 5).

### 2.2 Gewohnheiten (Habits)
- Jede Gewohnheit hat einen **Plus-Button**, einen **Minus-Button** oder beide.
- **Seit v0.5 zählt jede Gewohnheit höchstens 1× am Tag** (Plus und Minus teilen sich diesen einen Tipp). Danach ist sie für heute erledigt.
- Felder: Titel, Plus-Button an/aus, **Minus-Stärke** (0–10, 0 = kein Minus-Button), Reihenfolge, archiviert.
- Beispiel: „Selbst gekocht“ (+), „Fertigessen bestellt“ (−1).
- Jeder Tipp wird mit Zeitstempel geloggt. Rückgängig-Funktion (Tipp des Tages entfernen, danach wieder antippbar).

### 2.3 Verwaltung
- Aufgaben anlegen, bearbeiten, löschen (mit Bestätigung), archivieren, per Drag & Drop sortieren.
- Archivierte Aufgaben behalten ihre Historie für die Statistik.

### 2.4 Startdaten (beim ersten Start vorbelegt, danach frei änderbar)

**Tägliche Aufgaben** (Punkte als Startwert):
| Aufgabe | Punkte |
|---|---|
| 7 Std. Schlaf | 3 |
| Direkt nach dem Wecker aufgestanden | 2 |
| Bett machen | 1 |
| Badroutine morgens | 1 |
| Vitamine morgens | 1 |
| Mehr als 10.000 Schritte | 3 |
| 2,5 Liter Wasser getrunken | 2 |
| Wohnung aufgeräumt | 2 |
| Klamotten für den nächsten Tag vorbereitet | 1 |
| Dehnen | 2 |
| Meditation | 2 |
| Vitamine abends | 1 |
| Badroutine abends | 1 |

**Gewohnheiten:**
- Selbst gekocht (+1)
- Fertigessen bestellt (−1)

---

## 3. Abfrage-Ablauf beim Öffnen der App

Tageswechsel ist **Mitternacht (lokale Zeit)**. Beim Öffnen der App (Kaltstart **und** Rückkehr aus dem Hintergrund) läuft folgende Reihenfolge:

### Schritt 1 – Rückblick „Gestern“ (nur wenn seit dem letzten Öffnen ein Tageswechsel war)
- Vollbild-Dialog: „Was hast du gestern geschafft?“ – **in eigener Nacht-Optik** (dunkelblau, Mond, Sterne), damit klar ist, dass es um den Vortag geht. Erscheint also nur beim ersten Öffnen am Tag.
- Liste aller **gestrigen, noch nicht abgehakten** täglichen Aufgaben mit Checkboxen.
- Darunter die Gewohnheiten mit +/− Zählern für **gestern** (falls ich am Vorabend etwas nicht eingetragen habe).
- Button **„Fertig“** → Eingaben übernehmen.
- **Wegwischen / Schließen** des Dialogs = „nichts weiter erledigt“: alle noch offenen Aufgaben von gestern gelten als nicht erledigt.
- **Nur der Vortag** ist nachtragbar, ältere Tage nicht.
- Danach: **Tagesabrechnung** für gestern (Strafen, Heilung, Streaks, ggf. Tod – siehe 5 und 9) und eine kurze Zusammenfassung: „Gestern: 10/13 erledigt · +180 XP · +90 Gold · −12 Vitalität“.

**Mehrere Tage nicht geöffnet:** Der Rückblick gilt nur für gestern. Alle Tage davor gelten als komplett nicht erledigt und werden Tag für Tag nacheinander abgerechnet. Pro Abrechnungsvorgang kann der Charakter **höchstens einmal sterben** (danach werden weitere Strafen dieses Vorgangs nicht mehr angewendet).

### Schritt 2 – Abfrage „Heute“
- Dialog mit allen **heute noch offenen** täglichen Aufgaben als **Liste mit Checkboxen** + Gewohnheiten-Buttons.
- Button „Fertig“ oder wegwischen → Hauptbildschirm.
- Erscheint nicht, wenn heute bereits alles erledigt ist. In den Einstellungen schaltbar – **standardmäßig aus** (Nutzerentscheidung nach Phase 3: nach dem Rückblick direkt zum Hauptbildschirm).

### Schritt 3 – Hauptbildschirm
- Angesammelte Ereignisse (Level-Up, Erfolge, Haustier freigeschaltet) werden **nacheinander** als Popups angezeigt, nicht gleichzeitig.

---

## 4. Belohnungen & Fortschritt

### 4.1 Belohnung pro Aufgabe (Werte in `balance.ts`, Stand v0.5)
- **Tagesbudget:** Alle täglichen Aufgaben zusammen bringen **200 XP und 100 Gold**. Jede Aufgabe bekommt den **gleichen Anteil**
  (13 Aufgaben → je 15 XP und 8 Gold). Mehr Aufgaben bringen also nicht mehr XP. Abhaken heilt keine Vitalität (die kommt aus der Quote, siehe 5).
- **Gewohnheit „+“** (1× am Tag): kleiner Bonus – alle „+“-Gewohnheiten zusammen sind 25 % des Tagesbudgets wert (4 Gewohnheiten → je 13 XP und 6 Gold), dazu **+2 Vitalität**.
- **Gewohnheit „−“** (1× am Tag): **Vitalität − Stärke × 3**, **Gold − Stärke × 5** (Gold nie unter 0). Kein XP-Verlust.
- **Perfekter Tag** (alle täglichen Aufgaben erledigt): zusätzlich **30 % des Tagesgolds** (30 Gold) bei der Abrechnung.
- Kurzes visuelles Feedback beim Abhaken („+15 XP“, „+8 Gold“ fliegen hoch).

### 4.2 Level
- XP-Bedarf für das nächste Level: `min(520, 80 × Level^0,9)` (Stand v0.5: anfangs fast jeden Tag ein Level, ab Level 8 alle 3–4 Tage; siehe BALANCING.md).
- **Pro Level-Up 1 Attributpunkt.** Popup mit Effekt und Sound: Ich wähle eins von drei Attributen:
  - **Stärke** → mehr Schaden pro Treffer
  - **Angriffsgeschwindigkeit** → kürzere Zeit zwischen Angriffen
  - **Leben** → mehr Lebenspunkte im Kampf
- Punkte dürfen auch „aufgehoben“ und später verteilt werden (Badge am Charakter-Tab).
- Die **Reihenfolge der vergebenen Punkte wird gespeichert** (nötig für die Todesstrafe).

### 4.3 Gold
- Wird nur für den Shop verwendet (siehe 7).
- **XP gibt es ausschließlich für echte Aufgaben.** Normale Gegner geben nur Spielfortschritt – im Spiel kann man nicht „farmen“.
- **Ausnahme Bosse** (Feedback Phase 4, geändert in v0.5): Der **erste** Sieg über einen Zwischenboss (Stufe 10/20) oder Gebietsboss (Stufe 25) gibt Gold und **immer eine Truhe**.
  Den Platz wähle ich selbst; bis dahin wartet die Truhe im Shop unter „Boss-Beute“. Truhenart je Gebiet: Holz am Anfang, Eisen ab dem Wald-Gebietsboss, **Gold ab dem Gebietsboss des Dunklen Walds** (Tabelle in BALANCING.md).
  Der **Drache** lässt stattdessen die **4 besten Gegenstände** fallen (je Platz ein legendäres Teil mit Bestwert). Nach einem Tod gibt derselbe Boss nichts mehr.

---

## 5. Vitalität & Strafen (harte Variante)

Neben den Kampf-Lebenspunkten gibt es eine dauerhafte Ressource **Vitalität** (max. 100), sichtbar in der Statusleiste. Sie spiegelt meine Disziplin im echten Leben.

- **Tagesquote** (seit v0.5, bei der Tagesabrechnung): erledigte ÷ alle täglichen Aufgaben, **nach Anzahl** gezählt. Sie ändert **nur die Vitalität**:
  - **unter 60 %: immer Verlust**, linear von −30 (0 %) bis −1 (knapp unter 60 %)
  - **60–70 %: ±0** (ein normaler Tag)
  - **über 70 %: Gewinn**, linear bis **+15** bei 100 % (100 % gibt zusätzlich Bonus-Gold, siehe 4.1)
  - Ein komplett verpasster Tag kostet 30 Vitalität → **vier komplett verpasste Tage = Tod**; eine schlechte Phase (30 %) etwa nach einer Woche.
  - Der Verlust wird auf die verpassten Aufgaben verteilt (fürs Tageslog), die Summe bleibt ganzzahlig.
- Gewohnheit „−“ kostet weiterhin Stärke × 3 Vitalität (siehe 4.1), „+“ heilt 2.
- **Erschöpft:** Vitalität unter 30 % → **−25 % Schaden im Kampf**. Sichtbar am Avatar (z. B. schwerer Gang, rötliche Vignette, Hinweis „Erschöpft“).
- **Tod** bei Vitalität ≤ 0 – eigener, dramatischer Bildschirm („Du bist gefallen …“). Folgen:
  1. **−1 Level**, XP im neuen Level auf 0. Der **zuletzt vergebene Attributpunkt** wird entfernt (bei aufgehobenem Punkt: dieser zuerst).
  2. **Alles Gold verloren.**
  3. **Ein zufälliges angelegtes Ausrüstungsteil geht kaputt** (wird gelöscht).
  4. **Zurück zum Anfang des aktuellen Gebiets** (Stufe 1 des Gebiets).
  5. Vitalität wird wieder auf 100 % gesetzt.
- Alle Werte (Quote, 30 %-Grenze, −25 %, Todesfolgen einzeln ein-/ausschaltbar) in `balance.ts`.

---

## 6. Kampfszene (Auto-Battler)

### 6.1 Darstellung
- Oberer Bildschirmbereich (~35–40 % der Höhe), **Pixel-Art**, scharf skaliert (`image-rendering: pixelated`, ganzzahlige Skalierung).
- Seitenansicht. Hintergrund mit **Parallax-Ebenen** je Gebiet.
- Der Avatar **läuft automatisch nach rechts** (Hintergrund scrollt). Von rechts kommt ein Gegner. Kein Eingreifen meinerseits – alles läuft automatisch.
- Anzeige oben: „Wald · Stufe 14/25“.
- Der Kampf läuft **nur, solange die App offen ist**. Kein Offline-/Idle-Fortschritt.

### 6.2 Ablauf eines Kampfes
1. Gegner erreicht den Avatar → Kampf startet, **Timer 10 s** wird angezeigt.
2. Beide greifen automatisch an, jeder in seinem eigenen Angriffstakt.
3. **Lebensbalken unter Avatar und Gegner**, die sichtbar sinken.
4. Bei jedem Treffer: **Schadenszahl fliegt hoch**, Treffer-Effekt (Aufblitzen, kurzer Rückstoß, Partikel), **Treffer-Sound**. Kritische Treffer größer/farbig mit eigenem Sound.
5. **Gegner besiegt** → Todesanimation, Avatar läuft weiter, nächster (stärkerer, anderer) Gegner.
6. **Zeit abgelaufen oder Avatar besiegt** → kurze Animation (Avatar zieht sich zurück / Bildschirm-Fade), Kampf beginnt **von vorne gegen denselben Gegner** (beide wieder volle LP).
7. Nach 3 Fehlversuchen am selben Gegner erscheint dezent: „Erledige Aufgaben, um stärker zu werden.“ Der Kampf läuft trotzdem weiter in Schleife.

### 6.3 Kampfwerte (Startwerte, per Simulation justieren)
- **Avatar**
  - Kampf-LP = 100 + 15 × Leben + Ausrüstung
  - Schaden pro Treffer = 10 + 3 × Stärke + Ausrüstung (−25 % wenn erschöpft)
  - Angriffsintervall = 1,2 s / (1 + 0,06 × Angriffsgeschwindigkeit + Ausrüstung), min. 0,25 s
  - Kritische Treffer: 10 % Chance + Krit-Chance der Ausrüstung (Schild, max. 60 %), ×1,5 Schaden
- **Gegner**
  - Stärke je Gebiet über vier Ankerpunkte (Stufe 1, Boss 10, Boss 20, Gebietsboss), dazwischen gleichmäßiges Wachstum (Stand v0.5, per Simulation angepasst; Formeln in BALANCING.md).
    Schaden wächst mit der Wurzel der Stärke, Gegner greifen etwa jede Sekunde an – Leben ist damit ein echtes Attribut.
  - Gegnertypen sind **gleich schwer**, unterscheiden sich aber im Rhythmus (z. B. Wölfe schnell & schwach, Golems langsam & hart zuschlagend).
  - **Boss** auf jeder 10. Stufe: so stark wie ein normaler Gegner **3 Stufen weiter**, **Timer 10 s**, größer dargestellt, eigener Auftritt (Boss-Banner + Sound). Die Gegner direkt danach sind leicht.
  - **Gebietsboss** auf Stufe 25: wie ein Gegner **4,5 Stufen weiter**, **Timer 10 s**.
  - Ein neuer Held (ohne Attributpunkte) gewinnt den ersten Kampf, danach braucht er die ersten Level-Ups.
  - Timer überall 10 s (Nutzer-Feedback Phase 2, ursprünglich 15/20 s).

### 6.4 Welt: 8 Gebiete × 25 Stufen
Nach jedem Gebietsboss wechselt die Landschaft (Übergangsanimation). Gegner variieren so stark wie möglich:

| # | Gebiet | Gegner (Beispiele) | Gebietsboss |
|---|---|---|---|
| 1 | Straße | Ratten, Schleime, Strauchdiebe, streunende Hunde | Banditenanführer |
| 2 | Wald | Wölfe, Kobolde, Riesenkäfer, Wildschweine | Alpha-Wolf |
| 3 | Dunkler Wald | Riesenspinnen, Fledermäuse, Skelette, Irrlichter | Verdorbener Baumgeist |
| 4 | Sumpf | Sumpfschleime, Echsenkrieger, Moorleichen, Riesenfrösche | Hydra |
| 5 | Wüste | Skorpione, Skarabäen, Mumien, Sandwürmer | Sandwurm-König |
| 6 | Strand | Riesenkrabben, Piratenskelette, Fischmenschen, Seeschlangen | Kraken |
| 7 | Schnee | Eiswölfe, Yetis, Eisgolems, Frostgeister | Frostriese |
| 8 | Vulkan | Feuerkobolde, Lavagolems, Höllenhunde, Feuerelementare | **Drache** (Endboss) |

Zwischenbosse (Stufe 10 und 20) sind größere, stärkere Varianten der Gebietsgegner (z. B. „Koboldhäuptling“, „Steingolem“). Nach dem Drachen beginnt die Welt von vorne als **„Runde 2“** (stärkere Gegner, Sternsymbol an der Stufenanzeige) – endloser Fortschritt.

### 6.5 Grafik-Assets
- **Avatar:** Pixel-Art mit **Ebenen-Sprites**, damit Kopf, Körper, Waffe und Schild einzeln wechselbar und sichtbar sind. Empfehlung: Sprites aus dem *Universal LPC Spritesheet Character Generator* (GitHub, Liberated Pixel Cup; Lizenzen CC-BY-SA/GPL/OGA-BY – für privat unproblematisch). Benötigte Animationen: Laufen, Angreifen, Getroffen, Sterben/Rückzug, Idle.
- **Gegner & Hintergründe:** freie Pixel-Art-Packs (OpenGameArt, itch.io u. ä.). Wo nichts Passendes verfügbar ist: **Varianten durch Umfärben und Skalieren** (z. B. Wolf → Eiswolf, Golem → Lavagolem) oder prozedural erzeugte Platzhalter-Sprites.
- Alle Assets über ein **Asset-Manifest** einbinden, damit ich Grafiken später einfach austauschen kann. Fehlende Grafik → automatischer Platzhalter, nie ein Absturz.
- Lege eine `CREDITS.md` mit Quelle und Lizenz jedes Assets an.

---

## 7. Avatar, Ausrüstung & Shop

### 7.1 Avatar-Erstellung (einfach halten)
Beim ersten Start: Name, Körpertyp, Hautfarbe, Frisur, Haarfarbe. Start-Ausrüstung: einfache Stoffkleidung, Holzschwert, kein Schild. Aussehen später in den Einstellungen änderbar. Keine Klassen.

### 7.2 Ausrüstungsplätze
**Kopf, Körper, Waffe, Schild.** Jedes Teil ist **sichtbar am Avatar** und gibt Werte-Boni (feste Regeln seit dem Feedback zu Phase 4):
- Waffe → Stärke, manche Waffen zusätzlich Angriffsgeschwindigkeit
- Helm (Kopf) → nur Angriffsgeschwindigkeit
- Rüstung (Körper) → Leben
- Schild → Leben und kritische Trefferchance
- Episch und Legendär sind stärker (+15 % auf den Seltenheitsfaktor, seit v0.5) und tragen den Hauptwert im Namen („… der Präzision“).

### 7.3 Shop mit Zufallstruhen
- Ich wähle den **Platz** (Kopf/Körper/Waffe/Schild) und die **Truhe**. Werte und Seltenheit sind **zufällig**; das Aussehen am Helden ergibt sich aus Platz + Seltenheit (je Seltenheit ein sichtbar anderes Teil).
- Je teurer die Truhe, desto höher die Chance auf starke Items – Legendär bleibt sehr unwahrscheinlich:

| Truhe | Preis | Gewöhnlich | Ungewöhnlich | Selten | Episch | Legendär |
|---|---|---|---|---|---|---|
| Holztruhe | 250 | 70 % | 25 % | 5 % | 0 % | 0 % |
| Eisentruhe | 1.000 | 35 % | 40 % | 20 % | 4,5 % | 0,5 % |
| Goldtruhe | 3.750 | 10 % | 35 % | 40 % | 13 % | 2 % |

- Preise ×2,5 nach dem Feedback zu Phase 4 (2–3 Truhen bis zum ersten Zwischenboss, siehe BALANCING.md).
- Seltenheitsfarben: grau, grün, blau, lila, orange – **nur für Schrift/Rahmen**, das Item-Bild zeigt das echte Material wie im Kampf. Episch/Legendär mit leichtem Glanz-/Partikeleffekt am Avatar.
- **Itemwerte skalieren mit Seltenheit** (Faktoren 1 / 1,35 / 1,8 / 2,4 / 3,2, seit v0.5 enger, damit Glück den Fortschritt nicht zu stark bestimmt) **und meinem Level beim Kauf**, damit Truhen auch später relevant bleiben. Leichte Zufallsstreuung (±15 %).
- Generierte Namen, z. B. „Rostiges Kurzschwert“, „Verstärkter Lederhelm“, „Legendärer Drachenschuppenpanzer“.
- **Truhen-Öffnungsanimation** (Wackeln → Aufspringen → Lichtstrahl in Seltenheitsfarbe).
- Danach: „Anlegen“ oder „Ins Inventar“. Vergleich mit dem aktuell angelegten Teil (Werte grün/rot). Das Item ist ab dem Kauf gespeichert (im Inventar) – wird die App mitten in der Animation geschlossen, geht nichts verloren.
- **Inventar:** Filter (alle oder ein Platz), sortiert vom seltensten zum einfachsten Teil; anlegen, ablegen, **verkaufen für 25 % des Truhenpreises**.

---

## 8. Streaks & Haustiere

- **Streak pro täglicher Aufgabe:** Tage in Folge erledigt. Wird bei einem verpassten Tag auf 0 gesetzt. Meilensteine bei 7 / 21 / 50 / 100 Tagen geben **Bonus-Gold** (Startwerte 50 / 150 / 400 / 1.000) mit kleinem Popup.
- **„Perfekter Tag“** = alle täglichen Aufgaben erledigt. Eine Serie perfekter Tage schaltet **Haustiere** frei, die neben dem Avatar herlaufen (rein optisch):
  - 3 Tage: Fuchs · 7: Eule · 14: Katze · 30: Wolfswelpe · 60: Greif-Küken · 100: Babydrache
- Freigeschaltete Haustiere bleiben, auch wenn die Serie reißt. Aktives Haustier im Charakter-Tab wählbar.

---

## 9. Erfolge

Eigener Bildschirm mit freigeschalteten und gesperrten Erfolgen (gesperrte zeigen den Fortschritt, z. B. 12/30). Beim Freischalten Popup mit Effekt. Startliste – gern sinnvoll erweitern:
- Erster Sieg · Erster Boss · jedes Gebiet erreicht (8×) · Drache besiegt
- Level 5 / 10 / 25 / 50
- 7 / 30 / 100 perfekte Tage in Folge
- 30× selbst gekocht · 100 tägliche Aufgaben erledigt · 1.000 tägliche Aufgaben erledigt
- Erste epische Ausrüstung · erste legendäre Ausrüstung · komplettes Set einer Seltenheit
- „Von den Toten auferstanden“ (erster Tod) · 7 Tage ohne Minus-Gewohnheit
- Alle Haustiere gesammelt

---

## 10. Statistik

- **Wochenansicht:** Balkendiagramm Erfüllungsquote pro Tag (%), Woche vor/zurück blätterbar.
- **Pro Aufgabe:** Kalender-Heatmap (erledigt/nicht erledigt), aktuelle und längste Streak, Quote der letzten 30 Tage.
- **Gewohnheiten:** Plus/Minus pro Woche.
- **Gesamt:** XP und Gold pro Woche, Level-Verlauf, Anzahl Tode, besiegte Gegner, höchste erreichte Stufe.
- Grundlage ist ein lückenloses Tageslog, auch für archivierte Aufgaben.

---

## 11. Balancing (Pflicht)

Schreibe ein **Simulationsskript** (`npm run simulate`), das mit den Startaufgaben 30 / 90 / 180 Tage durchspielt – bei 50 %, 75 %, 90 % und 100 % täglicher Erfüllung, inklusive Shopkäufen (einfache Strategie: immer beste leistbare Truhe für den schwächsten Platz) und optimaler Attributverteilung. Ausgabe als Tabelle: Level, erreichte Stufe/Gebiet, Tode, Gold. Seit v0.5 rechnet die Simulation mit meinem echten Umfang (13 tägliche Aufgaben, 4 „+“- und 3 „−“-Gewohnheiten, 3–4 Tipps am Tag) bei 100 / 90 / 80 / 65 / 50 / 30 % und gibt die Tage bis zu jedem Boss samt Truhenzahl aus.

**Zielwerte seit v0.5** (Feedback „Balancing“, Maßstab 65 % Erfüllung): Tag 1 Stufe 3–4, Tag 2 Stufe 6–8, Boss 10 nach 3–4 Tagen erreicht und nach 2–3 Tagen besiegt, danach 3–4 leichte Gegner, Wände von 1–2 Tagen,
Boss 20 2–3 Tage, Gebietsboss 3–4 Tage, spätere Gebiete länger. **Drache nach etwa 6 Monaten** (90 %: etwa 4 Monate). Level-Ups anfangs fast täglich, ab Level 8 alle 3–4 Tage.
Die ursprünglichen Zielwerte unten gelten nicht mehr.

**Zielwerte** – passe die Formeln in `balance.ts` an, bis sie ungefähr erreicht werden:
- 90 % Erfüllung: Drache (Ende Gebiet 8) nach ca. **5–6 Monaten**.
- 75 % Erfüllung: deutlich langsamer, ca. Gebiet 5–6 nach 6 Monaten.
- 50 % Erfüllung: regelmäßige Tode, kaum Fortschritt über Gebiet 2–3 hinaus.
- Erste Level-Ups schnell (Level 3 am ersten Tag bei guter Erfüllung), danach spürbar langsamer. (Seit v0.5: Level 2 am ersten Tag, Level 6 nach einer Woche.)
- Am Anfang sollen die ersten ~5 Stufen ohne jeden Fortschritt schaffbar sein (Erfolgserlebnis), danach entsteht eine natürliche „Wand“, die nur durch echte Aufgaben überwunden wird.

Dokumentiere die finalen Werte und Ergebnisse in `BALANCING.md`.

---

## 12. Bildschirme & Navigation

Hochformat. Oben immer: **Kampfszene**, darunter die **Statusleiste** (Level, XP-Balken, Gold, Vitalität-Balken, Badge für unverteilte Punkte). Unten eine Tab-Leiste:

1. **Heute** – tägliche Aufgaben (Checkbox-Liste, erledigte nach unten, ausgegraut) und Gewohnheiten (+/− Buttons, Tageszähler)
2. **Charakter** – Avatar groß, Attribute verteilen, Ausrüstung, Inventar, Haustiere
3. **Shop** – Truhen
4. **Statistik**
5. **Mehr** – Erfolge, Aufgaben verwalten, Einstellungen

**Einstellungen:** Ton an/aus, Lautstärke, Abfrage „Heute“ beim Öffnen an/aus, Avatar-Aussehen ändern, Backup exportieren/importieren, Spielstand zurücksetzen (doppelte Bestätigung), **Entwicklermenü** (versteckt, z. B. 5× auf die Versionsnummer tippen): Datum um 1 Tag vorspulen, Gold/XP hinzufügen, Vitalität setzen, Stufe setzen – nötig, um Tageswechsel, Tod und Kampf zu testen.

**Optik:** Fantasy-Stil passend zur Pixel-Art (dunkle Pergament-/Holztöne, Pixel-Schrift für Überschriften und Zahlen, gut lesbare Schrift für Listen). Große Touch-Ziele. Kurze, flüssige Animationen.

---

## 13. Sound

- **Nur Kampf- und Spiel-Effekte, keine Musik.**
- Benötigt: Treffer Avatar, Treffer Gegner, kritischer Treffer, Gegner besiegt, Boss erscheint, Kampf verloren/Zeit abgelaufen, Level-Up, Truhe öffnen, Erfolg freigeschaltet, Tod.
- Am einfachsten **prozedural per Web Audio API** erzeugen (Retro-/8-Bit-Stil, z. B. jsfxr-artig) – keine Lizenzfragen. Alternativ freie Sound-Packs (in `CREDITS.md` aufführen).
- Audio erst nach der ersten Nutzerinteraktion aktivieren (iOS-Vorgabe).

---

## 14. Datenmodell (Vorschlag)

- `Task` { id, type: 'daily' | 'habit', title, points (daily), plusPoints, minusPoints (habit), order, archived, createdAt }
- `DayLog` { date (YYYY-MM-DD), taskId, done (daily), plusCount, minusCount (habit), settled }
- `Player` { name, look, level, xp, gold, vitality, attributes { strength, speed, life }, unspentPoints, attributeHistory[], equipped { head, body, weapon, shield }, activePet, unlockedPets[], round, area, stage, deaths, lastSettledDate, lastBackupAt }
- `Item` { id, slot, rarity, name, spriteKey, stats, levelAtPurchase, chestType }
- `Achievement` { id, unlockedAt, progress }
- `Settings` { … }
- Versioniertes Schema mit Migrationen (Spielstand darf bei Updates nicht verloren gehen).

---

## 15. Phasenplan

**Phase 1 – Fundament & Aufgaben**
Projekt-Setup, PWA, Deployment auf GitHub Pages inkl. README-Anleitung, Datenmodell und Speicherung, Startdaten, Aufgabenverwaltung, Tab „Heute“, Abfrage-Ablauf (Gestern/Heute), Tagesabrechnung, XP/Gold/Level, Vitalität, Strafen, Tod, Export/Import, Entwicklermenü, Tests für die gesamte Tageslogik. Kampfbereich vorerst als einfacher Platzhalter.

**Phase 2 – Kampf (mit Platzhaltergrafik)**
Phaser-Szene, Laufen, Gegner-Spawn, Kampf mit Timer, Lebensbalken, Schadenszahlen, Krits, Neustart bei Niederlage, Stufen/Gebiete/Bosse, Attribute & Level-Up-Popup, Erschöpft-Zustand. Balancing-Simulation inkl. `BALANCING.md`.

**Phase 3 – Grafik & Avatar**
Pixel-Art-Assets einbinden (Asset-Manifest, `CREDITS.md`), Avatar-Erstellung, sichtbare Ausrüstung in Ebenen, Gegner aller 8 Gebiete, Parallax-Hintergründe, Gebietsübergänge, Boss-Auftritte.

**Phase 4 – Shop & Ausrüstung**
Truhen, Seltenheiten, Item-Generator, Öffnungsanimation, Inventar, Vergleich, Verkaufen, Werte-Boni im Kampf.

**Phase 5 – Motivation & Feinschliff**
Streaks, Haustiere, Erfolge, Statistik-Bildschirm, alle Sounds und Effekte (Treffer, Level-Up, Tod), Backup-Hinweis, Feinschliff der Animationen, abschließender Test auf dem iPhone.
