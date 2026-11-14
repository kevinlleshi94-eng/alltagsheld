# CLAUDE.md – Alltagsheld

Private Habit-Tracker-PWA (iPhone, Hochformat) im Habitica-Stil mit Fantasy-Auto-Battler.
Echte Aufgaben abhaken → XP/Gold/Vitalität → Held wird stärker. Vollständige Anforderungen: **SPEC.md** (immer zuerst lesen).

## Arbeitsweise (aus SPEC §0)
- In Phasen arbeiten (SPEC §15). Nach jeder Phase: Zusammenfassung + Testanleitung, dann **stoppen** und auf Feedback warten.
- **Alle** Spielwerte nur in `src/game/balance.ts`.
- Spiellogik bleibt rein (keine UI/DB-Imports in `src/game/`), mit Unit-Tests.
- UI-Sprache Deutsch; Code/Kommentare Englisch.
- Annahmen bei Unklarheiten treffen und im Phasen-Abschluss auflisten.
- Diese Datei (und `src/battle/CLAUDE.md`) aktuell halten (Stand, Befehle, Struktur).

## Tech-Stack
Phaser 3.90 für die Kampfszene (per `import('./game')` nachgeladen, eigener ~1,2-MB-Chunk, vom Service Worker vorab gecacht).

## Befehle
| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Port 5173; `.claude/launch.json` → Name `dev`) |
| `npm.cmd run dev -- --host` | Dev-Server im Heimnetz fürs iPhone (PC: 192.168.178.23, Ethernet, Netzprofil „Öffentlich“; Firewall-Regel für node.exe erlaubt eingehend) |
| `npm run preview` | Build lokal mit Service Worker testen |
| `npm run simulate` | Balancing-Simulation (`--days=180 --seeds=7 --markdown`), Ergebnis → BALANCING.md |
| `node scripts/fetch-lpc.mjs` | LPC-Ebenen + Definitionen nachladen (nur fehlende Dateien; neue Downloads vorher mit dem Nutzer absprechen) |
| Deploy | Push auf `main` → GitHub Actions (`.github/workflows/deploy.yml`, Tests + Build) → GitHub Pages. `BASE_PATH=/<repo>/` wird im Workflow gesetzt. |

**Live:** https://kevinlleshi94-eng.github.io/alltagsheld/ · Repo (öffentlich): https://github.com/kevinlleshi94-eng/alltagsheld
GitHub CLI: `C:\Program Files\GitHub CLI\gh.exe` (angemeldet als kevinlleshi94-eng). Git-Anmeldung nur in diesem Repo über `gh auth git-credential`
(lokale `.git/config`), Autor = GitHub-noreply-Adresse. Pushen nur nach Freigabe durch den Nutzer.
Daten (IndexedDB) hängen an der Adresse: Dev-Server (192.168.178.23:5173) und GitHub Pages haben getrennte Spielstände → Umzug per Backup-Export/-Import.

