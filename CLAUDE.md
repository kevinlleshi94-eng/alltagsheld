# CLAUDE.md – Alltagsheld

Private Habit-Tracker-PWA (iPhone, Hochformat) im Habitica-Stil mit Fantasy-Auto-Battler.
Echte Aufgaben abhaken → XP/Gold/Vitalität → Held wird stärker. Vollständige Anforderungen: **SPEC.md** (immer zuerst lesen).

## Arbeitsweise (aus SPEC §0)
- In Phasen arbeiten (SPEC §15). Nach jeder Phase: Zusammenfassung + Testanleitung, dann **stoppen** und auf Feedback warten.
- **Alle** Spielwerte nur in `src/game/balance.ts`.
- Spiellogik bleibt rein (keine UI/DB-Imports in `src/game/`), mit Unit-Tests.
- UI-Sprache Deutsch; Code/Kommentare Englisch.
- Annahmen bei Unklarheiten treffen und im Phasen-Abschluss auflisten.
- Diese Datei aktuell halten (Stand, Befehle, Struktur).

## Tech-Stack
TypeScript 7 · Vite 8 · React 19 · Dexie 4 (IndexedDB) + dexie-react-hooks · vite-plugin-pwa 2 (Workbox, `registerType: 'prompt'`) ·
@dnd-kit (Sortieren) · @fontsource/fredoka (Schrift, CSS-Variable `--display`, Klasse `.display`) · Vitest 5 (+ fake-indexeddb für DB-Tests) · tsx (Skripte).
Phaser 3.90 für die Kampfszene (per `import('./game')` nachgeladen, eigener ~1,2-MB-Chunk, vom Service Worker vorab gecacht).

## Befehle
| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Port 5173; `.claude/launch.json` → Name `dev`) |
| `npm.cmd run dev -- --host` | Dev-Server im Heimnetz fürs iPhone (PC: 192.168.178.23, Ethernet, Netzprofil „Öffentlich“; Firewall-Regel für node.exe erlaubt eingehend) |
| `npm test` | alle Unit-Tests (`src/**/*.test.ts`) |
| `npm run typecheck` | nur Typprüfung |
| `npm run build` | Typprüfung + Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal mit Service Worker testen |
| `npm run icons` | PNG-Icons in `public/` neu erzeugen |
| `npm run simulate` | Balancing-Simulation (`--days=180 --seeds=7 --markdown`), Ergebnis → BALANCING.md |
| `node scripts/fetch-lpc.mjs` | LPC-Ebenen + Definitionen nachladen (nur fehlende Dateien; neue Downloads vorher mit dem Nutzer absprechen) |
| Deploy | Push auf `main` → GitHub Actions (`.github/workflows/deploy.yml`) → GitHub Pages. `BASE_PATH=/<repo>/` wird im Workflow gesetzt. |

