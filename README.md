# Lauras Schach-Akademie

Kindgerechte Schach-Lern-App (Deutsch) mit Coach **Pia**: Rätsel-Themen mit geprüften Aufgaben, Partien gegen **Robi** (eingebaute KI oder Stockfish), Belohnungsspiele, Sticker-Album, Tagesmission, Wiederholung, Familien-Duell, Brett-Designs und druckbare Urkunden.

## Starten

- **Einfach:** `lauras-schach-akademie.html` doppelklicken (läuft offline, Fortschritt wird im Browser gespeichert). Schrift und Regeln stecken in der Datei, es wird nichts nachgeladen.
- **Als App auf dem Handy:** siehe [Als App installieren](#als-app-installieren-android--ios) – eigenes Icon, Vollbild, offline.
- **Mit Stockfish (Stufen 5–8):** Internet reicht – die Engine wird von cdnjs geladen. Ohne Internet spielt Robi mit der eingebauten KI (Suchtiefe 3–4). Als installierte App wird Stockfish nach dem ersten Laden mitgecacht und läuft danach auch offline.
- **Stockfish lokal:** `stockfish.js` (z. B. aus dem npm-Paket `stockfish.js`) nach `engine/stockfish.js` legen und die App über einen kleinen Webserver öffnen (`npx http-server SchachAkademie`), da Browser Worker nicht aus `file://` laden.

## Als App installieren (Android / iOS)

Die gebaute App ist eine PWA: einmal über `https://` geöffnet, lässt sie sich mit
eigenem Icon auf den Startbildschirm legen und läuft danach ohne Internet.

**1. Einmalig hosten**

Zum Installieren muss die App über **`https://`** erreichbar sein – ohne das
startet kein Service Worker, und ohne den gibt es weder Installation noch
Offline-Betrieb. Einzige Ausnahme ist `http://localhost` zum Testen; eine
Adresse im Heimnetz wie `http://192.168.0.5:8080` reicht **nicht**.

*GitHub Pages:* Unter *Settings → Pages* als Quelle **Branch `main`, Ordner
`/ (root)`** wählen. Nach ein bis zwei Minuten liegt die App unter
`https://anamaraf.github.io/SchachAkademie/`.
Achtung: Pages funktioniert bei **privaten** Repositories nur mit einem
kostenpflichtigen Plan (GitHub Pro). Bei einem privaten Repo im Gratis-Plan
also entweder das Repository öffentlich schalten oder einen anderen Hoster
nehmen. Zu wissen ist dabei: Die veröffentlichte Seite ist in beiden Fällen
öffentlich abrufbar, wer die Adresse kennt, sieht die App samt Namen.

*Ohne GitHub:* Jeder Webspace mit HTTPS tut es. Am schnellsten geht
[Netlify Drop](https://app.netlify.com/drop) – Ordner ins Browserfenster ziehen,
fertig. Gebraucht werden nur diese Dateien aus dem Projektstamm:
`index.html`, `manifest.webmanifest`, `sw.js` und `icons/`.

**2. Auf dem Handy installieren**

- **Android (Chrome):** die Adresse öffnen → Menü **⋮** → *App installieren* bzw.
  *Zum Startbildschirm hinzufügen*. Chrome bietet das oft auch von selbst an.
- **iPhone/iPad (Safari):** Teilen-Symbol → *Zum Home-Bildschirm*.

Danach startet die App im Vollbild ohne Adressleiste, mit Bauern-Icon und
violetter Statusleiste. Beim ersten Start lädt sie sich selbst in den Cache;
ab dann funktioniert sie im Flugmodus.

**Aktualisieren:** `node tools/build.js` erzeugt bei jeder Änderung eine neue
Version in `sw.js`. Der Browser merkt das beim nächsten Start, lädt die neue
Fassung und wirft den alten Cache weg – der Fortschritt bleibt erhalten.

## Aufbau

```
SchachAkademie/
├── lauras-schach-akademie.html   gebaute Einzeldatei (alles eingebettet) – diese Datei weitergeben
├── index.html                    dieselbe App unter dem Namen für Webserver/PWA
├── manifest.webmanifest          Name, Farben und Icons der installierten App
├── sw.js                         Service Worker: Cache und Offline-Betrieb
├── icons/                        App-Icons (192/512, maskierbar, Apple)
├── src/
│   ├── index.html            Oberfläche, Manifest-Verweis, Service-Worker-Anmeldung
│   ├── style.css             Design inkl. Brett-Designs, Schrift und Druck-Layout
│   ├── manifest.webmanifest  Quelle des Manifests
│   ├── sw.js                 Quelle des Service Workers (Version setzt der Build ein)
│   ├── fredoka-latin.woff2   Schrift Fredoka (OFL, siehe fredoka-OFL.txt)
│   ├── chess.js              eigene Regel-Engine (chess.js-kompatible API, offline, auch in Node nutzbar)
│   ├── ai.js                 Suche (Alpha-Beta), Endspiel-Solver, Stockfish-Anbindung
│   ├── puzzles.js            alle Rätsel mit Review-Notizen, Lösungen, Fehlererklärungen
│   ├── games.js              Belohnungsspiele: Arkanoid, Auto-Flitzer, Tetris
│   └── app.js                Ablauf, Zustand/Speicherung, Rätsel, Partien, Album, Urkunden …
└── tools/
    ├── build.js          baut App, Manifest und Service Worker:  node tools/build.js
    ├── make-icons.js     erzeugt icons/ neu (nur bei Motivwechsel): node tools/make-icons.js
    ├── verify-puzzles.js prüft alle Rätsel maschinell:            node tools/verify-puzzles.js [--verbose]
    ├── smoke-test.js     Browser-Test der Einzeldatei:            node tools/smoke-test.js [--shots DIR]
    └── pwa-test.js       prüft Installierbarkeit und Offline-Lauf: node tools/pwa-test.js
```

Die beiden gebauten HTML-Dateien sind inhaltsgleich. Wird die Einzeldatei allein
weitergegeben, laufen Manifest- und Icon-Verweise ins Leere – das stört nicht, die
App funktioniert unverändert, nur eben ohne Installation.

## Rätsel-Review

Jedes Rätsel wird von `tools/verify-puzzles.js` geprüft – nicht nur von Hand:

| goalType   | Prüfung |
|------------|---------|
| `mate1`    | Die Lösungsliste muss exakt der Menge **aller** Mattzüge entsprechen. |
| `exact`    | Suche (Tiefe 5, reine Materialbewertung): jede Lösung gewinnt ≥ `minGain`; jeder andere Zug gewinnt deutlich weniger. Bewusst dokumentierte, unterlegene Alternativen (`inferior`) müssen ≥ 1 Bauer schlechter sein. |
| `endgame`  | Retrograde-Solver über alle erreichbaren Stellungen: Lösungsliste = Menge aller Züge, die den Gewinn halten. In der App wird jeder Zug von Laura mit demselben Solver beurteilt; Pia verteidigt optimal. |

Dabei gefundene Fehler der ursprünglichen Aufgaben: „Matt in 1“ Nr. 2 hat **vier** Lösungen (De8# fehlte), bei „Gabel“ Nr. 3 gewannen auch Dc3+/Dh4+ den Turm (Stellung angepasst).

## Spielstärke von Robi

| Stufe | Engine | Einstellung |
|-------|--------|-------------|
| 1–4 | eingebaut | Suchtiefe 1–3, absichtliche Fehler 45 % → 5 % |
| 5 | Stockfish | Tiefe 2, Skill 0, Zufallswahl unter Zügen bis 1,5 Bauern schlechter, 8 % Fehler |
| 6 | Stockfish | Tiefe 5, Skill 3, Fenster 0,6 Bauern, 2 % Fehler |
| 7 | Stockfish | Tiefe 8, Skill 8 |
| 8 | Stockfish | Tiefe 12, Skill 15 |

## Vorlesen

Pia liest ihre Sprechblasen und die Aufgabenerklärung vor – gedacht für Kinder,
die noch nicht flüssig lesen. Der Knopf 🔊 in der Kopfzeile schaltet das ein und
aus, die Einstellung wird mitgespeichert. Ein Tipp auf eine Sprechblase liest
sie noch einmal vor.

Technisch steckt dahinter die Sprachausgabe des Geräts (`speechSynthesis`), es
wird nichts nachgeladen. Auf Android bringt das System deutsche Stimmen mit; die
App wählt bevorzugt eine lokal installierte, damit es auch offline klappt. Fehlt
eine deutsche Stimme, bleibt es still – der Knopf verschwindet dann.

Vorgelesen wird nicht bei jeder Änderung einzeln: Ein `MutationObserver` sammelt,
was sichtbar neu erscheint, und spricht Erklärung und Sprechblase als ein Stück.
Emojis werden vorher entfernt, sonst liest die Stimme „Sternchen“ mit. Beim Laden
verbieten Handy-Browser das Sprechen; die Begrüßung kommt deshalb beim ersten
Antippen.

## Speicherung

Fortschritt liegt im `localStorage` des Browsers. Im Elternbereich lässt sich eine JSON-Sicherung speichern und auf einem anderen Gerät laden.

Der Speicher hängt an der Herkunft der App: Bei der installierten App ist das die
Web-Adresse – Updates und der Wechsel zwischen Browser-Tab und App-Icon behalten
den Fortschritt. Bei der weitergegebenen Einzeldatei hängt er an der Datei selbst;
wird sie verschoben oder umbenannt, fängt die App von vorn an. Vor einem Wechsel
also im Elternbereich eine Sicherung speichern.
