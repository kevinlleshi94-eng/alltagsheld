# Alltagsheld

Private Habit-Tracking-App mit Fantasy-Auto-Battler. Echte Aufgaben erledigen → abhaken → XP & Gold → der Held wird stärker.
Läuft als PWA auf dem iPhone, alle Daten bleiben lokal auf dem Gerät.

> Aktueller Stand: **Phase 3 – Grafik** (Version 0.3.0). Aufgaben, Abrechnung und Auto-Battler laufen, Held und Gegner haben echte Pixel-Sprites (LPC / OpenGameArt, siehe CREDITS.md). Shop & Ausrüstung folgen in Phase 4.

---

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 22.

```bash
npm install
npm run dev
```

Dann <http://localhost:5173> im Browser öffnen. Tipp: In den Entwicklertools die iPhone-Ansicht aktivieren.

**Auf dem iPhone im Heimnetz testen:** `npm run dev -- --host` starten (unter Windows `npm.cmd`).
Vite zeigt eine „Network“-Adresse wie `http://192.168.x.x:5173`. Diese in Safari auf dem iPhone öffnen (gleiches WLAN, kein Gäste-WLAN).
Ohne HTTPS gibt es dort keinen Offline-Modus und keine echte App-Installation. Dafür ist die Veröffentlichung auf GitHub Pages da (siehe unten).

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm test` | Unit-Tests (Vitest) |
| `npm run build` | Produktions-Build nach `dist/` (inkl. Typprüfung) |
| `npm run preview` | Build lokal ansehen (inkl. Service Worker) |
| `npm run icons` | App-Icons neu erzeugen |
| `npm run simulate` | Balancing-Simulation (siehe [BALANCING.md](BALANCING.md)) |

---

## Veröffentlichen auf GitHub Pages (Schritt für Schritt)

GitHub Pages ist kostenlos und liefert HTTPS – das braucht das iPhone, um die App installieren zu können.

### 1. Repository anlegen

1. Auf <https://github.com> einloggen (oder kostenlos registrieren).
2. Oben rechts **+ → New repository**.
3. Name z. B. `alltagsheld`, Sichtbarkeit **Public** (GitHub Pages ist für private Repos nur mit bezahltem Plan verfügbar).
   Hinweis: Der *Code* ist dann öffentlich sichtbar, deine *Spieldaten* aber nicht – die liegen nur auf deinem iPhone.
4. **Keine** README/.gitignore/Lizenz hinzufügen → **Create repository**.

### 2. Code hochladen

Im Projektordner (PowerShell oder Terminal) – `DEIN-NAME` durch deinen GitHub-Benutzernamen ersetzen:

```bash
git init
git add .
git commit -m "Phase 1"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/alltagsheld.git
git push -u origin main
```

Beim ersten Push fragt Git nach der Anmeldung – im Browserfenster bei GitHub bestätigen.

### 3. GitHub Pages einschalten

1. Im Repository: **Settings → Pages**.
2. Bei **Source** „**GitHub Actions**“ auswählen. Fertig – mehr ist nicht nötig.
3. Unter **Actions** siehst du den Lauf „Deploy to GitHub Pages“. Falls er vor dem Umschalten schon fehlgeschlagen ist: den Lauf öffnen → **Re-run all jobs**.
4. Nach 1–2 Minuten ist die App erreichbar unter
   `https://DEIN-NAME.github.io/alltagsheld/`

Jeder weitere `git push` auf `main` testet, baut und veröffentlicht automatisch neu.

### 4. Auf dem iPhone installieren

1. Die Adresse `https://DEIN-NAME.github.io/alltagsheld/` in **Safari** öffnen (nicht Chrome – nur Safari kann installieren).
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen.
3. **„Zum Home-Bildschirm“** wählen → **Hinzufügen**.
4. Die App ab jetzt über das Icon starten: Sie läuft im Vollbild ohne Browserleiste und funktioniert auch offline.

**Updates:** Wenn eine neue Version veröffentlicht wurde, erscheint oben „Neue Version verfügbar → Aktualisieren“.
Der Spielstand bleibt dabei erhalten.

**Wichtig – Datensicherung:** Die Daten liegen nur auf dem iPhone. Wenn du die App vom Home-Bildschirm löschst,
sind sie weg. Mach deshalb regelmäßig unter **Mehr → Einstellungen → Backup exportieren** eine Sicherung
(z. B. in „Dateien“ / iCloud Drive). Über **Backup importieren** holst du sie zurück – auch auf ein neues Gerät.

---

## Projektstruktur (Kurzfassung)

```
src/game/      reine Spiellogik (ohne UI) + Unit-Tests, alle Spielwerte in balance.ts
src/battle/    Kampfszene (Phaser), Sprites zusammensetzen (assets/), Hintergründe, HTML-Anzeigen
src/audio/     Soundeffekte (Web Audio, ohne Dateien)
src/db/        IndexedDB (Dexie), Aktionen, Backup/Import, Migrationen
src/flow/      Ablauf beim Öffnen: Rückblick „Gestern“, Abrechnung, „Heute“, Popups, Tod
src/screens/   Bildschirme (Heute, Charakter, Shop, Statistik, Mehr …)
src/ui/        wiederverwendbare Bausteine (Sheet, Buttons, Pixel-Icons …)
src/state/     kleine Stores (Ereignis-Warteschlange, Navigation, Toasts) und Hooks
```

Details für die Weiterentwicklung: siehe [CLAUDE.md](CLAUDE.md). Quellen und Lizenzen: [CREDITS.md](CREDITS.md).
