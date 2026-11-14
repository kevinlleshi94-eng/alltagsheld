# CLAUDE.md – Kampfszene (`src/battle/`)

Wird geladen, wenn Claude in `src/battle/` arbeitet. Übergreifende Kampfregeln (Belohnungen, Sieg speichern, Pause-Flag,
Gegnerwachstum, iPhone-Maßstab, „Bewegung reduzieren“) stehen in der CLAUDE.md im Projektordner.

## Dateien
```
  BattleView.tsx   React: Canvas-Container + HTML-Anzeigen (Kampfwerte oben links, Stufe, Timer, Ton-Taste oben rechts, Gegnername, Banner, Hinweis, Erschöpft)
  bridge.ts        Stores React ↔ Szene (battleInput / battleHud / battleTimer), ohne Phaser-Import
  game.ts          Phaser.Game (Zoom nach Höhe, DPR-genau: ~270 Spielpixel hoch → am Handy 1 Spielpixel = 1 CSS-px, ResizeObserver) + HTML-Ebene `.battle-fx` für Schadenszahlen; Dev: window.__battle
  BattleScene.ts   Ablauf walkIn → (intro bei Boss) → fight → victory | retreat; Gebietswechsel: exit → Fade → areaHold (Name auf Schwarz) → Held läuft von links ein.
                   Sprites per Promise-Cache (loadSprite), erst Platzhalter, dann Austausch; nächster Gegner wird vorab zusammengesetzt (preloadEnemy)
  backgrounds.ts   prozedurale Hintergründe je Gebiet: Himmel, Wolken, Ferne, Mitte, Boden (Parallax 0,04 / 0,14 / 0,42 / 1), Stile in STYLES
  sprites.ts       Platzhalter-Bitmaps (Held, 8 Gegnerformen) = Ersatz, wenn eine Grafik nicht lädt
  HeroPortrait.tsx Held im Charakter-Tab (gleiche LPC-Teile/Ausrüstung wie im Kampf, Standbild, Glanz bei Episch/Legendär), Ersatz: Platzhalter
  assets/catalog.ts   Asset-Manifest (rein, getestet): LPC-Teile (Ebenen, Material, Farbe), HERO_BASE, GEAR (Slot × Seltenheit → Aussehen),
                      MONSTERS (Frame-Streifen der OGA-Sheets), ENEMY_SPRITES (alle 56 Gegner → LPC-Look oder Monster + Umfärbung)
  assets/compose.ts   Zusammensetzen zur Laufzeit: LPC-Ebenen nach z sortiert + Rampen-Umfärbung; Monster: Chroma-Key + Gradient-Map in Gegnerfarben;
                      Ergebnis = gepacktes Canvas + Animationen (idle/walk/attack/retreat) + Fußpunkt
  assets/palettes.ts  Farbrampen (Metall, Stoff, Haut, Haare) für die Umfärbung
```

## Regeln
- **Texte im Kampf sind HTML**, nie Phaser-Text: Das Canvas rendert in Spielpixeln (Zoom nur per CSS), Text wäre dort unscharf.
- `BattleView` muss den Canvas-Container `.battle-canvas` IMMER rendern (auch ohne Spieler, z. B. beim Zurücksetzen) – das Phaser-Spiel wird nur einmal darin erzeugt.
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
  Zu kleine Monster: `scale` im ENEMY_SPRITES-Eintrag (Hydra ×2, Kraken ×1,5 – Nutzer-Feedback).
