/* =====================================================
   Lauras Schach-Akademie – KI-Modul
   - Suche (Alpha-Beta + Ruhesuche): eingebaute KI, Rätsel-Widerlegungen,
     Rätsel-Verifikation (tools/verify-puzzles.js)
   - Endspiel-Solver (Retrograde-Analyse über erreichbare Stellungen)
     für Bauernendspiele: K+B(+B) gegen K
   - Stockfish-Anbindung (Web Worker) mit fein dosierter Spielstärke
   ===================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./chess.js"));
  else root.ChessAI = factory(root.Chess);
})(typeof self !== "undefined" ? self : this, function (Chess) {
  "use strict";

  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;
  const FILES = "abcdefgh";

  /* ---------- Bewertung (aus Sicht von Weiß, in Hundertstel-Bauern) ---------- */
  function centerBonus(sq) {
    const f = FILES.indexOf(sq[0]), r = parseInt(sq[1], 10) - 1;
    const df = Math.abs(f - 3.5), dr = Math.abs(r - 3.5);
    return Math.round(12 - 3 * (df + dr));
  }
  function materialOnly(game) {
    let score = 0;
    for (const p of game.pieces()) score += p.color === "w" ? VAL[p.type] : -VAL[p.type];
    return score;
  }
  function evaluate(game) {
    if (game.materialOnly) return materialOnly(game);
    let score = 0;
    const pieces = game.pieces();
    let nonPawn = 0;
    for (const p of pieces) if (p.type !== "p" && p.type !== "k") nonPawn += VAL[p.type];
    const endgame = nonPawn <= 1300;
    for (const p of pieces) {
      let v = VAL[p.type];
      const rank = parseInt(p.square[1], 10);
      if (p.type === "p") {
        const adv = p.color === "w" ? rank - 2 : 7 - rank;
        v += adv * (endgame ? 14 : 5);
      } else if (p.type === "n" || p.type === "b") v += centerBonus(p.square) * 2;
      else if (p.type === "q") v += centerBonus(p.square);
      else if (p.type === "k") v += endgame ? centerBonus(p.square) * 2 : -centerBonus(p.square) * 2;
      score += p.color === "w" ? v : -v;
    }
    return score;
  }
  function evalFor(game) { return game.turn() === "w" ? evaluate(game) : -evaluate(game); }

  /* ---------- Suche ---------- */
  function orderMoves(moves) {
    return moves.sort((a, b) => {
      const va = (a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : 0) + (a.promotion ? 800 : 0);
      const vb = (b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : 0) + (b.promotion ? 800 : 0);
      return vb - va;
    });
  }
  function quiesce(game, alpha, beta, ctx, qdepth) {
    ctx.nodes++;
    const stand = evalFor(game);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qdepth <= 0) return alpha;
    const moves = orderMoves(game.legalMoves().filter(m => m.captured || m.promotion));
    for (const m of moves) {
      game.makeMove(m);
      const s = -quiesce(game, -beta, -alpha, ctx, qdepth - 1);
      game.undoMove();
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
  function negamax(game, depth, alpha, beta, ctx, ply) {
    ctx.nodes++;
    if (ctx.maxNodes && ctx.nodes > ctx.maxNodes) ctx.aborted = true;
    const moves = game.legalMoves();
    if (!moves.length) return game.in_check() ? -MATE + ply : 0;
    if (depth <= 0) return quiesce(game, alpha, beta, ctx, 6);
    if (game.halfmove >= 100) return 0;
    orderMoves(moves);
    let best = -Infinity;
    for (const m of moves) {
      game.makeMove(m);
      const s = -negamax(game, depth - 1, -beta, -alpha, ctx, ply + 1);
      game.undoMove();
      if (ctx.aborted) return best === -Infinity ? alpha : best;
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  /* analyse(game, depth, opts) -> [{move (verbose), score, exact}] absteigend sortiert.
     opts.window: alle Züge innerhalb dieses Fensters unter dem besten bekommen exakte Werte
     (für "mehrere Lösungen" und für die Kandidatenauswahl der KI). */
  function analyse(game, depth, opts) {
    opts = opts || {};
    const window = opts.window === undefined ? 100000 : opts.window;
    const ctx = { nodes: 0, maxNodes: opts.maxNodes || 0, aborted: false };
    game.materialOnly = !!opts.materialOnly;
    const all = game.legalMoves();
    const verboseAll = all.map(m => game.verbose(m, all));
    let order = all.map((m, i) => ({ m, i }));
    let results = [];
    for (let d = 1; d <= depth; d++) {
      const round = [];
      let best = -Infinity;
      for (const { m, i } of order) {
        const alpha = best === -Infinity ? -Infinity : best - window - 1;
        game.makeMove(m);
        const s = -negamax(game, d - 1, -Infinity, -alpha, ctx, 1);
        game.undoMove();
        if (ctx.aborted) break;
        round.push({ move: verboseAll[i], score: s, exact: s > alpha, idx: i });
        if (s > best) best = s;
      }
      if (ctx.aborted) break;
      round.sort((a, b) => b.score - a.score);
      results = round;
      order = round.map(r => ({ m: all[r.idx], i: r.idx }));
      if (Math.abs(best) > MATE - 100) break; // Matt gefunden – tiefer suchen bringt nichts
    }
    game.materialOnly = false;
    return results.map(r => ({ move: r.move, score: r.score, exact: r.exact }));
  }
  function bestMove(game, depth, opts) {
    const r = analyse(game, depth, opts);
    return r.length ? r[0] : null;
  }
  function scoreText(score) {
    if (score > MATE - 100) return "Matt in " + Math.ceil((MATE - score) / 2);
    if (score < -MATE + 100) return "wird matt in " + Math.ceil((MATE + score) / 2);
    return (score >= 0 ? "+" : "") + (score / 100).toFixed(1);
  }

  /* ---------- Eingebaute KI („Robi“) ---------- */
  function chooseBuiltin(game, level, rnd) {
    rnd = rnd || Math.random;
    const depth = level.depth || 1;
    const ranked = analyse(game, depth, { window: 100000, maxNodes: level.maxNodes || 400000 });
    if (!ranked.length) return null;
    if (level.blunder && rnd() < level.blunder && ranked.length > 2) {
      // Absichtlicher Fehler: ein Zug aus der schwächeren Hälfte, aber kein Selbstmatt
      const tail = ranked.slice(Math.ceil(ranked.length / 2)).filter(r => r.score > -MATE + 100);
      if (tail.length) return tail[Math.floor(rnd() * tail.length)].move;
    }
    // Leichte Streuung unter (fast) gleich guten Zügen, damit Robi nicht immer gleich spielt
    const top = ranked.filter(r => r.score >= ranked[0].score - (level.window || 20));
    return top[Math.floor(rnd() * top.length)].move;
  }

  /* ---------- Endspiel-Solver (Bauernendspiele, nur weiße Bauern) ----------
     Ergebnis pro Stellung: win (Weiß gewinnt bei bestem Spiel) oder draw.
     depth = Züge (Halbzüge) bis zur Umwandlung/zum Matt bei bestem Spiel. */
  function EndgameSolver(fen) {
    const game = new Chess(fen);
    for (const p of game.pieces()) if (p.color === "b" && p.type === "p") throw new Error("Solver: nur weiße Bauern erlaubt");
    this.keys = [];           // index -> key
    this.index = new Map();   // key -> index
    this.succ = [];           // index -> [ {to: index | null, term: "win"|"draw"|null, move} ]
    this.turnOf = [];
    this.value = [];          // "win" | "draw" | null
    this.depth = [];
    this.build(game);
    this.solve();
  }
  /* Kompakter Schlüssel: Zugrecht + Figuren (nur Könige und weiße Bauern). */
  EndgameSolver.key = function (game) {
    let k = game.turn();
    const b = game.board;
    for (let i = 0; i < 128; i++) { if (i & 0x88) continue; const p = b[i]; if (p) k += "|" + (p.color === "w" ? p.type.toUpperCase() : p.type) + i; }
    return k;
  };
  EndgameSolver.setFromKey = function (game, key) {
    const parts = key.split("|");
    game.clear();
    game.turnColor = parts[0];
    for (let j = 1; j < parts.length; j++) {
      const ch = parts[j][0], idx = parseInt(parts[j].slice(1), 10);
      const color = ch === ch.toUpperCase() ? "w" : "b";
      game.board[idx] = { type: ch.toLowerCase(), color };
      if (ch.toLowerCase() === "k") game.kings[color] = idx;
    }
  };
  EndgameSolver.prototype.build = function (game) {
    const startKey = EndgameSolver.key(game);
    const addKey = k => { if (this.index.has(k)) return this.index.get(k); const i = this.keys.length; this.keys.push(k); this.index.set(k, i); this.succ.push(null); return i; };
    addKey(startKey);
    for (let i = 0; i < this.keys.length; i++) {
      EndgameSolver.setFromKey(game, this.keys[i]);
      this.turnOf[i] = game.turn();
      const list = [];
      const moves = game.legalMoves();
      for (const m of moves) {
        if (m.promotion && m.promotion !== "q" && m.promotion !== "r") continue;
        game.makeMove(m);
        let entry;
        if (m.promotion) {
          // Terminal: Umwandlung. Gewonnen, außer die neue Figur fällt sofort oder es ist Patt.
          const replies = game.legalMoves();
          let term = "win";
          if (!replies.length) term = game.in_check() ? "win" : "draw";
          else if (replies.some(r => r.to === m.to)) term = "draw";
          entry = { to: null, term };
        } else entry = { to: addKey(EndgameSolver.key(game)), term: null };
        game.undoMove();
        entry.move = game.verbose(m, moves);
        list.push(entry);
      }
      this.succ[i] = list;
    }
  };
  EndgameSolver.prototype.solve = function () {
    const n = this.keys.length;
    this.value = new Array(n).fill(null);
    this.depth = new Array(n).fill(Infinity);
    let layer = 0, changed = true;
    while (changed) {
      changed = false;
      layer++;
      const newly = [];
      for (let i = 0; i < n; i++) {
        if (this.value[i]) continue;
        const s = this.succ[i];
        if (this.turnOf[i] === "w") {
          if (s.some(e => e.term === "win" || (e.to !== null && this.value[e.to] === "win"))) newly.push(i);
        } else {
          if (s.length && s.every(e => e.term === "win" || (e.to !== null && this.value[e.to] === "win"))) newly.push(i);
        }
      }
      for (const i of newly) { this.value[i] = "win"; this.depth[i] = layer; changed = true; }
    }
    for (let i = 0; i < n; i++) if (!this.value[i]) { this.value[i] = "draw"; this.depth[i] = Infinity; }
  };
  EndgameSolver.prototype.lookup = function (game) {
    const i = this.index.get(EndgameSolver.key(game));
    if (i === undefined) return null;
    return { value: this.value[i], depth: this.depth[i], index: i };
  };
  /* Alle Züge der Stellung mit Ergebnis: [{move, value, depth}] */
  EndgameSolver.prototype.moveResults = function (game) {
    const i = this.index.get(EndgameSolver.key(game));
    if (i === undefined) return [];
    return this.succ[i].map(e => {
      if (e.term) return { move: e.move, value: e.term, depth: 0 };
      return { move: e.move, value: this.value[e.to], depth: this.depth[e.to] };
    });
  };
  EndgameSolver.prototype.winningMoves = function (game) { return this.moveResults(game).filter(r => r.value === "win"); };
  /* Bester Zug für Schwarz: möglichst Remis halten, sonst so lange wie möglich wehren. */
  EndgameSolver.prototype.defend = function (game) {
    const rs = this.moveResults(game);
    if (!rs.length) return null;
    const draws = rs.filter(r => r.value === "draw");
    if (draws.length) return draws[Math.floor(Math.random() * draws.length)].move;
    rs.sort((a, b) => b.depth - a.depth);
    return rs[0].move;
  };
  /* Schnellster Gewinnzug für Weiß (Pia zeigt ihn beim Tipp). */
  EndgameSolver.prototype.fastestWin = function (game) {
    const rs = this.winningMoves(game);
    if (!rs.length) return null;
    rs.sort((a, b) => a.depth - b.depth);
    return rs[0].move;
  };

  /* ---------- Stockfish-Anbindung ----------
     Lädt Stockfish (asm.js/WASM-Build) in einem Web Worker. Quellen in dieser Reihenfolge:
     1) lokale Datei engine/stockfish.js neben der App (nur per http(s):// erreichbar)
     2) cdnjs (Internet nötig)
     Schlägt alles fehl, spielt Robi mit der eingebauten KI weiter. */
  const STOCKFISH_SOURCES = [
    { url: "engine/stockfish.js", local: true },
    { url: "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js", local: false }
  ];
  function StockfishEngine() {
    this.worker = null; this.ready = false; this.queue = []; this.listeners = []; this.source = null;
  }
  StockfishEngine.prototype.load = function (timeoutMs) {
    if (this.readyPromise) return this.readyPromise;
    const self = this;
    this.readyPromise = new Promise(async (resolve, reject) => {
      if (typeof Worker === "undefined") return reject(new Error("Kein Web Worker verfügbar"));
      const base = (typeof document !== "undefined" && document.baseURI) ? document.baseURI : "";
      const isHttp = /^https?:/.test(base);
      let lastErr = null;
      for (const src of STOCKFISH_SOURCES) {
        if (src.local && !isHttp) continue;
        try {
          const w = await self.tryStart(src, timeoutMs || 15000);
          self.worker = w; self.ready = true; self.source = src.url;
          return resolve(self);
        } catch (e) { lastErr = e; }
      }
      reject(lastErr || new Error("Stockfish nicht verfügbar"));
    });
    return this.readyPromise;
  };
  /* Baut den Worker. Die CDN-Quelle wird zuerst per fetch geholt und dann als
     Blob gestartet: Diese Anfrage läuft durch den Service Worker und landet in
     dessen Cache, damit Stockfish später auch offline zur Verfügung steht.
     Scheitert das (kein CORS, kein fetch), wird wie bisher per importScripts geladen. */
  StockfishEngine.prototype.makeWorker = async function (src) {
    if (src.local) return new Worker(src.url);
    const asWorker = code => new Worker(URL.createObjectURL(new Blob([code], { type: "application/javascript" })));
    try {
      const res = await fetch(src.url, { mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return asWorker(await res.text());
    } catch (e) {
      return asWorker("importScripts(" + JSON.stringify(src.url) + ");");
    }
  };
  StockfishEngine.prototype.tryStart = function (src, timeoutMs) {
    const self = this;
    return new Promise((resolve, reject) => {
      let worker = null, done = false;
      const timer = setTimeout(() => {
        done = true;
        if (worker) worker.terminate();
        reject(new Error("Zeitüberschreitung: " + src.url));
      }, timeoutMs);
      self.makeWorker(src).then(w => {
        if (done) { w.terminate(); return; }
        worker = w;
        wire();
      }, e => { clearTimeout(timer); reject(e); });

      function wire() {
        worker.onerror = e => { clearTimeout(timer); worker.terminate(); reject(new Error("Worker-Fehler: " + (e.message || src.url))); };
        worker.onmessage = e => {
          const line = typeof e.data === "string" ? e.data : (e.data && e.data.data) || "";
          if (line.startsWith("uciok")) { worker.postMessage("isready"); }
          else if (line.startsWith("readyok")) {
            clearTimeout(timer);
            worker.onmessage = ev => self.onLine(typeof ev.data === "string" ? ev.data : (ev.data && ev.data.data) || "");
            worker.onerror = null;
            resolve(worker);
          }
        };
        worker.postMessage("uci");
      }
    });
  };
  StockfishEngine.prototype.onLine = function (line) { for (const l of this.listeners.slice()) l(line); };
  StockfishEngine.prototype.send = function (cmd) { if (this.worker) this.worker.postMessage(cmd); };
  /* candidates(fen, {depth, multipv, skill}) -> Promise<[{move:{from,to,promotion}, score}]> */
  StockfishEngine.prototype.candidates = function (fen, opts) {
    const self = this;
    opts = opts || {};
    return new Promise((resolve, reject) => {
      if (!self.ready) return reject(new Error("Stockfish nicht bereit"));
      const multipv = opts.multipv || 1;
      const found = {};
      const timer = setTimeout(() => { self.listeners = self.listeners.filter(l => l !== listener); self.send("stop"); reject(new Error("Stockfish antwortet nicht")); }, opts.timeoutMs || 20000);
      const listener = line => {
        if (line.startsWith("info") && line.includes(" pv ")) {
          const mpv = / multipv (\d+)/.exec(line);
          const idx = mpv ? parseInt(mpv[1], 10) : 1;
          const cp = / score cp (-?\d+)/.exec(line);
          const mate = / score mate (-?\d+)/.exec(line);
          const pv = / pv (\S+)/.exec(line);
          if (!pv) return;
          let score = cp ? parseInt(cp[1], 10) : (mate ? (parseInt(mate[1], 10) > 0 ? MATE - parseInt(mate[1], 10) : -MATE - parseInt(mate[1], 10)) : 0);
          found[idx] = { uci: pv[1], score };
        } else if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          self.listeners = self.listeners.filter(l => l !== listener);
          const bm = line.split(/\s+/)[1];
          const list = Object.keys(found).map(k => found[k]);
          if (bm && bm !== "(none)" && !list.some(x => x.uci === bm)) list.unshift({ uci: bm, score: list.length ? list[0].score : 0 });
          list.sort((a, b) => b.score - a.score);
          resolve(list.map(x => ({ move: { from: x.uci.slice(0, 2), to: x.uci.slice(2, 4), promotion: x.uci[4] || undefined }, score: x.score })));
        }
      };
      self.listeners.push(listener);
      self.send("setoption name MultiPV value " + multipv);
      self.send("setoption name Skill Level value " + (opts.skill === undefined ? 20 : opts.skill));
      self.send("position fen " + fen);
      self.send("go depth " + (opts.depth || 4));
    });
  };

  return { VAL, MATE, evaluate, materialOnly, analyse, bestMove, chooseBuiltin, scoreText, EndgameSolver, StockfishEngine, STOCKFISH_SOURCES };
});