## Projektstruktur
```
src/game/        reine Logik + Tests
  balance.ts       ALLE Zahlenwerte (Belohnung, XP-Kurve, Vitalität, Strafen, Tod, Timer, Kampf, Gegnerwachstum, Truhen, Simulation)
  types.ts         Domänentypen (Task, DayLog, Player, Item, Settings, GameEvent, LogicContext …)
  dates.ts         Datums-Keys YYYY-MM-DD (lokale Mitternacht), DST-sichere Arithmetik
  progression.ts   XP/Level, Attributpunkte (Reihenfolge in attributeHistory)
  resources.ts     applyDelta(): EINZIGE Stelle, die XP/Gold/Vitalität ändert (Level-Up/-Down, Gold ≥ 0, Vitalität ≤ max, Tod)
  death.ts         Todesfolgen (einzeln abschaltbar in balance.death)
  taskActions.ts   Daily abhaken/zurücknehmen, Habit +/−, Undo letzter Tipp
  settlement.ts    Tagesabrechnung (pendingDays, settle) inkl. Review-Eingaben „Gestern“
  selectors.ts     Listen für „Heute“ (offene zuerst, erledigte unten)
  combat.ts        Heldenwerte, Stufen-Index/Gegner je Stufe, Kampf-Engine (stepFight: pro Frame ODER komplett), applyVictory, wallIndex
  items.ts         Truhen-Seltenheit + Itemwerte (für Simulation; Shop-UI in Phase 4)
  simulation.ts    Balancing-Simulation mit echten Spielfunktionen (scripts/simulate.ts)
  world.ts         8 Gebiete: Namen, Paletten, Gegner (Archetyp + Platzhalter-Form/Farben), Zwischen-/Gebietsbosse
  seed.ts, rng.ts, testUtils.ts (TEST_BALANCE: fixe XP-Kurve, damit Mechanik-Tests nicht vom Tuning abhängen)
src/battle/      Kampfszene
  BattleView.tsx   React: Canvas-Container + HTML-Anzeigen (Kampfwerte oben links, Stufe, Timer, Ton-Taste oben rechts, Gegnername, Banner, Hinweis, Erschöpft)
  bridge.ts        Stores React ↔ Szene (battleInput / battleHud / battleTimer), ohne Phaser-Import
  game.ts          Phaser.Game (Zoom nach Höhe, DPR-genau: ~270 Spielpixel hoch → am Handy 1 Spielpixel = 1 CSS-px, ResizeObserver) + HTML-Ebene `.battle-fx` für Schadenszahlen; Dev: window.__battle
  BattleScene.ts   Ablauf walkIn → (intro bei Boss) → fight → victory | retreat; Gebietswechsel: exit → Fade → areaHold (Name auf Schwarz) → Held läuft von links ein.
                   Sprites per Promise-Cache (loadSprite), erst Platzhalter, dann Austausch; nächster Gegner wird vorab zusammengesetzt (preloadEnemy)
  backgrounds.ts   prozedurale Hintergründe je Gebiet: Himmel, Wolken, Ferne, Mitte, Boden (Parallax 0,04 / 0,14 / 0,42 / 1), Stile in STYLES
  sprites.ts       Platzhalter-Bitmaps (Held, 8 Gegnerformen) = Ersatz, wenn eine Grafik nicht lädt
  HeroPortrait.tsx Held im Charakter-Tab (gleiche LPC-Teile/Ausrüstung wie im Kampf, Standbild), Ersatz: Platzhalter
  assets/catalog.ts   Asset-Manifest (rein, getestet): LPC-Teile (Ebenen, Material, Farbe), HERO_BASE, GEAR (Slot × Seltenheit → Aussehen),
                      MONSTERS (Frame-Streifen der OGA-Sheets), ENEMY_SPRITES (alle 56 Gegner → LPC-Look oder Monster + Umfärbung)
  assets/compose.ts   Zusammensetzen zur Laufzeit: LPC-Ebenen nach z sortiert + Rampen-Umfärbung; Monster: Chroma-Key + Gradient-Map in Gegnerfarben;
                      Ergebnis = gepacktes Canvas + Animationen (idle/walk/attack/retreat) + Fußpunkt
  assets/palettes.ts  Farbrampen (Metall, Stoff, Haut, Haare) für die Umfärbung
public/assets/   lpc/spritesheets/ (LPC-Generator-Ebenen, nur walk + slash), monsters/ (OGA-Sheets). Workbox cacht ALLE PNGs vorab → ungenutzte löschen
assets-src/      Quellen: lpc/sheet_definitions (Credits je Ebene), oga/ (Original-Downloads); nicht im Build
src/audio/sfx.ts Web-Audio-Soundeffekte (iOS-Unlock beim ersten Tippen, Lautstärke/An-Aus aus Einstellungen)
src/db/          Dexie-Schema (db.ts, SCHEMA_VERSION), repo.ts (Aktionen in Transaktionen), backup.ts (Export/Import), migrations.ts
src/lib/clock.ts Spieluhr mit Dev-Versatz – IMMER clock.now() statt Date.now() für Spielzeit
src/state/       Mini-Stores (store.ts), ui.ts (Event-Queue, Flow-Phase, Floating-Texte, Toasts, Tab), hooks.ts (Live-Queries, useToday), actions.ts
src/flow/        flowLogic.ts (Ablauf beim Öffnen) + FlowController, ReviewDialog, SummaryDialog, TodayPrompt, EventPresenter (Level-Up, Tod)
src/screens/     TodayScreen, ManageTasksScreen, SettingsScreen (+ DevMenu), MoreScreen, PlaceholderScreens (Charakter, Shop, Statistik)
src/ui/          Sheet/Modal (+ effect-Ebene), Confirm, controls, layout (Statusleiste, Tab-Leiste), PixelIcon/PixelSprite, labels.ts, combatText.ts
scripts/         generate-icons.mjs, simulate.ts
```

