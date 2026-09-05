#!/usr/bin/env node
/* Prüft alle Rätsel maschinell. Aufruf: node tools/verify-puzzles.js [--verbose] */
"use strict";
const path = require("path");
const Chess = require(path.join(__dirname, "..", "src", "chess.js"));
const AI = require(path.join(__dirname, "..", "src", "ai.js"));
const PUZZLES = require(path.join(__dirname, "..", "src", "puzzles.js"));
const verbose = process.argv.includes("--verbose");
let failures = 0;
const key = m => m.from + m.to + (m.promotion || "");
const fmt = r => r.move.san + " (" + AI.scoreText(r.score) + ")";

for (const theme of PUZZLES.ORDER) {
  const T = PUZZLES.THEMES[theme];
  console.log("\n=== " + T.title + " (" + T.list.length + " Aufgaben) ===");
  for (const pz of T.list) {
    const game = new Chess(pz.fen);
    const problems = [];
    const solKeys = pz.solutions.map(key).sort();
    if (game.turn() !== "w") problems.push("Weiß ist nicht am Zug");
    if (game.in_check() && !pz.allowCheck) problems.push("Weiß steht im Schach (unnatürlich)");
    for (const s of pz.solutions) if (!game.moves({ square: s.from, verbose: true }).some(m => m.to === s.to)) problems.push("Lösungszug " + key(s) + " ist nicht legal");
    let note = "";
    if (pz.goalType === "mate1") {
      const mates = game.moves({ verbose: true }).filter(m => m.san.endsWith("#"));
      const mateKeys = mates.map(key).sort();
      note = "Mattzüge: " + mates.map(m => m.san).join(", ");
      if (JSON.stringify(mateKeys) !== JSON.stringify(solKeys)) problems.push("Lösungen stimmen nicht mit den Mattzügen überein: " + mates.map(m => m.san).join(", "));
    } else if (pz.goalType === "exact") {
      const base = AI.materialOnly(game);
      const ranked = AI.analyse(game, 5, { window: 100000, materialOnly: true });
      const gains = ranked.map(r => ({ ...r, gain: r.score - base }));
      const minGain = pz.minGain || 200;
      note = "Top: " + gains.slice(0, 4).map(r => r.move.san + " " + (r.gain >= 0 ? "+" : "") + (r.gain / 100).toFixed(1)).join(" | ");
      const bestSol = Math.max(...gains.filter(r => solKeys.includes(key(r.move))).map(r => r.gain), -Infinity);
      for (const r of gains) {
        const isSol = solKeys.includes(key(r.move));
        const isInferior = (pz.inferior || []).includes(key(r.move));
        if (isSol && r.gain < minGain) problems.push("Lösung " + r.move.san + " gewinnt nur " + (r.gain / 100).toFixed(1) + " (erwartet ≥ " + (minGain / 100).toFixed(1) + ")");
        if (isInferior && r.gain > bestSol - 100) problems.push("Dokumentierte Alternative " + r.move.san + " ist nicht klar unterlegen: " + (r.gain / 100).toFixed(1));
        if (!isSol && !isInferior && r.gain >= minGain * 0.6) problems.push("Alternative " + r.move.san + " gewinnt auch: " + (r.gain / 100).toFixed(1) + " – muss dokumentiert oder vermieden werden");
      }
      if (pz.explain) for (const k of Object.keys(pz.explain)) if (!ranked.some(r => key(r.move) === k)) problems.push("explain-Schlüssel " + k + " ist kein legaler Zug");
    } else if (pz.goalType === "endgame") {
      const t0 = Date.now();
      const S = new AI.EndgameSolver(pz.fen);
      const st = S.lookup(game);
      const rs = S.moveResults(game);
      const wins = rs.filter(r => r.value === "win").map(r => key(r.move)).sort();
      note = "Solver " + (Date.now() - t0) + "ms, " + S.keys.length + " Stellungen, Gewinn in " + st.depth + " Halbzügen. Züge: " + rs.map(r => r.move.san + ":" + (r.value === "win" ? "W" + r.depth : "Remis")).join(" ");
      if (st.value !== "win") problems.push("Stellung ist nicht gewonnen");
      if (JSON.stringify(wins) !== JSON.stringify(solKeys)) problems.push("Lösungen stimmen nicht mit den Gewinnzügen überein: " + wins.join(", "));
    } else problems.push("Unbekannter goalType " + pz.goalType);
    const ok = problems.length === 0;
    if (!ok) failures++;
    console.log((ok ? "  ✅ " : "  ❌ ") + pz.id + "  " + pz.solutions.map(s => { const m = new Chess(pz.fen).move(s); return m ? m.san : "ILLEGAL " + key(s); }).join("/"));
    if (verbose || !ok) console.log("     " + note);
    for (const p of problems) console.log("     ⚠️  " + p);
  }
}
console.log(failures ? "\n" + failures + " Rätsel mit Problemen." : "\nAlle Rätsel geprüft – keine Probleme.");
process.exit(failures ? 1 : 0);