## Projektstruktur
```
src/game/        reine Logik + Tests
  balance.ts       ALLE Zahlenwerte (Belohnung, XP-Kurve, Vitalität, Strafen, Tod, Timer, Kampf, Gegnerwachstum, Truhen, Simulation)
  dates.ts         Datums-Keys YYYY-MM-DD (lokale Mitternacht), DST-sichere Arithmetik
  progression.ts   XP/Level, Attributpunkte (Reihenfolge in attributeHistory)
  resources.ts     applyDelta(): EINZIGE Stelle, die XP/Gold/Vitalität ändert (Level-Up/-Down, Gold ≥ 0, Vitalität ≤ max, Tod)
  death.ts         Todesfolgen (einzeln abschaltbar in balance.death)
  taskActions.ts   Daily abhaken/zurücknehmen, Habit +/−, Undo letzter Tipp
  settlement.ts    Tagesabrechnung (pendingDays, settle) inkl. Review-Eingaben „Gestern“
  selectors.ts     Listen für „Heute“ (offene zuerst, erledigte unten)
  combat.ts        Heldenwerte, Stufen-Index/Gegner je Stufe, Kampf-Engine (stepFight: pro Frame ODER komplett), applyVictory, wallIndex
  items.ts         Item-Generator: Truhen-Seltenheit, Budget (Seltenheit × Level ± Streuung) → Werte je Platz (SLOT_STATS, splitBudget), itemPower,
                   deutsche Namen (Adjektiv-Endung nach Genus), Verkaufspreis, convertLegacyItem (Schema v4)
  shop.ts          Truhe kaufen (Gold via applyDelta, Item landet unangelegt im Inventar), anlegen/ablegen, verkaufen, statDiff (Vergleich), sortInventory (seltenste zuerst), filterInventory
  bossRewards.ts   Boss-Gold + Truhe beim ERSTEN Sieg (isFirstVictory) → player.pendingChests, openPendingChest (Platz wählen), dragonHoard,
                   winFight = applyVictory + Belohnung (von repo und Simulation genutzt)
  simulation.ts    Balancing-Simulation mit echten Spielfunktionen (scripts/simulate.ts); Profile 'user' (USER_DAILIES 13 Aufgaben + 4/3 Gewohnheiten +/−,
                   „+“ mit 60 %, „−“ mit 30 % je Tag) / 'seed', simulateDetailed → Meilensteine
  world.ts         8 Gebiete: Namen, Paletten, Gegner (Archetyp + Platzhalter-Form/Farben), Zwischen-/Gebietsbosse
  seed.ts, rng.ts, testUtils.ts (TEST_BALANCE: fixe XP-Kurve, damit Mechanik-Tests nicht vom Tuning abhängen)
src/battle/      Kampfszene – Dateien + Regeln in `src/battle/CLAUDE.md` (wird geladen, wenn dort gearbeitet wird)
public/assets/   lpc/spritesheets/ (LPC-Generator-Ebenen, nur walk + slash), monsters/ (OGA-Sheets). Workbox cacht ALLE PNGs vorab → ungenutzte löschen
assets-src/      Quellen: lpc/sheet_definitions (Credits je Ebene), oga/ (Original-Downloads); nicht im Build
src/audio/sfx.ts Web-Audio-Soundeffekte (iOS-Unlock beim ersten Tippen, Lautstärke/An-Aus aus Einstellungen)
src/shop/        art.ts (Pixel-Bitmaps Truhen/Items + Paletten, getestet), format.ts (rarityStyle, statsText),
                 ItemViews.tsx (ItemIcon, StatCompare grün/rot, ItemRow, ItemSheet: anlegen/ablegen/verkaufen), ChestOpening.tsx (Öffnungsanimation)
src/db/          Dexie-Schema (db.ts, SCHEMA_VERSION), repo.ts (Aktionen in Transaktionen), backup.ts (Export/Import), migrations.ts
src/lib/clock.ts Spieluhr mit Dev-Versatz – IMMER clock.now() statt Date.now() für Spielzeit
src/state/       Mini-Stores (store.ts), ui.ts (Event-Queue, Flow-Phase, Floating-Texte, Toasts, Tab, shopSlot, fightBlockers),
                 hooks.ts (Live-Queries, useToday, useItems, usePauseFight), actions.ts (guarded = Fehler als Toast)
src/ui/          Sheet/Modal (+ effect-Ebene, per Portal in document.body), Portal.tsx, Confirm, controls, layout (Statusleiste, Tab-Leiste), PixelIcon/PixelSprite,
                 labels.ts (deutsche Namen + Seltenheitsfarben RARITY_COLORS, auch für Phaser), combatText.ts
```

## Wichtige Designentscheidungen
- **Belohnungen werden sofort beim Abhaken angewendet**; DayLog speichert die *tatsächlich* angewendeten Werte (`reward`, `taps[].applied`, `penalty`).
  Zurücknehmen kehrt genau diese Werte um (inkl. Level-Down + Entfernen des letzten Attributpunkts).
  Belohnungen von *vor* dem letzten Tod (`player.lastDeathAt`) werden nicht zurückgenommen.
- **Tagesabrechnung** (`settle`): Tage chronologisch; ältere Tage = „nichts weiter erledigt“ (bereits abgehakte bleiben erledigt);
  Review-Eingaben für gestern werden *vor* den Strafen von gestern angewendet; max. 1 Tod pro Lauf, danach keine Verluste mehr.
  Erzeugt für jede aktive tägliche Aufgabe einen DayLog-Eintrag (lückenloses Log). Archivierte/später erstellte Aufgaben zählen nicht.
- **Rückblick-Dialog ist ein Entwurf**: erst „Fertig“ übernimmt; Wegwischen/✕ = nichts weiter erledigt. Die „Heute“-Abfrage wirkt sofort.
- **„Heute“-Abfrage standardmäßig aus** (Nutzer-Feedback Phase 3, Schema v3 schaltet sie auch bei Bestandsdaten ab, in den Einstellungen wieder einschaltbar).
  Rückblick „Gestern“ + Abrechnung haben eine eigene **Nacht-Optik** (Klasse `.yesterday`, Mond-Icon), damit klar ist, dass es um den Vortag geht.