## Wichtige Designentscheidungen
- **Belohnungen werden sofort beim Abhaken angewendet**; DayLog speichert die *tatsächlich* angewendeten Werte (`reward`, `taps[].applied`, `penalty`).
  Zurücknehmen kehrt genau diese Werte um (inkl. Level-Down + Entfernen des letzten Attributpunkts).
  Belohnungen von *vor* dem letzten Tod (`player.lastDeathAt`) werden nicht zurückgenommen.
- **Tagesabrechnung** (`settle`): Tage chronologisch; ältere Tage = „nichts weiter erledigt“ (bereits abgehakte bleiben erledigt);
  Review-Eingaben für gestern werden *vor* den Strafen von gestern angewendet; max. 1 Tod pro Lauf, danach keine Verluste mehr.
  Erzeugt für jede aktive tägliche Aufgabe einen DayLog-Eintrag (lückenloses Log). Archivierte/später erstellte Aufgaben zählen nicht.
- **Rückblick-Dialog ist ein Entwurf**: erst „Fertig“ übernimmt; Wegwischen/✕ = nichts weiter erledigt. Die „Heute“-Abfrage wirkt sofort.
- Flow: `boot → review → summary → todayPrompt → main`. Todesbildschirm erscheint ab `todayPrompt`, andere Popups nur in `main`.
  Trigger: Kaltstart, Rückkehr aus Hintergrund (≥ `balance.app.todayPromptMinHiddenMs` → mit „Heute“-Abfrage), Minuten-Check auf Mitternacht, Dev-Uhr.
- Ereignis-Warteschlange ist nur im Speicher (nicht persistent); unverteilte Punkte bleiben trotzdem im Spieler gespeichert (Badge).
- Datenbank-Schema ändern: neue `this.version(N)` in `db.ts` + `SCHEMA_VERSION` erhöhen + Schritt in `migrateSnapshot` (alte Backups).
- Dev-Menü: 5× auf die Versionsnummer in den Einstellungen tippen (Status in localStorage `alltagsheld.devMenu`).
  Vorspulen ist absichtlich nicht umkehrbar (sonst wären „heutige“ Logs schon abgerechnet).
- **Kampf**: Kämpfe geben keine Belohnung, nur Stufenfortschritt. Ein Sieg wird sofort per `repo.recordVictory(pos)` gespeichert
  (rückt nur vor, wenn der Held noch dort steht). Die Szene unterscheidet eigene Siege von Positionswechseln von außen (Tod, Dev-Menü)
  über `expected`/`prevInputPos`; Wechsel von außen → Fade zur neuen Stufe. Heldenwerte gelten ab dem nächsten Kampf.
  Pause (Flow ≠ main oder Popup in der Queue) über eigenes `paused`-Flag – NICHT `scene.pause()` (bleibt hängen, wenn während create() aufgerufen).
- **Gegnerwachstum** (BALANCING.md): Grund-LP 56 (Straße 1), Sägezahn – +4 %/Stufe innerhalb eines Gebiets, Grundstärke je Gebiet ×1,36 LP / ×1,12 Schaden.
  Start (iPhone-Feedback): neuer Held schafft höchstens Stufe 9, Boss 10 braucht 1–2 Level-Ups (Unit-Tests in combat.test.ts).
  Alle Kampf-Timer 10 s (Nutzer-Feedback, weicht von SPEC 15/20 s ab), Bosse ×2 LP, Gebietsbosse ×3 LP. XP pro Level max. 1000 (Level-Up alle 4–5 Tage).
  Stufen-Index = (Runde−1)·200 + (Gebiet−1)·25 + (Stufe−1). Bosse ×2 Sprite-Größe (gedeckelt auf 46 % der Szenenhöhe, mind. ×1,2).
- **Texte im Kampf sind HTML**, nie Phaser-Text: Das Canvas rendert in Spielpixeln (Zoom nur per CSS), Text wäre dort unscharf.
- **iPhone ist der Maßstab** (Nutzer-Feedback): App max. 430 px breit, am PC mittig wie ein iPhone; Kampfhöhe `min(36dvh, 304px)`.
  Bosse ×2, aber nie über Stufenanzeige/Timer (`HUD_CLEAR_PX` in BattleScene). Handy quer → Hinweis „hochkant halten“ (nur CSS).
  Hinweis „Erledige Aufgaben …“ oben links unter den Kampfwerten, nicht in der Mitte.
