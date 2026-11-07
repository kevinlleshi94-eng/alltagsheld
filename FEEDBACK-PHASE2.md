# Feedback Phase 2 – Kampf

## iPhone-Test (Version 0.2.2)

| Dein Hinweis | Ursache | Stand |
|---|---|---|
| Keine Gold-/XP-Animation beim Abhaken, keine Schadenszahlen, Level-Up ohne Effekt | Auf deinem iPhone ist vermutlich „Bewegung reduzieren“ an. Die App hat dann alle Animationen auf null gekürzt, die Texte waren sofort wieder unsichtbar. | ✅ Mit „Bewegung reduzieren“ werden die Texte jetzt sanft ein- und ausgeblendet statt zu fliegen. Ohne die Einstellung ist alles wie vorher. |
| Figuren zu groß, Boss verdeckt die Stufe | Die Szene war auf dem iPhone nur 78 Spielpixel breit | ✅ Zoom richtet sich nach der Breite: 130 Spielpixel, Figuren ca. 40 % kleiner. Bosse bleiben immer unter Stufe und Timer |
| Hinweis „stärker werden“ mitten im Kampf | – | ✅ Oben links unter den Kampfwerten |
| Am Anfang zu stark | 1 Attributpunkt reichte für den ersten Boss, danach ging es sofort bis Stufe 20 | ✅ Neuer Held kommt höchstens bis Stufe 9. Den Boss auf Stufe 10 schafft man erst nach den ersten Level-Ups. Nach einer Woche (90 %) steht man am Gebietsboss der Straße. Drache weiter bei Tag ~165 |
| Bessere Beschreibung der Stufen | – | ✅ „Gebiet 1 – Straße“ und darunter „Stufe 1/25“, auch im Charakter-Tab und beim Tod. „Gebiet“ statt „LV“, damit es nicht mit dem Helden-Level (Lv) verwechselt wird |
| Für das iPhone passend | – | ✅ Die App ist überall höchstens so breit wie ein iPhone, auch am PC (mittig). Quer gehalten erscheint „Bitte das iPhone hochkant halten“ |

**Bitte prüfen:**
- [ ] Ist bei dir „Bewegung reduzieren“ an? (Einstellungen → Bedienungshilfen → Bewegung) Siehst du jetzt XP/Gold beim Abhaken und die Schadenszahlen? →
- [ ] Passt die Größe von Held und Gegner jetzt? →
- [ ] Fühlt sich der Start jetzt richtig an (neuer Spielstand: Stufe 9, dann ist Schluss)? →

---

## Umsetzung deines Feedbacks (Version 0.2.1)

| Punkt | Dein Wunsch | Stand |
|---|---|---|
| Allgemein, E5 | Ton-Taste oben, ein Schalter für alle Sounds | ✅ Lautsprecher-Taste oben rechts im Kampf |
| A3, I2 | Level-Ups später seltener, nach 6 Monaten Endboss | ✅ Level 3 am 1. Tag, ab Level 8 alle 4–5 Tage. Drache bei 90 % an Tag ~165 |
| B2 | Held und Gegner größer | ✅ Figuren ca. ein Drittel größer. Ausrüstung erkennbar erst mit den neuen Grafiken (Phase 3) |
| B4 | Lesbarere Schrift, Anzeigen lesbar | ✅ Neue Schrift „Fredoka“, größere Anzeigen mit Kontur, Schadenszahlen gestochen scharf |
| B6, L1 | Bessere Grafik für Held und Gegner | ⏳ Phase 3 |
| C3 | Höchstens 10 s pro Kampf | ✅ Auch Bosse und Gebietsbosse: 10 s |
| D5 | Gebietswechsel länger und dramatischer | ✅ „Gebiet geschafft!“, Held läuft aus dem Bild, Name des neuen Gebiets auf Schwarz, Held läuft ein |
| E4 | Treffer sollen anders klingen | ✅ Neue Schwert-Sounds (Treffer, Krit, Getroffen), leicht variierend |
| F3 | Leben soll die Lebenspunkte erhöhen | ✅ Tat es schon (+15 LP im Kampf). Jetzt sichtbar oben links (Herz) und klarer beschriftet |
| F4 | Punkte direkt verteilen | ✅ Kein „Später verteilen“ mehr |
| H1 | Vitalität nicht mit Leben verwechseln, Werte oben links | ✅ Statusleiste zeigt „VIT“, Kampfwerte oben links im Kampf |
| I1 | Szenario durchrechnen, ca. 8 Tode | ✅ Strafe auf 1,5 gesenkt (deine Entscheidung): 9 Tode im halben Jahr, siehe [BALANCING.md](BALANCING.md) → „Dein Szenario“ |
| L2 | Keine Avatar-Erstellung | ✅ Fällt in Phase 3 weg |

