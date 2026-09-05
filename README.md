# Lauras Schach-Akademie

Kindgerechte Schach-Lern-App (Deutsch) mit Coach **Pia**: Rätsel-Themen mit geprüften Aufgaben, Partien gegen **Robi** (eingebaute KI oder Stockfish), Belohnungsspiele, Sticker-Album, Tagesmission, Wiederholung, Familien-Duell, Brett-Designs und druckbare Urkunden.

## Starten

- **Einfach:** `lauras-schach-akademie.html` doppelklicken (läuft offline, Fortschritt wird im Browser gespeichert).
- **Mit Stockfish (Stufen 5–8):** Internet reicht – die Engine wird von cdnjs geladen. Ohne Internet spielt Robi automatisch mit der eingebauten KI (Suchtiefe 3–4).
- **Stockfish lokal/offline:** `stockfish.js` (z. B. aus dem npm-Paket `stockfish.js`) nach `engine/stockfish.js` legen und die App über einen kleinen Webserver öffnen (`npx http-server SchachAkademie`), da Browser Worker nicht aus `file://` laden.

## Aufbau

```
SchachAkademie/
├── lauras-schach-akademie.html   gebaute Einzeldatei (alles eingebettet) – diese Datei weitergeben
├── src/
│   ├── index.html   Oberfläche
│   ├── style.css    Design inkl. freischaltbarer Brett-Designs und Druck-Layout
│   ├── chess.js     eigene Regel-Engine (chess.js-kompatible API, offline, auch in Node nutzbar)
│   ├── ai.js        Suche (Alpha-Beta), Endspiel-Solver, Stockfish-Anbindung
│   ├── puzzles.js   alle Rätsel mit Review-Notizen, Lösungen, Fehlererklärungen
│   ├── games.js     Belohnungsspiele: Arkanoid, Auto-Flitzer, Tetris
│   └── app.js       Ablauf, Zustand/Speicherung, Rätsel, Partien, Album, Urkunden …
└── tools/
    ├── build.js          baut die Einzeldatei:            node tools/build.js
    ├── verify-puzzles.js prüft alle Rätsel maschinell:    node tools/verify-puzzles.js [--verbose]
    └── smoke-test.js     Browser-Test (Playwright):       node tools/smoke-test.js [--shots DIR]
```

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

## Speicherung

Fortschritt liegt im `localStorage` des Browsers. Im Elternbereich lässt sich eine JSON-Sicherung speichern und auf einem anderen Gerät laden.
