/* =====================================================
   Lauras Schach-Akademie – Rätsel (alle Stellungen maschinell geprüft)

   Jedes Rätsel:
   - fen        Stellung, Weiß am Zug
   - goalType   "mate1"   : JEDER Zug, der sofort matt setzt, zählt.
                            Prüfung: solutions == Menge aller Mattzüge.
                "exact"   : nur die geprüften Züge in `solutions` zählen.
                            Prüfung (Suche, Tiefe 5): jede Lösung gewinnt
                            mindestens `minGain` Hundertstel-Bauern, JEDER
                            andere Zug gewinnt deutlich weniger.
                "endgame" : mehrzügig, Laura spielt bis zur Umwandlung.
                            Prüfung (Retrograde-Solver): solutions == Menge
                            aller Züge, die den Gewinn halten.
   - solutions  alle geprüften Lösungszüge
   - review     Begründung (warum die Lösung gewinnt, warum Alternativen scheitern)
   - explain    optionale Texte für typische Fehlzüge (Schlüssel: from+to)
   - success    Pias Erklärung nach der Lösung
   - tip        Hinweis für den Tipp-Knopf
   Prüfen mit:  node tools/verify-puzzles.js
   ===================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PUZZLES = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const ORDER = ["matt", "gabel", "fesselung", "spiess", "abzug", "bauern"];
  const THEMES = {
    matt: {
      title: "Matt in 1", emoji: "👑", sticker: { emoji: "👑", name: "Königin Matilda" },
      short: "Finde den Siegzug!",
      lesson: "<h4>👑 Matt in 1</h4>Der gegnerische König muss angegriffen sein und darf <b>kein</b> freies Feld mehr haben. Achte besonders auf die Grundreihe – dort ist der König oft gefangen!",
      list: [
        { id: "matt-1", fen: "6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1", goalType: "mate1",
          goal: "Setze Schwarz in einem Zug matt!",
          solutions: [{ from: "e1", to: "e8" }],
          review: "Einzige Lösung Te8# (Grundreihenmatt: die Bauern f7/g7/h7 sperren den eigenen König ein).",
          success: "Grundreihenmatt! Die eigenen Bauern nehmen dem König jede Flucht.",
          tip: "Der König ist hinter seinen Bauern eingesperrt. Wer kommt auf die 8. Reihe?" },
        { id: "matt-2", fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1", goalType: "mate1",
          goal: "Setze Schwarz in einem Zug matt! (Es gibt mehrere Wege!)",
          solutions: [{ from: "f7", to: "g7" }, { from: "f7", to: "h7" }, { from: "f7", to: "f8" }, { from: "f7", to: "e8" }],
          review: "VIER Lösungen: Dg7#, Dh7#, Df8# und De8# (Grundreihe: g8 ist von der Dame gedeckt, g7/h7 vom König). Dg8+?? scheitert an Kxg8.",
          success: "Dein König deckt die Dame – der schwarze König kann sie nicht schlagen.",
          tip: "Dein König deckt g7 und h7. Aber Vorsicht: Auf g8 könnte der König deine Dame schlagen!" },
        { id: "matt-3", fen: "3k4/R7/3K4/8/8/8/8/8 w - - 0 1", goalType: "mate1",
          goal: "Setze Schwarz in einem Zug matt!",
          solutions: [{ from: "a7", to: "a8" }],
          review: "Einzige Lösung Ta8#. Td7+ scheitert an Kc8/Ke8 (der Turm ist vom König gedeckt, Kxd7 geht nicht – aber der König flieht seitlich).",
          success: "Dein König hält c7, d7 und e7 – der Turm gibt auf der Grundreihe das Matt.",
          tip: "Dein König hält alle Fluchtfelder. Der Turm gibt den letzten Schach!" },
        { id: "matt-4", fen: "6k1/R7/1R6/8/8/8/8/6K1 w - - 0 1", goalType: "mate1",
          goal: "Setze Schwarz in einem Zug matt!",
          solutions: [{ from: "b6", to: "b8" }],
          review: "Einzige Lösung Tb8# (Treppenmatt). Ta8+ scheitert an Kg7 (der Turm b6 deckt die 6. Reihe, nicht die 7.), Tg6+ an Kf8.",
          success: "Treppenmatt: Ein Turm sperrt die 7. Reihe, der andere setzt auf der 8. matt.",
          tip: "Ein Turm sperrt die 7. Reihe – der andere greift auf der 8. Reihe an!" },
        { id: "matt-5", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", goalType: "mate1",
          goal: "Setze Schwarz in einem Zug matt!",
          solutions: [{ from: "f3", to: "f7" }],
          review: "Einzige Lösung Dxf7# (Schäfermatt; der Läufer c4 deckt die Dame, Kxf7 ist unmöglich).",
          success: "Das Schäfermatt! f7 ist nur vom König gedeckt – und der darf die gedeckte Dame nicht schlagen.",
          tip: "Das berühmte Schäfermatt! Welches Feld ist am schwächsten? Dein Läufer hilft." }
      ]
    },
    gabel: {
      title: "Die Gabel", emoji: "🍴", sticker: { emoji: "🐴", name: "Gabel-Gustav" },
      short: "Greife zwei Figuren gleichzeitig an",
      lesson: "<h4>🍴 Die Gabel</h4>Eine Figur greift <b>zwei</b> Dinge gleichzeitig an – der Gegner kann nur eines retten! Springer sind Gabel-Meister, aber auch Bauern und Damen können gabeln.",
      list: [
        { id: "gabel-1", fen: "8/8/2n1n3/8/3P4/8/8/K6k w - - 0 1", goalType: "exact", minGain: 200,
          goal: "Greife beide Springer gleichzeitig an!",
          solutions: [{ from: "d4", to: "d5" }],
          review: "Einzige Lösung d5: Bauerngabel gegen Sc6 und Se6. Kein Springer kann d5 schlagen, einer geht verloren. Königszüge gewinnen nichts.",
          success: "Bauerngabel! Beide Springer sind angegriffen – nur einer kann fliehen.",
          tip: "Dein kleiner Bauer kann zwei Springer gleichzeitig ärgern!" },
        { id: "gabel-2", fen: "r3k3/8/4N3/8/8/8/8/4K3 w - - 0 1", goalType: "exact", minGain: 400,
          goal: "Gabel! Greife König und Turm gleichzeitig an.",
          solutions: [{ from: "e6", to: "c7" }],
          review: "Einzige Lösung Sc7+: gabelt Ke8 und Ta8, danach Sxa8. Sg7+ ist nur Schach ohne Gewinn.",
          success: "Springergabel mit Schach: Der König muss weg, dann fällt der Turm.",
          tip: "Springer-Gabel! Finde das Feld, von dem aus du König UND Turm angreifst." },
        { id: "gabel-3", fen: "1r5k/5p1p/8/8/8/8/8/4Q1K1 w - - 0 1", goalType: "exact", minGain: 400,
          goal: "Gabel! Gib Schach und greife gleichzeitig den Turm an.",
          solutions: [{ from: "e1", to: "e5" }],
          review: "Einzige Lösung De5+: Schach auf der Diagonale e5–h8 und Angriff auf Tb8; nach Kg8 folgt Dxb8+. De8+?? scheitert an Txe8, Da1+ an Kg8. " +
                  "Die Bauern f7/h7 verhindern, dass andere Schachs (Dc3+, Dh4+) über die Diagonale a2–g8 doch noch zur Gabel führen – ohne sie wäre die Aufgabe nicht eindeutig.",
          success: "Damengabel: Schach und Turmangriff gleichzeitig – der Turm ist verloren.",
          tip: "Die Dame kann diagonal UND gerade angreifen. Schach + Turm-Angriff!" },
        { id: "gabel-4", fen: "3q1k2/8/8/8/5N2/8/8/6K1 w - - 0 1", goalType: "exact", minGain: 500,
          goal: "Gabel! Greife König und Dame gleichzeitig an.",
          solutions: [{ from: "f4", to: "e6" }],
          review: "Einzige Lösung Se6+: gabelt Kf8 und Dd8. Sg6+ ist nur Schach ohne Gewinn.",
          success: "Die Königsgabel: Der König muss dem Schach ausweichen – die Dame ist verloren.",
          tip: "Von welchem Feld greift dein Springer König und Dame an?" }
      ]
    },
    fesselung: {
      title: "Die Fesselung", emoji: "📌", sticker: { emoji: "🦎", name: "Fessel-Fiona" },
      short: "Die gefesselte Figur darf nicht weg",
      lesson: "<h4>📌 Die Fesselung</h4>Eine Figur steht zwischen dem Angreifer und ihrem König: Sie ist <b>gefesselt</b> und darf nicht ziehen – sonst stünde der König im Schach. Gefesselte Figuren können nicht fliehen und <b>nicht verteidigen</b>!",
      list: [
        { id: "fesselung-1", fen: "4k3/p4ppp/2n5/8/8/8/5PPP/3R1BK1 w - - 0 1", goalType: "exact", minGain: 250,
          goal: "Fessle den Springer an den König – dann kann er nicht mehr fliehen!",
          solutions: [{ from: "f1", to: "b5" }],
          review: "Einzige Lösung Lb5!: fesselt Sc6 an Ke8. Der Springer ist angegriffen, ungedeckt und darf nicht ziehen. " +
                  "Kd7 würde ihn decken, aber der Turm d1 kontrolliert d7 und d8 (der Springer schirmt d7 gegen den Läufer ab – ohne den Turm wäre Kd7 möglich und die Aufgabe falsch!). " +
                  "Nach Ke7/Kf8 oder a6 folgt Lxc6(+). Ld3/Le2/Lc4 greifen den Springer nicht an; Td6 greift ihn ohne Fesselung an – er läuft weg. Td8+?? Kxd8.",
          explain: { f1d3: "Der Läufer greift den Springer nicht an. Schwarz zieht ihn in Sicherheit.", f1c4: "Von c4 greift der Läufer den Springer nicht an. Schwarz rettet ihn.", d1d6: "Angriff ohne Fesselung – der Springer springt einfach weg.", d1d8: "Der König schlägt den Turm!" },
          success: "Der Springer ist gefesselt und angegriffen – er kann nicht weg und niemand kann ihn decken. Nächster Zug: Lxc6!",
          tip: "Auf welcher Diagonale stehen Springer und König in einer Linie? Dort hin mit dem Läufer!" },
        { id: "fesselung-2", fen: "4k3/p4ppp/8/4q3/8/8/5KPP/R7 w - - 0 1", goalType: "exact", minGain: 300,
          goal: "Fessle die Dame an den König!",
          solutions: [{ from: "a1", to: "e1" }],
          review: "Einzige Lösung Te1!: fesselt De5 an Ke8; der Turm ist vom König f2 gedeckt. " +
                  "Bestes für Schwarz ist Dxe1+ Kxe1 (Dame gegen Turm, +4). Jeder Damenzug auf der e-Linie und jeder Königszug verliert die Dame ganz (Txe5). " +
                  "Txa7 gewinnt nur einen Bauern; andere Turmzüge gewinnen nichts – die Dame schlägt sogar den Turm auf a1, wenn er dort bleibt.",
          explain: { a1a7: "Nur ein Bauer – und die Dame darf weiterspielen. Es gibt viel mehr zu holen!" },
          success: "Die Dame ist an ihren König gefesselt. Sie kann höchstens den Turm nehmen – und wird dann vom König geschlagen.",
          tip: "Dame und König stehen auf derselben Linie. Welcher Turmzug nutzt das aus? Achte darauf, dass der Turm gedeckt ist." },
        { id: "fesselung-3", fen: "4k3/pp1p2pp/4n3/8/3b4/5N2/PP3PPP/4R1K1 w - - 0 1", goalType: "exact", minGain: 250,
          goal: "Der Läufer d4 sieht gedeckt aus. Aber ist er das wirklich?",
          solutions: [{ from: "f3", to: "d4" }],
          review: "Einzige Lösung Sxd4!: Der einzige Verteidiger von d4, der Springer e6, ist durch Te1 an Ke8 gefesselt und darf nicht zurückschlagen – der Läufer ist umsonst. " +
                  "Txe6+?? dxe6 verliert Turm gegen Springer. Wartezüge gewinnen nichts: Schwarz zieht den Läufer weg oder hebt mit Kd8 die Fesselung auf. " +
                  "Td1 hebt die Fesselung selbst auf, danach ist d4 wieder gedeckt. " +
                  "Unterlegene Alternative: Txe6+ dxe6 Sxd4 gewinnt nur Turm gegen Springer+Läufer (+1,5) – Sxd4 sofort gewinnt den Läufer umsonst (+3).",
          inferior: ["e1e6"],
          explain: { e1e6: "Turm gegen Springer – und den Läufer bekommst du auch ohne dieses Opfer. Es geht viel billiger!", e1d1: "Damit hebst du deine eigene Fesselung auf – jetzt deckt der Springer wieder." },
          success: "Gefesselte Figuren verteidigen nicht! Der Springer e6 darf nicht zurückschlagen – sonst stünde sein König im Schach.",
          tip: "Wer deckt den Läufer? Und darf diese Figur überhaupt ziehen? Schau auf die e-Linie." },
        { id: "fesselung-4", fen: "4k3/ppp2ppp/3p4/4n3/8/8/PPP2PPP/4R1K1 w - - 0 1", goalType: "exact", minGain: 150,
          goal: "Der Springer ist schon gefesselt. Erhöhe den Druck und gewinne ihn!",
          solutions: [{ from: "f2", to: "f4" }],
          review: "Einzige Lösung f4!: greift den gefesselten Springer mit dem Bauern an. Er darf nicht fliehen; nach jedem Zug folgt fxe5 (Springer gegen Bauer). " +
                  "Txe5+?? dxe5 verliert den Turm gegen den Springer. f3 greift e5 nicht an.",
          explain: { e1e5: "Der Springer war vom Bauern d6 gedeckt – Turm gegen Springer ist ein schlechtes Geschäft.", f2f3: "Von f3 greift der Bauer e4 und g4 an, aber nicht e5." },
          success: "Druck erhöhen! Der gefesselte Springer kann nicht weg – ein Bauer gewinnt ihn.",
          tip: "Der Springer darf nicht ziehen. Welche billige Figur kann ihn angreifen?" }
      ]
    },
    spiess: {
      title: "Der Spieß", emoji: "🍢", sticker: { emoji: "🦔", name: "Spieß-Sepp" },
      short: "Der König muss weg – dahinter wartet die Beute",
      lesson: "<h4>🍢 Der Spieß</h4>Der Spieß ist die umgekehrte Fesselung: Zuerst wird die <b>wertvolle</b> Figur (meist der König) angegriffen. Sie muss ausweichen – und dahinter wartet auf derselben Linie die Beute!",
      list: [
        { id: "spiess-1", fen: "8/8/2k4q/8/8/8/8/R5K1 w - - 0 1", goalType: "exact", minGain: 500,
          goal: "Spieß! Gib Schach – dahinter steht die Dame.",
          solutions: [{ from: "a1", to: "a6" }],
          review: "Einzige Lösung Ta6+: König und Dame stehen auf der 6. Reihe. Der König muss die Reihe verlassen (b6/d6 bleiben im Schach), dann Txh6. " +
                  "Alle anderen Turmzüge greifen nichts an oder lassen die Dame entkommen.",
          success: "Spieß auf der 6. Reihe: Der König muss weichen, die Dame dahinter fällt.",
          tip: "König und Dame stehen auf derselben Reihe. Gib Schach auf dieser Reihe!" },
        { id: "spiess-2", fen: "r7/8/8/3k4/8/8/4B3/6K1 w - - 0 1", goalType: "exact", minGain: 400,
          goal: "Spieß mit dem Läufer: Schach – und dahinter der Turm!",
          solutions: [{ from: "e2", to: "f3" }],
          review: "Einzige Lösung Lf3+: Auf der langen Diagonale h1–a8 stehen Kd5 und Ta8. Nach jedem Königszug folgt Lxa8. " +
                  "Lc4+?? Kxc4. Ld3/Lf1 sind kein Schach, der Turm bleibt sicher.",
          explain: { e2c4: "Der Läufer stand direkt neben dem König – Kxc4!" },
          success: "Diagonal-Spieß: Der König weicht aus, der Turm dahinter geht verloren.",
          tip: "Welche lange Diagonale verbindet König und Turm? Stell den Läufer darauf – mit Schach." },
        { id: "spiess-3", fen: "8/2k3r1/8/8/8/8/Q7/7K w - - 0 1", goalType: "exact", minGain: 400,
          goal: "Spieß mit der Dame: Schach auf der 7. Reihe!",
          solutions: [{ from: "a2", to: "a7" }],
          review: "Einzige Lösung Da7+: Kc7 und Tg7 stehen auf der 7. Reihe; der Turm kann nicht dazwischenziehen (der König steht im Weg). Nach dem Königszug folgt Dxg7. " +
                  "Da5+ und Dc4+ sind Schachs ohne Beute; Df7+?? Txf7; Dg8 greift nur an, der Turm zieht weg.",
          explain: { a2f7: "Der Turm schlägt die Dame! Schach ist nicht immer gut.", a2a5: "Schach, aber danach ist nichts angegriffen.", a2c4: "Schach, aber der Turm ist danach nicht angegriffen." },
          success: "Spieß auf der 7. Reihe! Der König muss ausweichen, dann fällt der Turm.",
          tip: "König und Turm stehen auf der 7. Reihe. Von welchem Feld gibst du auf dieser Reihe Schach?" },
        { id: "spiess-4", fen: "4q3/8/2k5/8/8/8/8/3B2K1 w - - 0 1", goalType: "exact", minGain: 500,
          goal: "Spieß mit dem Läufer: Dahinter steht die Dame!",
          solutions: [{ from: "d1", to: "a4" }],
          review: "Einzige Lösung La4+: Kc6 und De8 stehen auf der Diagonale a4–e8. Kb5 ist unmöglich (vom Läufer angegriffen). " +
                  "Nach einem Königszug folgt Lxe8; nach dem Zwischenzug Dd7 folgt Lxd7+ Kxd7 (Dame gegen Läufer). " +
                  "Lf3+ ist ein Schach ohne Beute, Lh5/Lg4 greifen die Dame nur an – sie zieht weg.",
          explain: { d1f3: "Schach – aber auf dieser Diagonale steht keine Beute hinter dem König.", d1h5: "Die Dame ist angegriffen und zieht einfach weg." },
          success: "Diagonal-Spieß gegen die Dame: Selbst wenn sie dazwischenzieht, wird sie geschlagen.",
          tip: "König und Dame stehen auf einer Diagonale. Von wo gibst du darauf Schach – ohne dass der König den Läufer schlagen kann?" }
      ]
    },
    abzug: {
      title: "Der Abzugsangriff", emoji: "🎭", sticker: { emoji: "🦊", name: "Abzugs-Anton" },
      short: "Eine Figur zieht weg – eine andere greift an",
      lesson: "<h4>🎭 Der Abzugsangriff</h4>Eine Figur zieht weg und <b>öffnet die Linie</b> für eine andere Figur dahinter. Zwei Angriffe auf einmal! Ist der König das Ziel, heißt es <b>Abzugsschach</b> – und wenn beide Figuren Schach geben: <b>Doppelschach</b>.",
      list: [
        { id: "abzug-1", fen: "4k3/p4p1p/6q1/4N3/8/8/6PP/4R1K1 w - - 0 1", goalType: "exact", minGain: 500,
          goal: "Abzugsschach! Der Springer zieht weg – und schlägt dabei etwas Wertvolles.",
          solutions: [{ from: "e5", to: "g6" }],
          review: "Einzige Lösung Sxg6+: Der Springer schlägt die Dame und öffnet die e-Linie für Te1 – Schach! Schwarz muss den König ziehen und kann den Springer nicht zurückschlagen. " +
                  "Sxf7+ gewinnt nur einen Bauern, andere Abzugsschachs gewinnen nichts.",
          explain: { e5f7: "Auch ein Abzugsschach – aber nur ein Bauer. Die Dame war das bessere Ziel!" },
          success: "Abzugsschach: Weil der Turm Schach gibt, darf Schwarz den Springer nicht schlagen – die Dame ist weg.",
          tip: "Wenn der Springer wegzieht, gibt der Turm Schach. Wohin kann der Springer mit Gewinn ziehen?" },
        { id: "abzug-2", fen: "6k1/pq3ppp/8/8/4N3/8/5PBP/6K1 w - - 0 1", goalType: "exact", minGain: 450,
          goal: "Abzug mit Schach: Der Springer gibt Schach – und der Läufer greift an!",
          solutions: [{ from: "e4", to: "f6" }],
          review: "Einzige Lösung Sf6+: Der Springer gibt Schach und öffnet die Diagonale g2–b7 gegen die Dame. Schwarz muss das Schach parieren (gxf6 oder Kh8/Kf8), dann Lxb7. " +
                  "Sd6/Sc5 greifen die Dame ohne Schach an – sie zieht einfach weg. Andere Springerzüge lassen die Dame ebenfalls fliehen.",
          explain: { e4d6: "Die Dame ist angegriffen, aber es ist kein Schach – sie zieht weg.", e4c5: "Kein Schach – die Dame rettet sich einfach." },
          success: "Abzugsangriff mit Schach: Schwarz hat keine Zeit, die Dame zu retten.",
          tip: "Der Läufer g2 zielt auf die Dame – der Springer steht im Weg. Zieh ihn mit Schach weg!" },
        { id: "abzug-3", fen: "7k/p4p1p/8/4N3/7q/5P2/PB4PP/6K1 w - - 0 1", goalType: "exact", minGain: 500,
          goal: "Doppelschach! Springer UND Läufer geben gleichzeitig Schach.",
          solutions: [{ from: "e5", to: "g6" }],
          review: "Einzige Lösung Sg6+: Doppelschach von Sg6 und Lb2. Bei Doppelschach hilft nur ein Königszug: Kg8 (g7 deckt der Läufer, h7 ist besetzt). Dann Sxh4. " +
                  "Andere Abzugsschachs greifen die Dame nicht an; Sf3 ist durch den eigenen Bauern versperrt; Sxf7+ gewinnt nur einen Bauern.",
          explain: { e5f7: "Doppelschach, ja – aber der Springer greift danach nichts Wertvolles an." },
          success: "Doppelschach! Schwarz darf nicht schlagen und nicht dazwischenziehen – nur der König darf ziehen. Danach ist die Dame fällig.",
          tip: "Von welchem Feld greift der Springer sowohl den König als auch die Dame an?" },
        { id: "abzug-4", fen: "4k3/p1q3pp/3p4/4P3/8/8/6PP/4R1K1 w - - 0 1", goalType: "exact", minGain: 600,
          goal: "Abzugsschach mit dem Bauern! Er schlägt – und der Turm gibt Schach.",
          solutions: [{ from: "e5", to: "d6" }],
          review: "Einzige Lösung exd6+: Der Bauer schlägt d6 und öffnet die e-Linie für Te1 – Schach! Gleichzeitig greift der Bauer die Dame c7 an. " +
                  "Nach Kd8/Kf8/Kd7 folgt dxc7 (Dame gegen Bauer); nach dem Zwischenzug De7 folgt dxe7. " +
                  "e6 bleibt auf der e-Linie und gibt kein Schach – die Dame zieht in Ruhe weg.",
          explain: { e5e6: "Der Bauer bleibt auf der e-Linie – kein Abzug, kein Schach. Die Dame hat Zeit." },
          success: "Abzugsschach mit Bauerngabel: Schwarz muss das Schach parieren und verliert die Dame.",
          tip: "Wenn der Bauer schräg schlägt, öffnet er die e-Linie für den Turm. Was greift er dann an?" }
      ]
    },
    bauern: {
      title: "Bauernendspiele", emoji: "♟️", sticker: { emoji: "🐢", name: "Bauern-Berta" },
      short: "Bring den Bauern zur Umwandlung",
      lesson: "<h4>♟️ Bauernendspiele</h4>Im Endspiel wird der kleine Bauer zum Star: Erreicht er die letzte Reihe, wird er zur <b>Dame</b>! Pia spielt Schwarz und versucht, den Bauern zu fangen. Du hast gewonnen, sobald der Bauer sich umwandelt.",
      list: [
        { id: "bauern-1", fen: "8/8/8/2k5/7P/8/8/K7 w - - 0 1", goalType: "endgame",
          goal: "Quadratregel: Kann der schwarze König den Bauern noch fangen? Lauf los!",
          solutions: [{ from: "h4", to: "h5" }],
          review: "Nur h5! gewinnt: Nach h5 steht der schwarze König außerhalb des Quadrats h5–h8–e8–e5 und kommt zu spät. " +
                  "Jeder Königszug lässt Schwarz mit Kd5 ins Quadrat und der Bauer wird gefangen (Remis).",
          success: "Der Bauer war schneller! Merke dir das Quadrat: Steht der König außerhalb, kann er nicht mehr fangen.",
          tip: "Zähle die Felder bis zur Umwandlung – und die Schritte des schwarzen Königs. Wer ist schneller?" },
        { id: "bauern-2", fen: "1k6/8/1PK5/8/8/8/8/8 w - - 0 1", goalType: "endgame",
          goal: "Der Bauer will nach b8. Aber Vorsicht vor dem Patt!",
          solutions: [{ from: "b6", to: "b7" }],
          review: "Nur b7! gewinnt: Nach Ka7 folgt Kc7 und der Bauer wandelt sich um. Jeder Königszug lässt Schwarz Zeit für Kb7 – dann hält der König das Feld b8 und es ist Remis.",
          success: "Erst der Bauer, dann der König! Nach Ka7 kommt Kc7 und nichts kann b8 mehr aufhalten.",
          tip: "Wenn dein König zieht, kommt Schwarz vor den Bauern. Was passiert, wenn der Bauer sofort zieht?" },
        { id: "bauern-3", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", goalType: "endgame",
          goal: "Dein König muss dem Bauern den Weg freimachen. Welcher Zug gewinnt?",
          solutions: [{ from: "e6", to: "d6" }, { from: "e6", to: "f6" }],
          review: "Kd6! und Kf6! gewinnen (beide gleichwertig): Der König geht seitlich vor den Bauern, z. B. Kd6 Kd8 e6 Ke8 e7 Kf7 Kd7 und der Bauer läuft durch. " +
                  "Kd5/Kf5 lassen Schwarz die Opposition (Ke7) und es ist Remis.",
          success: "Der König geht seitlich voran, der Bauer folgt – so wird er zur Dame.",
          tip: "Der Bauer kann noch nicht ziehen – dein König steht im Weg. Geh schräg nach vorn!" },
        { id: "bauern-4", fen: "3k4/8/3K4/3P4/8/8/8/8 w - - 0 1", goalType: "endgame",
          goal: "Schlüsselfeld! Bring deinen König vor den Bauern.",
          solutions: [{ from: "d6", to: "c6" }, { from: "d6", to: "e6" }],
          review: "Kc6! und Ke6! gewinnen: Der König erobert das Schlüsselfeld neben dem Bauern (z. B. Ke6 Ke8 d6 Kd8 d7 Kc7 Ke7 und d8=D). " +
                  "Kc5/Ke5 verschenken die Opposition (Remis). Der Bauer d5 kann nicht ziehen – der eigene König auf d6 steht ihm im Weg.",
          success: "Schlüsselfelder! Steht der König auf der 6. Reihe vor dem Bauern, ist es gewonnen.",
          tip: "Der König geht vor den Bauern und macht ihm den Weg frei. Aber nicht zurück!" }
      ]
    }
  };
  return { ORDER, THEMES };
});
