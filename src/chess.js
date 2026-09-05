/* =====================================================
   Lauras Schach-Akademie – Regel-Engine (chess.js-kompatible API)
   Läuft im Browser (window.Chess) und in Node (module.exports).
   0x88-Brett: Index = (8 - Reihe) * 16 + Linie, Reihe 8 liegt bei Zeile 0.
   ===================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Chess = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FILES = "abcdefgh";
  const START_FEN = "rnbqkbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".replace("pppp1ppp", "pppppppp");
  const PIECE_OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15],
    r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1]
  };
  const PAWN_DIR = { w: -16, b: 16 };
  const FLAGS = { NORMAL: 1, CAPTURE: 2, BIG_PAWN: 4, EP: 8, PROMOTION: 16, KSIDE: 32, QSIDE: 64 };
  const ROOKS = {
    w: [{ sq: 0x77, flag: FLAGS.KSIDE }, { sq: 0x70, flag: FLAGS.QSIDE }],
    b: [{ sq: 0x07, flag: FLAGS.KSIDE }, { sq: 0x00, flag: FLAGS.QSIDE }]
  };

  function sqName(i) { return FILES[i & 7] + (8 - (i >> 4)); }
  function sqIndex(name) { return (8 - parseInt(name[1], 10)) * 16 + FILES.indexOf(name[0]); }
  function rankOf(i) { return 8 - (i >> 4); }
  function swap(c) { return c === "w" ? "b" : "w"; }

  function Chess(fen) {
    this.board = new Array(128).fill(null);
    this.kings = { w: -1, b: -1 };
    this.turnColor = "w";
    this.castling = { w: 0, b: 0 };
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.hist = [];
    this.load(fen || START_FEN);
  }

  Chess.prototype.clear = function () {
    this.board = new Array(128).fill(null);
    this.kings = { w: -1, b: -1 };
    this.turnColor = "w"; this.castling = { w: 0, b: 0 }; this.ep = -1;
    this.halfmove = 0; this.fullmove = 1; this.hist = [];
  };

  Chess.prototype.load = function (fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) throw new Error("Ungültige FEN: " + fen);
    this.clear();
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("Ungültige FEN: " + fen);
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (/[1-8]/.test(ch)) { f += parseInt(ch, 10); continue; }
        const color = ch === ch.toUpperCase() ? "w" : "b";
        const type = ch.toLowerCase();
        if (!"pnbrqk".includes(type) || f > 7) throw new Error("Ungültige FEN: " + fen);
        const idx = r * 16 + f;
        this.board[idx] = { type, color };
        if (type === "k") this.kings[color] = idx;
        f++;
      }
    }
    this.turnColor = parts[1] === "b" ? "b" : "w";
    const c = parts[2] || "-";
    this.castling = { w: 0, b: 0 };
    if (c.includes("K")) this.castling.w |= FLAGS.KSIDE;
    if (c.includes("Q")) this.castling.w |= FLAGS.QSIDE;
    if (c.includes("k")) this.castling.b |= FLAGS.KSIDE;
    if (c.includes("q")) this.castling.b |= FLAGS.QSIDE;
    this.ep = parts[3] && parts[3] !== "-" ? sqIndex(parts[3]) : -1;
    this.halfmove = parseInt(parts[4] || "0", 10) || 0;
    this.fullmove = parseInt(parts[5] || "1", 10) || 1;
    return true;
  };

  Chess.prototype.fen = function () {
    let out = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0, row = "";
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p.color === "w" ? p.type.toUpperCase() : p.type;
      }
      if (empty) row += empty;
      out += row + (r < 7 ? "/" : "");
    }
    let c = "";
    if (this.castling.w & FLAGS.KSIDE) c += "K";
    if (this.castling.w & FLAGS.QSIDE) c += "Q";
    if (this.castling.b & FLAGS.KSIDE) c += "k";
    if (this.castling.b & FLAGS.QSIDE) c += "q";
    return [out, this.turnColor, c || "-", this.ep >= 0 ? sqName(this.ep) : "-", this.halfmove, this.fullmove].join(" ");
  };

  Chess.prototype.turn = function () { return this.turnColor; };
  Chess.prototype.get = function (sq) { const p = this.board[sqIndex(sq)]; return p ? { type: p.type, color: p.color } : null; };
  Chess.prototype.put = function (piece, sq) {
    const idx = sqIndex(sq);
    this.board[idx] = { type: piece.type, color: piece.color };
    if (piece.type === "k") this.kings[piece.color] = idx;
    return true;
  };
  Chess.prototype.remove = function (sq) {
    const idx = sqIndex(sq), p = this.board[idx];
    this.board[idx] = null;
    if (p && p.type === "k") this.kings[p.color] = -1;
    return p;
  };

  /* Wird das Feld `idx` von Farbe `color` angegriffen? */
  Chess.prototype.attackedIdx = function (color, idx) {
    const b = this.board;
    // Bauern
    const pd = PAWN_DIR[color];
    for (const d of [pd - 1, pd + 1]) {
      const from = idx - d;
      if (!(from & 0x88) && b[from] && b[from].color === color && b[from].type === "p") return true;
    }
    for (const d of PIECE_OFFSETS.n) {
      const from = idx + d;
      if (!(from & 0x88) && b[from] && b[from].color === color && b[from].type === "n") return true;
    }
    for (const d of PIECE_OFFSETS.k) {
      const from = idx + d;
      if (!(from & 0x88) && b[from] && b[from].color === color && b[from].type === "k") return true;
    }
    for (const d of PIECE_OFFSETS.b) {
      let from = idx + d;
      while (!(from & 0x88)) {
        const p = b[from];
        if (p) { if (p.color === color && (p.type === "b" || p.type === "q")) return true; break; }
        from += d;
      }
    }
    for (const d of PIECE_OFFSETS.r) {
      let from = idx + d;
      while (!(from & 0x88)) {
        const p = b[from];
        if (p) { if (p.color === color && (p.type === "r" || p.type === "q")) return true; break; }
        from += d;
      }
    }
    return false;
  };
  Chess.prototype.isAttacked = function (sq, byColor) { return this.attackedIdx(byColor, sqIndex(sq)); };

  /* Alle Figuren der Farbe `color`, die das Feld `sq` angreifen (Feldnamen). */
  Chess.prototype.attackers = function (sq, color) {
    const idx = sqIndex(sq), out = [];
    for (let i = 0; i < 128; i++) {
      if (i & 0x88) continue;
      const p = this.board[i];
      if (!p || p.color !== color) continue;
      if (this.pieceAttacks(i, idx)) out.push(sqName(i));
    }
    return out;
  };
  Chess.prototype.pieceAttacks = function (from, to) {
    const p = this.board[from];
    if (!p) return false;
    const diff = to - from;
    if (p.type === "p") {
      const d = PAWN_DIR[p.color];
      return diff === d - 1 || diff === d + 1;
    }
    if (p.type === "n" || p.type === "k") return PIECE_OFFSETS[p.type].includes(diff);
    for (const d of PIECE_OFFSETS[p.type]) {
      let sq = from + d;
      while (!(sq & 0x88)) {
        if (sq === to) return true;
        if (this.board[sq]) break;
        sq += d;
      }
    }
    return false;
  };

  Chess.prototype.inCheckColor = function (color) {
    return this.kings[color] >= 0 && this.attackedIdx(swap(color), this.kings[color]);
  };
  Chess.prototype.in_check = function () { return this.inCheckColor(this.turnColor); };

  Chess.prototype.pseudoMoves = function (fromFilter) {
    const moves = [], us = this.turnColor, them = swap(us), b = this.board;
    const add = (from, to, flags, captured, promo) => {
      moves.push({ from, to, piece: b[from].type, color: us, captured: captured || undefined, promotion: promo || undefined, flags });
    };
    const addPawn = (from, to, flags, captured) => {
      if (rankOf(to) === 8 || rankOf(to) === 1) for (const pr of ["q", "r", "b", "n"]) add(from, to, flags | FLAGS.PROMOTION, captured, pr);
      else add(from, to, flags, captured);
    };
    for (let from = 0; from < 128; from++) {
      if (from & 0x88) continue;
      if (fromFilter >= 0 && from !== fromFilter) continue;
      const p = b[from];
      if (!p || p.color !== us) continue;
      if (p.type === "p") {
        const d = PAWN_DIR[us];
        const one = from + d;
        if (!(one & 0x88) && !b[one]) {
          addPawn(from, one, FLAGS.NORMAL);
          const startRank = us === "w" ? 2 : 7;
          const two = from + 2 * d;
          if (rankOf(from) === startRank && !b[two]) add(from, two, FLAGS.BIG_PAWN);
        }
        for (const dd of [d - 1, d + 1]) {
          const to = from + dd;
          if (to & 0x88) continue;
          if (b[to] && b[to].color === them) addPawn(from, to, FLAGS.CAPTURE, b[to].type);
          else if (to === this.ep) add(from, to, FLAGS.EP | FLAGS.CAPTURE, "p");
        }
      } else if (p.type === "n" || p.type === "k") {
        for (const d of PIECE_OFFSETS[p.type]) {
          const to = from + d;
          if (to & 0x88) continue;
          if (!b[to]) add(from, to, FLAGS.NORMAL);
          else if (b[to].color === them) add(from, to, FLAGS.CAPTURE, b[to].type);
        }
      } else {
        for (const d of PIECE_OFFSETS[p.type]) {
          let to = from + d;
          while (!(to & 0x88)) {
            if (!b[to]) add(from, to, FLAGS.NORMAL);
            else { if (b[to].color === them) add(from, to, FLAGS.CAPTURE, b[to].type); break; }
            to += d;
          }
        }
      }
    }
    // Rochade
    const k = this.kings[us];
    if (k >= 0 && (fromFilter < 0 || fromFilter === k) && !this.attackedIdx(them, k)) {
      if ((this.castling[us] & FLAGS.KSIDE) && !b[k + 1] && !b[k + 2] && b[k + 3] && b[k + 3].type === "r" && b[k + 3].color === us &&
          !this.attackedIdx(them, k + 1) && !this.attackedIdx(them, k + 2)) add(k, k + 2, FLAGS.KSIDE);
      if ((this.castling[us] & FLAGS.QSIDE) && !b[k - 1] && !b[k - 2] && !b[k - 3] && b[k - 4] && b[k - 4].type === "r" && b[k - 4].color === us &&
          !this.attackedIdx(them, k - 1) && !this.attackedIdx(them, k - 2)) add(k, k - 2, FLAGS.QSIDE);
    }
    return moves;
  };

  Chess.prototype.legalMoves = function (fromFilter) {
    const out = [], us = this.turnColor;
    for (const m of this.pseudoMoves(fromFilter === undefined ? -1 : fromFilter)) {
      this.makeMove(m);
      if (!this.inCheckColor(us)) out.push(m);
      this.undoMove();
    }
    return out;
  };

  Chess.prototype.makeMove = function (m) {
    const us = m.color, them = swap(us), b = this.board;
    this.hist.push({ m, castling: { w: this.castling.w, b: this.castling.b }, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove, kings: { w: this.kings.w, b: this.kings.b } });
    b[m.to] = b[m.from]; b[m.from] = null;
    if (m.flags & FLAGS.EP) b[m.to - PAWN_DIR[us]] = null;
    if (m.flags & FLAGS.PROMOTION) b[m.to] = { type: m.promotion, color: us };
    if (m.piece === "k") {
      this.kings[us] = m.to;
      if (m.flags & FLAGS.KSIDE) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
      if (m.flags & FLAGS.QSIDE) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
      this.castling[us] = 0;
    }
    for (const r of ROOKS[us]) if (m.from === r.sq) this.castling[us] &= ~r.flag;
    for (const r of ROOKS[them]) if (m.to === r.sq) this.castling[them] &= ~r.flag;
    this.ep = (m.flags & FLAGS.BIG_PAWN) ? m.from + PAWN_DIR[us] : -1;
    this.halfmove = (m.piece === "p" || (m.flags & FLAGS.CAPTURE)) ? 0 : this.halfmove + 1;
    if (us === "b") this.fullmove++;
    this.turnColor = them;
  };

  Chess.prototype.undoMove = function () {
    const h = this.hist.pop();
    if (!h) return null;
    const m = h.m, us = m.color, them = swap(us), b = this.board;
    this.turnColor = us;
    this.castling = h.castling; this.ep = h.ep; this.halfmove = h.halfmove; this.fullmove = h.fullmove; this.kings = h.kings;
    b[m.from] = { type: m.piece, color: us };
    b[m.to] = null;
    if (m.flags & FLAGS.EP) b[m.to - PAWN_DIR[us]] = { type: "p", color: them };
    else if (m.captured) b[m.to] = { type: m.captured, color: them };
    if (m.flags & FLAGS.KSIDE) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
    if (m.flags & FLAGS.QSIDE) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
    return m;
  };

  Chess.prototype.toSan = function (m, legal) {
    let san = "";
    if (m.flags & FLAGS.KSIDE) san = "O-O";
    else if (m.flags & FLAGS.QSIDE) san = "O-O-O";
    else {
      if (m.piece !== "p") {
        san += m.piece.toUpperCase();
        const same = (legal || this.legalMoves()).filter(x => x.piece === m.piece && x.to === m.to && x.from !== m.from);
        if (same.length) {
          const sameFile = same.some(x => (x.from & 7) === (m.from & 7));
          const sameRank = same.some(x => (x.from >> 4) === (m.from >> 4));
          if (!sameFile) san += FILES[m.from & 7];
          else if (!sameRank) san += rankOf(m.from);
          else san += sqName(m.from);
        }
      } else if (m.flags & FLAGS.CAPTURE) san += FILES[m.from & 7];
      if (m.flags & FLAGS.CAPTURE) san += "x";
      san += sqName(m.to);
      if (m.promotion) san += "=" + m.promotion.toUpperCase();
    }
    this.makeMove(m);
    if (this.in_check()) san += this.legalMoves().length ? "+" : "#";
    this.undoMove();
    return san;
  };

  Chess.prototype.verbose = function (m, legal) {
    let flags = "";
    if (m.flags & FLAGS.NORMAL) flags += "n";
    if (m.flags & FLAGS.CAPTURE) flags += "c";
    if (m.flags & FLAGS.BIG_PAWN) flags += "b";
    if (m.flags & FLAGS.EP) flags += "e";
    if (m.flags & FLAGS.PROMOTION) flags += "p";
    if (m.flags & FLAGS.KSIDE) flags += "k";
    if (m.flags & FLAGS.QSIDE) flags += "q";
    const v = { color: m.color, from: sqName(m.from), to: sqName(m.to), piece: m.piece, flags, san: this.toSan(m, legal) };
    if (m.captured) v.captured = m.captured;
    if (m.promotion) v.promotion = m.promotion;
    return v;
  };

  /* moves({square, verbose}) wie bei chess.js */
  Chess.prototype.moves = function (opts) {
    opts = opts || {};
    const filter = opts.square ? sqIndex(opts.square) : -1;
    const all = this.legalMoves();
    const list = filter >= 0 ? all.filter(m => m.from === filter) : all;
    return opts.verbose ? list.map(m => this.verbose(m, all)) : list.map(m => this.toSan(m, all));
  };

  /* move({from,to,promotion}) oder move("Sf3") – gibt den ausgeführten Zug (verbose) zurück oder null. */
  Chess.prototype.move = function (mv) {
    const all = this.legalMoves();
    let found = null;
    if (typeof mv === "string") {
      const clean = mv.replace(/[+#?!]/g, "");
      for (const m of all) if (this.toSan(m, all).replace(/[+#]/g, "") === clean) { found = m; break; }
    } else {
      const from = sqIndex(mv.from), to = sqIndex(mv.to);
      for (const m of all) {
        if (m.from !== from || m.to !== to) continue;
        if (m.promotion && mv.promotion && m.promotion !== mv.promotion) continue;
        if (m.promotion && !mv.promotion && m.promotion !== "q") continue;
        found = m; break;
      }
    }
    if (!found) return null;
    const v = this.verbose(found, all);
    this.makeMove(found);
    return v;
  };

  Chess.prototype.undo = function () {
    const m = this.undoMove();
    return m ? this.verbose(m) : null;
  };

  Chess.prototype.in_checkmate = function () { return this.in_check() && this.legalMoves().length === 0; };
  Chess.prototype.in_stalemate = function () { return !this.in_check() && this.legalMoves().length === 0; };
  Chess.prototype.insufficient_material = function () {
    const pieces = [];
    for (let i = 0; i < 128; i++) { if (i & 0x88) continue; if (this.board[i]) pieces.push({ ...this.board[i], sq: i }); }
    if (pieces.length <= 2) return true;
    if (pieces.length === 3) return pieces.some(p => p.type === "n" || p.type === "b");
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => p.type === "b");
      if (bishops.length === 2 && bishops[0].color !== bishops[1].color) {
        const col = i => ((i >> 4) + (i & 7)) & 1;
        return col(bishops[0].sq) === col(bishops[1].sq);
      }
    }
    return false;
  };
  Chess.prototype.positionKey = function () { return this.fen().split(" ").slice(0, 4).join(" "); };
  Chess.prototype.in_threefold_repetition = function () {
    const key = this.positionKey();
    let count = 1;
    const undone = [];
    while (this.hist.length) {
      undone.push(this.undoMove());
      if (this.positionKey() === key) count++;
    }
    while (undone.length) this.makeMove(undone.pop());
    return count >= 3;
  };
  Chess.prototype.in_draw = function () {
    return this.halfmove >= 100 || this.in_stalemate() || this.insufficient_material() || this.in_threefold_repetition();
  };
  Chess.prototype.game_over = function () { return this.in_checkmate() || this.in_draw(); };
  Chess.prototype.history = function (opts) {
    const verbose = opts && opts.verbose;
    const moves = this.hist.map(h => h.m);
    const undone = [];
    while (this.hist.length) undone.push(this.undoMove());
    const out = [];
    for (let i = undone.length - 1; i >= 0; i--) {
      const m = undone[i];
      out.push(verbose ? this.verbose(m) : this.toSan(m));
      this.makeMove(m);
    }
    return out;
  };
  Chess.prototype.pieces = function () {
    const out = [];
    for (let i = 0; i < 128; i++) { if (i & 0x88) continue; const p = this.board[i]; if (p) out.push({ type: p.type, color: p.color, square: sqName(i) }); }
    return out;
  };
  Chess.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of this.legalMoves()) { this.makeMove(m); n += this.perft(depth - 1); this.undoMove(); }
    return n;
  };
  Chess.SQUARES = [];
  for (let r = 8; r >= 1; r--) for (const f of FILES) Chess.SQUARES.push(f + r);
  Chess.START_FEN = START_FEN;
  Chess.sqName = sqName; Chess.sqIndex = sqIndex;
  return Chess;
});