---

Hake ab, was du geprüft hast, und schreib deine Antwort hinter „→“.
Kurze Antworten reichen, z. B. „passt“, „zu schnell“ oder „stört“.
Du musst nicht alles beantworten. Wichtig sind vor allem die Abschnitte **A**, **I** und **K**.

**Hilfen zum Testen**
- **Dev-Menü:** Einstellungen → 5× auf die Versionsnummer tippen.
  Dort kannst du die Stufe setzen, XP/Gold dazugeben und die Vitalität ändern.
- **Ton:** einmal irgendwo hintippen, dann geht er an.

---

## A. Allgemein
- [ ] A1. Lädt die App ohne Probleme, und erscheint die Kampfszene nach kurzer Zeit? → 
- [ ] A2. Läuft der Kampf flüssig, oder ruckelt etwas? Bitte Gerät und Browser angeben. → 
- [ ] A3. Wie ist dein Gesamteindruck? Macht es Lust, Aufgaben zu erledigen? → 

## B. Aussehen der Kampfszene
- [ ] B1. Passt die Höhe des Kampfbereichs (gut ein Drittel des Bildschirms)? Oder lieber größer bzw. kleiner? → 
- [ ] B2. Sind Held und Gegner gut erkennbar? Oder lieber größer bzw. kleiner? → 
- [ ] B3. Sehen die Hintergründe der Gebiete stimmig aus? Gefällt dir eines gar nicht? → 
      (Stufe im Dev-Menü auf andere Gebiete setzen: 1 Straße, 2 Wald, 3 Dunkler Wald, 4 Sumpf, 5 Wüste, 6 Strand, 7 Schnee, 8 Vulkan)
- [ ] B4. Sind diese Anzeigen gut lesbar? → 
      Stufenanzeige oben, Timer, Gegnername unten rechts, Schadenszahlen, Lebensbalken
- [ ] B5. Verdeckt eine Anzeige etwas Wichtiges, oder wirkt es oben zu voll? → 
- [ ] B6. Hinweis: Die Grafiken sind Platzhalter, echte Sprites kommen in Phase 3. Ist das für jetzt okay? → 

## C. Kampftempo
- [ ] C1. Passt die Zeit, bis der Gegner beim Helden ankommt (knapp 2 Sekunden)? → 
- [ ] C2. Passt der Angriffstakt beider Seiten? Wirkt es zu hektisch oder zu träge? → 
- [ ] C3. Passen die Timer: 10 s normal, 15 s für Bosse, 20 s für Gebietsbosse? → 
- [ ] C4. Sind kritische Treffer auffällig genug (gelb, größer, Bildschirm wackelt)? Wackelt es zu viel? → 

## D. Ablauf
- [ ] D1. Wirkt der Übergang von einem Sieg zum nächsten Gegner flüssig? → 
- [ ] D2. Niederlage: Ist klar, was passiert (Held zieht sich zurück, Bild blendet ab, Neustart)? → 
      (Zum Testen: im Dev-Menü Gebiet 2, Stufe 25 setzen)
- [ ] D3. Ist der Hinweis „Erledige Aufgaben, um stärker zu werden.“ nach 3 Fehlversuchen dezent genug? Passt die Position? → 
- [ ] D4. Boss-Banner (Stufe 10, 20, 25): Wie gefallen dir Optik und Dauer (2 s)? → 
      (Gebiet 1, Stufe 9 setzen)
- [ ] D5. Gebietswechsel (Überblenden plus Name des neuen Gebiets): Gefällt dir das? → 
- [ ] D6. Der Kampf pausiert bei Dialogen (Rückblick, „Heute“, Level-Up, Tod). Ist das richtig so? → 
- [ ] D7. Soll der Kampf beim Verwalten der Aufgaben oder in den Einstellungen weiterlaufen (so ist es jetzt)? Oder auch dort pausieren? → 

## E. Sounds
- [ ] E1. Hörst du nach dem ersten Tippen die Sounds? Funktioniert auch der Regler in den Einstellungen? → 
- [ ] E2. Wie findest du die Lautstärke im Verhältnis zueinander? → 
- [ ] E3. Nerven die Treffer-Sounds auf Dauer, weil sie fast jede Sekunde kommen? → 
- [ ] E4. Gibt es einen Sound, der dir gar nicht gefällt? → 
      Treffer, Krit, Getroffen, Gegner besiegt, Boss, Niederlage, Gebiet geschafft, Level-Up, Tod