- Flow: `boot → review → summary → todayPrompt → main`. Todesbildschirm erscheint ab `todayPrompt`, andere Popups nur in `main`.
  Trigger: Kaltstart, Rückkehr aus Hintergrund (≥ `balance.app.todayPromptMinHiddenMs` → mit „Heute“-Abfrage), Minuten-Check auf Mitternacht, Dev-Uhr.
- Ereignis-Warteschlange ist nur im Speicher (nicht persistent); unverteilte Punkte bleiben trotzdem im Spieler gespeichert (Badge).
- Datenbank-Schema ändern: neue `this.version(N)` in `db.ts` + `SCHEMA_VERSION` erhöhen + Schritt in `migrateSnapshot` (alte Backups).
- Dev-Menü: 5× auf die Versionsnummer in den Einstellungen tippen (Status in localStorage `alltagsheld.devMenu`).
  Vorspulen ist absichtlich nicht umkehrbar (sonst wären „heutige“ Logs schon abgerechnet).
- **Kampf**: Normale Gegner geben keine Belohnung, nur Stufenfortschritt. **Jeder** Boss gibt beim ersten Sieg Gold + eine Truhe (bossRewards.ts):
  Banner „Boss besiegt! +N Gold · Holztruhe!“, die Truhe landet in `player.pendingChests` (Schema v5), Event `bossChest` → Dialog
  „Beute vom Boss!“: Platz wählen → Öffnungsanimation; „Später“ lässt sie im Shop unter „Boss-Beute“. Der Drache gibt statt Truhe
  den Drachenschatz (je Platz ein legendäres Item mit bestem Wurf, Event `dragonHoard`).
  Ein Sieg wird sofort per `repo.recordVictory(pos)` gespeichert
  (rückt nur vor, wenn der Held noch dort steht). Die Szene unterscheidet eigene Siege von Positionswechseln von außen (Tod, Dev-Menü)
  über `expected`/`prevInputPos`; Wechsel von außen → Fade zur neuen Stufe. Heldenwerte gelten ab dem nächsten Kampf.
  Pause (Flow ≠ main oder Popup in der Queue) über eigenes `paused`-Flag – NICHT `scene.pause()` (bleibt hängen, wenn während create() aufgerufen).
- **Gegnerwachstum** (v0.5, BALANCING.md): Stärke je Gebiet über 4 Ankerpunkte (`balance.enemies.areas`: Stufe 1, Boss 10, Boss 20,
  Gebietsboss), dazwischen gleichmäßig; `bend`/`startBend` formen die Kurve (`areaScale` in combat.ts). Schaden wächst mit √Stärke.
  Ein Boss ist so stark wie ein Gegner 3 Stufen weiter (Gebietsboss 4,5) → davor leichter, danach 2–3 leichte Gegner; keine LP-Faktoren mehr.
  Alle Gegnertypen etwa gleich schwer (unterscheiden sich im Rhythmus). Neuer Held gewinnt Stufe 1 ohne Punkte (Tests in combat.test.ts).
  Alle Kampf-Timer 10 s (Nutzer-Feedback, weicht von SPEC 15/20 s ab). XP pro Level `min(520, 80 × Level^0,9)` (anfangs fast täglich, ab ~Level 8 alle 3–4 Tage).
  Stufen-Index = (Runde−1)·200 + (Gebiet−1)·25 + (Stufe−1). Bosse ×2 Sprite-Größe (gedeckelt auf 46 % der Szenenhöhe, mind. ×1,2).
- **Kampfszene & Grafik** (HTML-Texte statt Phaser-Text, `.battle-canvas` immer rendern, LPC-Zusammensetzen, Platzhalter statt Absturz,
  GEAR-Aussehen, Treffer-Timing, neue Gegner): siehe `src/battle/CLAUDE.md`.
- **iPhone ist der Maßstab** (Nutzer-Feedback): App max. 430 px breit, am PC mittig wie ein iPhone; Kampfhöhe `min(36dvh, 304px)`.
  Bosse ×2, aber nie über Stufenanzeige/Timer (`HUD_CLEAR_PX` in BattleScene). Handy quer → Hinweis „hochkant halten“ (nur CSS).
  Hinweis „Erledige Aufgaben …“ oben links unter den Kampfwerten, nicht in der Mitte.
- **„Bewegung reduzieren“ (iOS)**: Die globale Regel kürzt alle Animationen auf 0,01 ms. Spiel-Feedback (Floats, Schadenszahlen,
  Banner, Level-Up) hat im selben Media-Block eigene Fade-Varianten (`rm-*`). Neue Feedback-Animationen dort ergänzen, sonst sind sie unsichtbar.