- **„Bewegung reduzieren“ (iOS)**: Die globale Regel kürzt alle Animationen auf 0,01 ms. Spiel-Feedback (Floats, Schadenszahlen,
  Banner, Level-Up) hat im selben Media-Block eigene Fade-Varianten (`rm-*`). Neue Feedback-Animationen dort ergänzen, sonst sind sie unsichtbar.
- **Stufen-Beschriftung**: „Gebiet 2 – Wald · Stufe 5/25“ (`areaLabel`/`formatStage` in world.ts). Kein „LV“, das ist das Helden-Level.
- `BattleView` muss den Canvas-Container `.battle-canvas` IMMER rendern (auch ohne Spieler, z. B. beim Zurücksetzen) – das Phaser-Spiel wird nur einmal darin erzeugt.
- **Level-Up**: Punkt muss im Popup sofort verteilt werden (kein „Später“, Nutzer-Feedback). Alte unverteilte Punkte bleiben im Charakter-Tab verteilbar.
- **Vitalität ≠ Leben**: Statusleiste zeigt „VIT“ (Alltagsenergie), das Herz steht nur noch für Lebenspunkte im Kampf.
- **Strafe verpasste Aufgabe** = Punkte × 1,5 (Nutzerentscheidung, SPEC angepasst): Szenario „5 verpasst + 2× −“ → 9 Tode/Halbjahr
  (Unit-Test in simulation.test.ts). Nebenwirkung: 75 % stirbt nie, 50 % kommt bis Sumpf. Rundung pro Tag in settlement.ts.
- **Ausrüstung** zählt als zusätzliche Attributpunkte (`effectiveAttributes`). Player.progress (Schema v2): besiegte Gegner/Bosse/Drachen, weiteste Stufe.
- **Grafik (Phase 3)**: Keine fertigen Spritesheets im Repo, sondern Zusammensetzen zur Laufzeit (`assets/compose.ts`):
  Held + menschliche Gegner aus LPC-Ebenen (Körper, Kopf, Kleidung, Rüstung, Helm, Waffe, Schild), umgefärbt über exakte 6-Farben-Rampen
  (`palettes.ts`); Tiere/Monster aus OGA-Sheets, per Gradient-Map in die Gegnerfarben aus world.ts (Kontur bleibt). LPC-Reihe 1 = links, 3 = rechts;
  walk 9 Frames (Frame 0 = Stand), slash 6. Fußpunkt LPC = Framemitte + 30 px.
- **Nie abstürzen**: Jede Figur startet als Platzhalter und wird ausgetauscht, sobald sie fertig ist; Fehler → Platzhalter bleibt, nächster Versuch beim nächsten Auftritt.
- **Ausrüstung sichtbar**: `GEAR` (Slot × Seltenheit) in catalog.ts; Test sichert, dass jede Seltenheit je Slot anders aussieht.
  Muskulöser LPC-Körper hat keine Hemden/Rüstungen → nur Helme/Hosen (Test). Legendäre Waffe = goldenes Langschwert (Farbtabelle `GOLD_BLADE`).
- **Treffer-Timing**: Angriffsanimation startet sofort, Schaden/Blitz/Zahl erst im Treffer-Frame (Vorlauf ≤ 0,24 s, Ereignisse in `pending`).
  Nach `fight.result` nicht mehr `stepFight` aufrufen (sendet sonst erneut 'end').
- **Neue Gegner/Teile**: Eintrag in catalog.ts genügt (Tests prüfen Dateien, Bildmaße, Frames im Bild, alle Gegner gemappt). Credits in CREDITS.md ergänzen.

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
- [ ] Phase 4 – Shop & Ausrüstung
- [ ] Phase 5 – Streaks, Haustiere, Erfolge, Statistik, Sounds, Backup-Hinweis, Feinschliff

## Offene Punkte
- Phase 3 wartet auf iPhone-Feedback (Figurengröße, Gegnerwahl, Hintergründe).
- Phase 4: Items brauchen nur `slot` + `rarity`, dann erscheinen sie automatisch am Helden (Kampf + Charakter-Tab).
- Sounds: Lautstärke/Häufigkeit der Treffer-Sounds will der Nutzer später noch einmal prüfen.
- Sounds sind prozedural; echte Sounddateien optional in Phase 5.