- [ ] E5. Hättest du gern einen eigenen Schalter „Kampfsounds aus“, damit nur Level-Up und Tod zu hören sind? → 

## F. Level-Up
- [ ] F1. Wie wirkt der Effekt (Lichtstrahlen, Funken, Aufploppen): zu viel, zu wenig oder passend? → 
      (Dev-Menü: XP dazugeben)
- [ ] F2. Passt der Level-Up-Sound? → 
- [ ] F3. Sind die Angaben je Attribut verständlich, z. B. „+3 Schaden pro Treffer“ oder „Angriff alle 1,20 s → 1,13 s“? → 
- [ ] F4. Ist „Später verteilen“ mit Badge an „Lv“ und am Charakter-Tab okay? → 

## G. Erschöpft (Vitalität unter 30 %)
- [ ] G1. Wie wirkt die Darstellung (pulsierender roter Rand, grauer Held, Schriftzug)? Zu aufdringlich oder zu schwach? → 
      (Dev-Menü: Vitalität auf 20 setzen)

## H. Charakter-Tab
- [ ] H1. Sind die Kampfwerte verständlich? → 
      Lebenspunkte, Schaden, Angriffsintervall, Krit, Schaden pro Sekunde
- [ ] H2. Fehlt dir eine Angabe, oder ist eine überflüssig? → 
      Fortschritt: weiteste Stufe, besiegte Gegner, Bosse

## I. Balancing – Entscheidungen (wichtig)
- [ ] I1. **Strafe für verpasste Aufgaben:** bei **3** lassen (SPEC) oder auf **3,5** erhöhen? → 
      - Bei 3 kommt jemand mit 75 % Erfüllung in 6 Monaten bis „Schnee“ (Gebiet 7) und stirbt fast nie.
      - Bei 3,5 kommt er bis „Strand“ (Gebiet 6, SPEC-Ziel), stirbt dafür etwa 8-mal im halben Jahr.
      - Bei 50 % Erfüllung gibt es in beiden Fällen sehr viele Tode (ca. 38 bzw. 47 in 6 Monaten). Ist das zu hart? → 
- [ ] I2. **Level-Tempo:** Level 3 am ersten Tag, ca. Level 5 nach einer Woche, ca. 10 nach einem Monat, ca. 20 nach einem halben Jahr (bei 90 %). Passt das? → 
- [ ] I3. **Drache** bei 90 % nach etwa 5,5 Monaten: Ist das okay? → 
- [ ] I4. Ein neuer Held kommt ohne Fortschritt bis Stufe 9, der Boss auf Stufe 10 stoppt ihn. Passt dir die erste „Wand“? → 
- [ ] I5. Die großen Hürden sind meist die **Gebietsbosse** (Stufe 25). Man hängt dort oft länger. Okay, oder lieber gleichmäßiger? → 
- [ ] I6. Kämpfe geben **keine** Belohnung, nur Stufenfortschritt. XP und Gold kommen nur aus Aufgaben. So lassen, oder sollen Siege ein wenig Gold geben? → 

## J. Annahmen bestätigen
- [ ] J1. Neue Werte (Level-Up, Erschöpfung) gelten erst ab dem **nächsten** Kampf, nicht mitten im laufenden. Okay? → 
- [ ] J2. Bosse werden doppelt so groß dargestellt. Okay? → 
- [ ] J3. Phaser 3 statt Phaser 4 als Spiel-Engine. Ist dir das egal? → 

## K. Fehler
- [ ] K1. Ist etwas hängen geblieben, gesprungen oder falsch angezeigt worden? Zum Beispiel: → 
      - falsche Stufe oben gegenüber dem gezeigten Gegner
      - Szene friert ein
      - Popup kommt nicht
      Bitte kurz beschreiben, **was du vorher gemacht hast**.
- [ ] K2. Auffälligkeiten auf dem iPhone, falls schon getestet? → 
      Ton, Notch/Statusleiste, Drehen, App im Hintergrund und zurück

## L. Ausblick Phase 3 (Grafik & Avatar)
- [ ] L1. Laut SPEC kommen die Sprites aus dem LPC-Baukasten, also eher „klassische RPG-Pixelart“. Passt dir der Stil, oder hast du ein Vorbild? → 
- [ ] L2. Wünsche für die Avatar-Erstellung über Name, Körpertyp, Hautfarbe, Frisur und Haarfarbe hinaus? → 
- [ ] L3. Sonst noch etwas, das dir wichtig ist? → 