- **Stufen-Beschriftung**: „Gebiet 2 – Wald · Stufe 5/25“ (`areaLabel`/`formatStage` in world.ts). Kein „LV“, das ist das Helden-Level.
- **Level-Up**: Punkt muss im Popup sofort verteilt werden (kein „Später“, Nutzer-Feedback). Alte unverteilte Punkte bleiben im Charakter-Tab verteilbar.
- **Vitalität ≠ Leben**: Statusleiste zeigt „VIT“ (Alltagsenergie), das Herz steht nur noch für Lebenspunkte im Kampf.
- **Belohnungen & Quote (v0.5)**: Alle täglichen Aufgaben zusammen = festes Tagesbudget (200 XP / 100 Gold), gleich verteilt
  (Punkte zählen nur noch bei „−“-Gewohnheiten). „+“-Gewohnheiten zusammen 25 % des Budgets + 2 VIT; jede Gewohnheit zählt 1× am Tag
  (`habitTapsPerDay`, Taste danach gesperrt). Vitalität am Tagesende nur nach **Quote der Aufgaben**: < 60 % Verlust (0 % → −30),
  60–70 % ±0, darüber Gewinn bis +15; 100 % → +30 % des Tagesgolds. „−“ = −3 VIT / −5 Gold je Punkt. Rundung pro Tag in settlement.ts.
- **Ausrüstung** zählt als zusätzliche Attributpunkte (`effectiveAttributes`: Stärke/Tempo/Leben); Krit-Chance vom Schild separat (`gearCrit`,
  in Prozentpunkten gespeichert, Held max. 60 %). Player.progress (Schema v2): besiegte Gegner/Bosse/Drachen, weiteste Stufe.
- **Shop (Phase 4)**: Aussehen = Platz × Seltenheit (`spriteKey` `slot:rarity`, passt zu GEAR); Name passt zum Teil (NOUNS in items.ts).
  Kauf speichert das Item sofort unangelegt (`repo.buyChestItem` → `{item, current}`), erst „Anlegen“ rüstet aus → Abbruch der Animation verliert nichts.
  Verkaufen = 25 % des Truhenpreises (unbekannte Truhe → Holz). Truhen-Animation pausiert den Kampf (`usePauseFight` → `fightBlockers`).
  Episch/Legendär: Funken am Helden im Kampf (Partikel in Seltenheitsfarbe, folgen dem Helden) + Glanz im Porträt.
  Seltenheitsfarben nur in labels.ts (`RARITY_COLORS`), CSS bekommt sie als `--rarity` – **nur für Schrift/Rahmen**,
  Item-Bilder in Materialfarben wie im Kampf (`ITEM_LOOK`/`itemPalette` in art.ts, passt zu GEAR).
- **Feedback Phase 4** (v0.4.1): Werte je Platz fest (Waffe Stärke [+ Tempo], Helm Tempo, Rüstung Leben, Schild Leben + Krit), Schema v4 rechnet alte Items um.
  Truhen 250/1000/3750. Seltenheitsfaktoren seit v0.5 1/1,35/1,8/2,4/3,2 (+15 % bei Episch/Legendär).
  Balancing v0.5 auf das Nutzer-Profil bei 65 %: Boss 10 Tag 4→5, Boss 20 Tag 8→10, Straße Tag ~13, Drache ~Tag 171 (BALANCING.md, Tests in simulation.test.ts).
  **Overlays immer per Portal in document.body** (Sheet, Modal, ChestOpening): in `.content` werden sie auf iOS abgeschnitten/falsch geschichtet.
  Charakter-Tab: Held → Attribute (Wert jetzt → nach nächstem Punkt) → Ausrüstung → Inventar (Filter-Chips) → Kampfwerte → Fortschritt.

## Aktueller Stand
- [x] **Phase 1 – Fundament & Aufgaben** (Setup, PWA, Deploy-Workflow, Datenmodell/Dexie, Startdaten, Aufgabenverwaltung mit Drag & Drop,
  Tab „Heute“, Gestern/Heute-Abfrage, Tagesabrechnung, XP/Gold/Level, Vitalität, Strafen, Tod, Export/Import, Dev-Menü, Tests). Kampf = Platzhalter.
- [x] **Phase 2 – Kampf** (Phaser-Szene mit Platzhaltergrafik, Parallax je Gebiet, Timer, Krits, Schadenszahlen, Partikel, Rückzug + Hinweis,
  Zwischen-/Gebietsbosse mit Banner, Gebietswechsel, Runde 2 ★, Level-Up-Popup mit Effekt/Sound, Erschöpft im Kampf, Web-Audio-Sounds,
  Kampfwerte im Charakter-Tab, Schema v2, `npm run simulate`, BALANCING.md)
- [x] **Feedback-Runde Phase 2** (v0.2.1, FEEDBACK-PHASE2.md): Schrift Fredoka, größere Anzeigen, Kampfwerte oben links, Ton-Taste,
  größere Figuren (Zoom), HTML-Schadenszahlen, dramatischer Gebietswechsel, neue Treffer-Sounds, Level-Up ohne „Später“,
  VIT statt Herz in der Statusleiste, Timer überall 10 s, XP-Deckel 1000, Gegnerwachstum neu, Szenario „5 verpasst + 2× −“ in der Simulation
- [x] **Feedback-Runde iPhone** (v0.2.2, FEEDBACK-PHASE2.md oben): Animationen bei „Bewegung reduzieren“, Zoom nach Breite (kleinere Figuren),
  Boss unter der Stufenanzeige, Hinweis oben links, „Gebiet n – Name“, schwererer Start (Grund-LP 56, Gebiet ×1,36), iPhone-Breite auch am PC
- [x] **Phase 3 – Grafik** (v0.3.0): LPC-Held mit sichtbarer Ausrüstung (4 Slots × 6 Stufen), alle 56 Gegner mit echten Sprites
  (LPC-Menschen, Skelette, Zombies, Echsen, Orks/Trolle + 20 OGA-Monster, umgefärbt je Gebiet), Animationen Laufen/Angriff/Getroffen/Stand/Rückzug,
  Treffer im Treffer-Frame, 8 neue prozedurale Parallax-Hintergründe, Zoom neu (DPR-genau), Heldenporträt im Charakter-Tab, CREDITS.md.
  **Keine Avatar-Erstellung** (Nutzer: Helm verdeckt Haare, nicht nötig).
- [x] **Feedback-Runde Phase 3**: „Heute“-Abfrage standardmäßig aus (Schema v3), Rückblick nur 1× am Tag in Nacht-Optik, Hydra/Kraken größer
- [x] **Phase 4 – Shop & Ausrüstung** (v0.4.0): Item-Generator mit Namen, Truhen-Shop (Platz wählen, Quoten-Balken), Öffnungsanimation
  (Wackeln → Aufspringen → Lichtstrahl, Legendär mit Strahlenkranz, Sounds), Vergleich grün/rot, Anlegen/Ins Inventar,
  Ausrüstung + Inventar im Charakter-Tab (Detailblatt: anlegen/ablegen/verkaufen), Ausrüstungs-Bonus bei den Attributen, Glanz/Funken bei Episch/Legendär
- [x] **Feedback-Runde Phase 4** (v0.4.1): Boss-Gold + seltene Truhen, feste Item-Werte je Platz + Krit-Chance (Schema v4), Item-Bilder in Materialfarbe,
  Charakter-Tab neu (Attribute oben mit Vorschau), Inventar-Filter + Sortierung, klarere Platzwahl im Shop, Overlays per Portal (iOS),
  Balancing auf 15 Aufgaben + 10 Gewohnheiten (Truhen ×2,5, Boss ×3 / ×2,5, +7 %/Stufe, ×1,44/Gebiet), `npm run simulate` mit Meilensteinen
- [x] **Balancing-Runde** (v0.5.0): Tagesbudget statt Punkte, Quote nach Aufgaben (VIT + Perfekt-Tag-Gold), Gewohnheiten 1×/Tag,
  XP-Kurve 520, Gegner über Ankerpunkte je Gebiet, Boss = 3 Stufen weiter, jede Bosstruhe mit Platzwahl (Schema v5), Drachenschatz,
  Simulation auf 13 Aufgaben + 4/3 Gewohnheiten
- [ ] Phase 5 – Streaks, Haustiere, Erfolge, Statistik, Sounds, Backup-Hinweis, Feinschliff

## Offene Punkte
- v0.5.0 wartet auf Feedback. Abweichungen laut Simulation: Bosse halten ~1,5–2,5 Tage (gewünscht 2–3 / 3–4),
  Wände 2–4 statt 1–2 Tage, Tag 1 endet an Stufe 5 (BALANCING.md „Abgleich“).
- `Backup/` = privater Spielstand des Nutzers: nur lokal, nicht committen (in .gitignore).
- Zeilenenden: Repo speichert LF. Python-Skripte mit `newline=''` lesen/schreiben, sonst entstehen CRLF-Dateien.
- Haustiere kommen in Phase 5 (SPEC §8).
- Sounds: Lautstärke/Häufigkeit der Treffer-Sounds will der Nutzer später noch einmal prüfen.
- Sounds sind prozedural; echte Sounddateien optional in Phase 5.
