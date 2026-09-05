"use strict";
/* =====================================================
   Lauras Schach-Akademie – Hauptprogramm
   ===================================================== */
if (typeof Chess === "undefined" || typeof ChessAI === "undefined" || typeof PUZZLES === "undefined") {
  document.body.innerHTML = "<p style='padding:30px;font-family:sans-serif'>Die Schach-Module konnten nicht geladen werden.</p>";
  throw new Error("modules missing");
}

/* ---------- Konstanten ---------- */
const PIA_SVG = '<svg viewBox="0 0 60 60" width="54" height="54"><circle cx="30" cy="20" r="11" fill="#6C4BC4"/><circle cx="26" cy="18" r="2" fill="#fff"/><circle cx="34" cy="18" r="2" fill="#fff"/><circle cx="26" cy="18" r="1" fill="#35284E"/><circle cx="34" cy="18" r="1" fill="#35284E"/><path d="M26 24 q4 3 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 34 h20 l-3 14 h-14 z" fill="#6C4BC4"/><rect x="16" y="48" width="28" height="7" rx="3" fill="#523699"/><path d="M22 31 h16" stroke="#FFB933" stroke-width="4" stroke-linecap="round"/></svg>';
const PIECEVAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const GLYPH = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const STORAGE_KEY = "lauras-schach-akademie.v2";
const THEME_ORDER = PUZZLES.ORDER, THEMES = PUZZLES.THEMES;
const TOTAL_PUZZLES = THEME_ORDER.reduce((n, t) => n + THEMES[t].list.length, 0);
const LEVELS = [
  { id: 1, name: "Küken", emoji: "🐣", engine: "builtin", depth: 1, blunder: 0.45, maxNodes: 3000, desc: "Robi macht viele Fehler" },
  { id: 2, name: "Bauer", emoji: "♙", engine: "builtin", depth: 1, blunder: 0.25, maxNodes: 6000, desc: "Robi schnappt gern Figuren" },
  { id: 3, name: "Springer", emoji: "♘", engine: "builtin", depth: 2, blunder: 0.12, maxNodes: 30000, desc: "Robi denkt einen Zug voraus" },
  { id: 4, name: "Läufer", emoji: "♗", engine: "builtin", depth: 3, blunder: 0.05, maxNodes: 120000, desc: "Robi denkt zwei Züge voraus" },
  { id: 5, name: "Turm", emoji: "♖", engine: "stockfish", depth: 2, multipv: 4, window: 150, blunder: 0.08, skill: 0, fallbackDepth: 3, desc: "Stockfish – ganz sanft" },
  { id: 6, name: "Dame", emoji: "♕", engine: "stockfish", depth: 5, multipv: 3, window: 60, blunder: 0.02, skill: 3, fallbackDepth: 3, desc: "Stockfish – schon knifflig" },
  { id: 7, name: "König", emoji: "♔", engine: "stockfish", depth: 8, multipv: 1, window: 0, blunder: 0, skill: 8, fallbackDepth: 4, desc: "Stockfish – für Profis" },
  { id: 8, name: "Großmeister", emoji: "👑", engine: "stockfish", depth: 12, multipv: 1, window: 0, blunder: 0, skill: 15, fallbackDepth: 4, desc: "Stockfish – richtig stark" }
];
const DESIGNS = [
  { id: "classic", name: "Klassik", emoji: "🌿", need: 0, l: "#F2E8CF", d: "#8FA86F" },
  { id: "einhorn", name: "Einhorn-Rosa", emoji: "🦄", need: 5, l: "#FFE3F1", d: "#F48FB1" },
  { id: "weltraum", name: "Weltraum", emoji: "🚀", need: 10, l: "#3B3F6B", d: "#1B1D3A" },
  { id: "wald", name: "Zauberwald", emoji: "🌲", need: 15, l: "#E6D8B5", d: "#4F7A3A" },
  { id: "meer", name: "Ozean", emoji: "🐬", need: 20, l: "#E0F4FF", d: "#3E8CC7" },
  { id: "gold", name: "Gold-Edition", emoji: "🏆", need: 25, l: "#FFF5CC", d: "#C99A2E" }
];
const BONUS_STICKERS = [
  { id: "erster-sieg", emoji: "🏆", name: "Erster Sieg", how: "Gewinne eine Partie gegen Robi" },
  { id: "turm-meister", emoji: "🏰", name: "Turm-Meisterin", how: "Gewinne 3 Turm-Endspiele" },
  { id: "tagesmission", emoji: "🎯", name: "Missions-Profi", how: "Schaffe eine Tagesmission" },
  { id: "duell", emoji: "👨‍👩‍👧", name: "Familien-Champion", how: "Spiele ein Familien-Duell" }
];

/* ---------- Zustand & Speicherung ---------- */
function defaultState() {
  return {
    v: 2, name: "Laura", stars: {}, wins: 0, winsEnd: 0, winsFull: 0, losses: 0, duels: 0,
    rewardCredits: 0, sessions: 0, log: [], daily: { d: null, puzzles: [], wins: 0, claimed: false },
    srs: {}, stickers: [], design: "classic", level: 1, lastResults: [], hints: 0, seenDesigns: ["classic"]
  };
}
let S = defaultState();
let storageOk = false;
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    storageOk = true;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2) S = Object.assign(defaultState(), parsed);
    }
  } catch (e) { storageOk = false; }
  for (const t of THEME_ORDER) if (!Array.isArray(S.stars[t])) S.stars[t] = [];
  // Laufzeit-Felder nie aus der Speicherung übernehmen
  S.sessionRunning = false; S.sessionSec = 30 * 60; S.screen = "start";
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
}
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
function currentLog() {
  let e = S.log[S.log.length - 1];
  if (!e || e.s !== S.sessions) { e = { d: todayKey(), s: S.sessions, stars: 0, puzzles: 0, wins: 0, min: 0 }; S.log.push(e); }
  return e;
}
const totalStars = () => THEME_ORDER.reduce((n, t) => n + S.stars[t].length, 0);
const themeDone = t => S.stars[t].length >= THEMES[t].list.length;
const themeUnlocked = i => i === 0 || S.stars[THEME_ORDER[i - 1]].length >= 3;

/* ---------- Sounds ---------- */
let AC = null;
function beep(freq, dur, type) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.value = .08; o.connect(g); g.connect(AC.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur);
  } catch (e) { }
}
const sndMove = () => beep(440, .08, "triangle");
const sndCapture = () => beep(300, .12, "square");
const sndGood = () => { beep(523, .1); setTimeout(() => beep(659, .12), 90); setTimeout(() => beep(784, .18), 200); };
const sndBad = () => beep(180, .25, "sawtooth");
const SND = { move: sndMove, capture: sndCapture, good: sndGood, bad: sndBad };

/* ---------- Hilfen ---------- */
const $ = id => document.getElementById(id);
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function deSan(san) { return san.replace(/[KQRBN]/g, c => ({ K: "K", Q: "D", R: "T", B: "L", N: "S" })[c]); }
function pieceName(t) { return { p: "einen Bauern", n: "einen Springer", b: "einen Läufer", r: "einen Turm", q: "die Dame", k: "den König" }[t]; }
function pieceNom(t) { return { p: "Der Bauer", n: "Der Springer", b: "Der Läufer", r: "Der Turm", q: "Die Dame", k: "Der König" }[t]; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function setBubble(id, html, kind) { const b = $(id); b.innerHTML = html; b.className = "bubble" + (kind ? " " + kind : ""); }
let toastTimer = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600); }

/* ---------- Bildschirme ---------- */
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $("scr-" + id).classList.add("active");
  S.screen = id;
  window.scrollTo(0, 0);
}
function route(where) {
  stopReward();
  if (where === "home") { refreshHome(); show("home"); }
  else if (where === "puzzles") { refreshPuzzleMenu(); show("puzzlemenu"); }
  else if (where === "review") startReview();
  else if (where === "mistakes") { renderMistakes(); show("mistakes"); }
  else if (where === "endgame") startEndgame();
  else if (where === "fullgame") chooseLevel();
  else if (where === "duel") startDuelSetup();
  else if (where === "reward") tryStartReward();
  else if (where === "album") { renderAlbum(); show("album"); }
  else if (where === "designs") { renderDesigns(); show("designs"); }
  else if (where === "certificate") { renderCertificate("week"); show("certificate"); }
  else if (where === "parents") { renderParents(); show("parents"); }
}
document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => route(el.dataset.go)));

/* ---------- Overlay ---------- */
const ov = $("overlay");
function openOverlay(emoji, title, text, buttons, extraHtml) {
  $("ovEmoji").textContent = emoji;
  $("ovTitle").textContent = title;
  $("ovText").innerHTML = text;
  $("ovExtra").innerHTML = extraHtml || "";
  const row = $("ovButtons"); row.innerHTML = "";
  buttons.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "btn " + (b.style || "honey"); btn.textContent = b.label;
    btn.onclick = () => { closeOverlay(); b.fn && b.fn(); };
    row.appendChild(btn);
  });
  ov.classList.add("show");
}
function closeOverlay() { ov.classList.remove("show"); }

/* ---------- Sitzungs-Timer (30 Minuten) ---------- */
S.sessionSec = 30 * 60; S.sessionRunning = false;
const clockEl = $("sessionClock");
setInterval(() => {
  if (!S.sessionRunning) return;
  S.sessionSec--;
  if (S.sessionSec % 60 === 0) { currentLog().min++; save(); }
  const m = Math.max(0, Math.floor(S.sessionSec / 60)), s = Math.max(0, S.sessionSec % 60);
  clockEl.textContent = m + ":" + String(s).padStart(2, "0");
  if (S.sessionSec <= 300) clockEl.classList.add("low");
  if (S.sessionSec <= 0) { S.sessionRunning = false; sessionOver(); }
}, 1000);
function sessionOver() {
  openOverlay("🌸", "Pause, " + S.name + "!", "Du hast heute 30 Minuten super trainiert. Dein Gehirn lernt jetzt beim Ausruhen weiter!", [{ label: "Okay! 👋", fn: closeOverlay }]);
}

/* ---------- Tagesmission ---------- */
function daily() {
  const t = todayKey();
  if (S.daily.d !== t) S.daily = { d: t, puzzles: [], wins: 0, claimed: false };
  return S.daily;
}
function dailyPuzzleSolved(id) {
  const d = daily();
  if (!d.puzzles.includes(id)) d.puzzles.push(id);
  checkDaily();
}
function dailyWin() { daily().wins++; checkDaily(); }
function checkDaily() {
  const d = daily();
  if (!d.claimed && d.puzzles.length >= 3 && d.wins >= 1) {
    d.claimed = true; S.rewardCredits++;
    awardSticker("tagesmission");
    save();
    setTimeout(() => openOverlay("🎯", "Tagesmission geschafft!", "3 Rätsel gelöst und eine Partie gewonnen – du bekommst ein <b>Extra-Belohnungsticket</b>! 🎟️", [{ label: "Super! 🎉", fn: null }]), 1800);
  }
}
function renderMission() {
  const d = daily();
  const p = Math.min(3, d.puzzles.length), w = Math.min(1, d.wins);
  const tp = $("taskPuzzles"), tw = $("taskWin");
  tp.querySelector(".cnt").textContent = p + "/3"; tp.querySelector(".bar div").style.width = (p / 3 * 100) + "%"; tp.classList.toggle("done", p >= 3);
  tw.querySelector(".cnt").textContent = w + "/1"; tw.querySelector(".bar div").style.width = (w * 100) + "%"; tw.classList.toggle("done", w >= 1);
  $("missionBox").classList.toggle("complete", d.claimed);
  $("missionText").textContent = d.claimed ? "Geschafft! Dein Extra-Ticket wartet beim Belohnungs-Spiel. 🎟️" : "Schaffst du beides, gibt es ein Extra-Belohnungsticket! 🎟️";
}

/* ---------- Home ---------- */
function refreshHome() {
  const stars = totalStars();
  $("starsPuzzles").textContent = "⭐ " + stars;
  $("starsEnd").textContent = "🏆 " + S.winsEnd;
  $("starsFull").textContent = "🏆 " + S.winsFull;
  $("starsDuel").textContent = "🤝 " + S.duels;
  const themesDone = THEME_ORDER.filter(themeDone).length;
  $("xplabel").textContent = "Weg zum Turmdiplom: " + stars + "/" + TOTAL_PUZZLES + " ⭐ · " + themesDone + "/" + THEME_ORDER.length + " Themen · " + S.wins + " 🏆";
  $("xpbar").style.width = Math.min(100, Math.round(stars / TOTAL_PUZZLES * 100)) + "%";
  const lock = $("rewardLock"), hint = $("rewardHint");
  if (S.rewardCredits > 0) { lock.textContent = "🎟️ " + S.rewardCredits; hint.textContent = "Du hast " + (S.rewardCredits === 1 ? "eine Belohnung" : S.rewardCredits + " Belohnungen") + " frei!"; }
  else { lock.textContent = "🔒"; hint.textContent = "Gewinne eine Partie oder ein ganzes Thema!"; }
  const due = duePuzzles();
  $("tile-review").style.display = due.length ? "" : "none";
  $("reviewCount").textContent = "🔁 " + due.length;
  $("reviewHint").textContent = due.length === 1 ? "Ein Rätsel möchte nochmal geübt werden" : due.length + " Rätsel möchten nochmal geübt werden";
  const lvl = LEVELS.find(l => l.id === S.level) || LEVELS[0];
  $("robiHint").textContent = "Stufe " + lvl.id + " " + lvl.emoji + " " + lvl.name + " – Pia hilft dir";
  $("albumCount").textContent = S.stickers.length + "/" + (THEME_ORDER.length + BONUS_STICKERS.length);
  $("designCount").textContent = DESIGNS.filter(d => stars >= d.need).length + "/" + DESIGNS.length;
  renderMission();
  const msgs = ["Was möchtest du üben, " + S.name + "?", "Weiter so, Champion! 💪", "Jeder Zug macht dich stärker!", "Schon " + stars + " Sterne gesammelt! ⭐"];
  if (due.length) msgs.push("Ein paar Rätsel warten auf eine Wiederholung – das macht dich richtig sicher! 🔁");
  $("homeBubble").innerHTML = rnd(msgs);
  save();
}
$("btnGo").addEventListener("click", () => {
  if (!S.sessionRunning) { S.sessions++; currentLog(); }
  S.sessionRunning = true; refreshHome(); show("home"); sndGood(); save();
});

/* =====================================================
   BRETT (gemeinsam)
   ===================================================== */
function renderBoard(el, game, opts) {
  el.innerHTML = "";
  const files = "abcdefgh";
  const checkSq = game.in_check() ? Chess.sqName(game.kings[game.turn()]) : null;
  for (let r = 8; r >= 1; r--) {
    for (let f = 0; f < 8; f++) {
      const sq = files[f] + r;
      const cell = document.createElement("div");
      cell.className = "sq " + (((f + r) % 2 === 0) ? "d" : "l");
      cell.dataset.sq = sq;
      const piece = game.get(sq);
      if (piece) {
        const p = document.createElement("span");
        p.className = "pc " + piece.color;
        p.textContent = GLYPH[piece.type];
        cell.appendChild(p);
      }
      if (opts.selected === sq) cell.classList.add("sel");
      if (opts.lastMove && (opts.lastMove.from === sq || opts.lastMove.to === sq)) cell.classList.add("last");
      if (opts.hl && opts.hl[sq]) cell.classList.add("hl-" + opts.hl[sq]);
      if (checkSq === sq) cell.classList.add("check");
      if (opts.targets && opts.targets.includes(sq)) {
        const m = document.createElement("div");
        m.className = piece ? "ring" : "dot";
        cell.appendChild(m);
      }
      if (r === 1) { const c = document.createElement("span"); c.className = "coord"; c.textContent = files[f]; cell.appendChild(c); }
      if (f === 7) { const c = document.createElement("span"); c.className = "coord"; c.style.top = "1px"; c.style.bottom = "auto"; c.textContent = r; cell.appendChild(c); }
      cell.addEventListener("pointerdown", () => opts.onTap && opts.onTap(sq));
      el.appendChild(cell);
    }
  }
}
function sqCenter(sq) { return { x: "abcdefgh".indexOf(sq[0]) + 0.5, y: 8 - parseInt(sq[1], 10) + 0.5 }; }
function drawArrow(svg, from, to, cls) {
  const a = sqCenter(from), b = sqCenter(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const ex = b.x - ux * 0.35, ey = b.y - uy * 0.35;
  const ns = "http://www.w3.org/2000/svg";
  const line = document.createElementNS(ns, "line");
  line.setAttribute("x1", a.x); line.setAttribute("y1", a.y); line.setAttribute("x2", ex); line.setAttribute("y2", ey);
  line.setAttribute("class", cls);
  svg.appendChild(line);
  const head = document.createElementNS(ns, "polygon");
  const hx = b.x - ux * 0.12, hy = b.y - uy * 0.12, w = 0.22;
  head.setAttribute("points", [hx, hy, ex - uy * w, ey + ux * w, ex + uy * w, ey - ux * w].join(","));
  head.setAttribute("fill", cls === "good" ? "var(--arrow-good)" : "var(--arrow)");
  svg.appendChild(head);
}
function clearArrows(svg) { svg.innerHTML = ""; }
/* Animiert eine Figur von from nach to (ohne den Spielzustand zu ändern), ruft danach cb auf. */
function animateMove(boardEl, from, to, cb) {
  const wrap = boardEl.parentElement;
  const fromCell = boardEl.querySelector('[data-sq="' + from + '"]'), toCell = boardEl.querySelector('[data-sq="' + to + '"]');
  const pc = fromCell && fromCell.querySelector(".pc");
  if (!fromCell || !toCell || !pc) { cb && cb(); return; }
  const ghost = document.createElement("div");
  ghost.className = "ghost-piece";
  ghost.innerHTML = pc.outerHTML;
  const w = fromCell.offsetWidth, h = fromCell.offsetHeight;
  ghost.style.width = w + "px"; ghost.style.height = h + "px";
  ghost.style.left = fromCell.offsetLeft + "px"; ghost.style.top = fromCell.offsetTop + "px";
  wrap.appendChild(ghost);
  pc.style.visibility = "hidden";
  const capturedPc = toCell.querySelector(".pc");
  requestAnimationFrame(() => {
    ghost.style.transform = "translate(" + (toCell.offsetLeft - fromCell.offsetLeft) + "px," + (toCell.offsetTop - fromCell.offsetTop) + "px)";
  });
  setTimeout(() => { if (capturedPc) capturedPc.style.visibility = "hidden"; }, 380);
  setTimeout(() => { ghost.remove(); cb && cb(); }, 560);
}

/* =====================================================
   RÄTSEL
   ===================================================== */
let PZ = { set: null, idx: 0, game: null, sel: null, targets: [], mode: "theme", queue: [], failed: false, solver: null, busy: false, lastWrong: null };

function renderThemeTiles() {
  const box = $("themeTiles"); box.innerHTML = "";
  THEME_ORDER.forEach((t, i) => {
    const T = THEMES[t], unlocked = themeUnlocked(i), n = S.stars[t].length;
    const el = document.createElement("div");
    el.className = "mode" + (unlocked ? "" : " locked");
    const fails = T.list.filter(p => S.srs[p.id] && S.srs[p.id].fails).length;
    el.innerHTML = '<div class="emoji">' + T.emoji + '</div><div><h3>' + T.title + '</h3><p>' + (unlocked ? T.short + (fails ? " · " + fails + " zum Wiederholen" : "") : "Löse erst 3 Aufgaben aus „" + THEMES[THEME_ORDER[i - 1]].title + "“") + '</p></div>' +
      '<div class="stars">' + (unlocked ? (themeDone(t) ? T.sticker.emoji + " " : "") + "⭐ " + n + "/" + T.list.length : "🔒") + '</div>';
    el.addEventListener("click", () => {
      if (!unlocked) { openOverlay("🔒", "Noch gesperrt", "Löse zuerst 3 Aufgaben aus „" + THEMES[THEME_ORDER[i - 1]].title + "“, dann geht es hier weiter!", [{ label: "Okay!", fn: null }]); return; }
      startPuzzleSet(t);
    });
    box.appendChild(el);
  });
}
function refreshPuzzleMenu() {
  renderThemeTiles();
  const due = duePuzzles();
  $("puzzleMenuBubble").innerHTML = due.length ? "Such dir ein Thema aus – oder übe zuerst die <b>" + due.length + " Wiederholungen</b> vom Startbildschirm. 🔁" : "Such dir ein Thema aus! Jede gelöste Aufgabe gibt einen Stern. ⭐";
}
function startPuzzleSet(set) {
  PZ.mode = "theme"; PZ.set = set;
  PZ.idx = nextUnsolved(set, 0);
  loadPuzzle(); show("puzzle");
}
function nextUnsolved(set, start) {
  const n = THEMES[set].list.length;
  for (let i = 0; i < n; i++) { const k = (start + i) % n; if (!S.stars[set].includes(k)) return k; }
  return (start) % n;
}
function currentPuzzle() { return THEMES[PZ.set].list[PZ.idx]; }

/* --- Spaced Repetition --- */
function duePuzzles() {
  const out = [];
  for (const t of THEME_ORDER) THEMES[t].list.forEach((p, i) => { const e = S.srs[p.id]; if (e && e.due !== null && e.due !== undefined && e.due <= S.sessions) out.push({ set: t, idx: i, id: p.id }); });
  return out;
}
function srsFail(pz, san) {
  const e = S.srs[pz.id] || (S.srs[pz.id] = { fails: 0, ok: 0, due: null, history: [] });
  e.fails++;
  e.due = S.sessions + (e.fails >= 2 ? 3 : 2);      // nach 2–3 Sitzungen wieder
  e.history.push({ s: S.sessions, d: todayKey(), san });
  if (e.history.length > 20) e.history.shift();
  save();
}
function srsSuccess(pz) {
  const e = S.srs[pz.id];
  if (!e) return;
  e.ok++;
  e.due = PZ.failed ? S.sessions + 2 : null;          // erst nach fehlerfreier Lösung erledigt
  save();
}
function startReview() {
  const due = duePuzzles();
  if (!due.length) { toast("Keine Wiederholungen offen 🎉"); return; }
  PZ.mode = "review"; PZ.queue = due.slice(1);
  PZ.set = due[0].set; PZ.idx = due[0].idx;
  loadPuzzle(); show("puzzle");
}
function renderMistakes() {
  const box = $("mistakeList"); box.innerHTML = "";
  const rows = [];
  for (const t of THEME_ORDER) THEMES[t].list.forEach((p, i) => { const e = S.srs[p.id]; if (e && e.fails) rows.push({ t, i, p, e }); });
  rows.sort((a, b) => b.e.fails - a.e.fails);
  if (!rows.length) { box.innerHTML = '<div class="row"><span class="emoji">🌟</span><div>Noch keine Fehler – oder alle schon ausgebügelt!</div></div>'; return; }
  for (const r of rows) {
    const el = document.createElement("div"); el.className = "row";
    const last = r.e.history[r.e.history.length - 1];
    const due = r.e.due === null || r.e.due === undefined ? "erledigt ✅" : (r.e.due <= S.sessions ? "jetzt fällig 🔁" : "in " + (r.e.due - S.sessions) + " Sitzung" + (r.e.due - S.sessions === 1 ? "" : "en"));
    el.innerHTML = '<span class="emoji">' + THEMES[r.t].emoji + '</span><div style="flex:1"><b>' + THEMES[r.t].title + ' · Aufgabe ' + (r.i + 1) + '</b><div class="meta">' + r.e.fails + '× daneben' + (last ? ' · zuletzt ' + esc(deSan(last.san)) : '') + ' · ' + r.e.ok + '× richtig · Wiederholung: ' + due + '</div></div><button class="btn ghost small">Üben</button>';
    el.querySelector("button").addEventListener("click", () => { PZ.mode = "single"; PZ.set = r.t; PZ.idx = r.i; loadPuzzle(); show("puzzle"); });
    box.appendChild(el);
  }
}

/* --- Laden & Anzeigen --- */
function loadPuzzle() {
  const P = THEMES[PZ.set], pz = currentPuzzle();
  PZ.game = new Chess(pz.fen);
  PZ.sel = null; PZ.targets = []; PZ.failed = false; PZ.solver = null; PZ.busy = false; PZ.lastWrong = null;
  $("btnWhy").style.display = "none";
  clearArrows($("arrows"));
  const modeLabel = PZ.mode === "review" ? "🔁 Wiederholung · " : "";
  $("lessonbox").innerHTML = P.lesson +
    "<div style='margin-top:8px'><b>🎯 Ziel:</b> " + pz.goal + "</div>" +
    "<div style='margin-top:4px;opacity:.7'>" + modeLabel + "Aufgabe " + (PZ.idx + 1) + " von " + P.list.length + (S.stars[PZ.set].includes(PZ.idx) ? " · schon gelöst ⭐" : "") + "</div>";
  if (pz.goalType === "endgame") {
    setBubble("puzzleBubble", "Pia denkt nach… 🤔", "think");
    PZ.busy = true;
    drawPuzzle();
    setTimeout(() => {
      try { PZ.solver = new ChessAI.EndgameSolver(pz.fen); } catch (e) { console.error(e); }
      PZ.busy = false;
      setBubble("puzzleBubble", "Du spielst <b>Weiß</b>. Ich spiele Schwarz und versuche, deinen Bauern zu fangen. Bring ihn zur Umwandlung! 🏁");
      drawPuzzle();
    }, 50);
  } else {
    setBubble("puzzleBubble", "Du spielst <b>Weiß</b>. Finde den besten Zug! 🔍");
    drawPuzzle();
  }
}
function drawPuzzle(hl) {
  renderBoard($("board"), PZ.game, { onTap: puzzleTap, selected: PZ.sel, targets: PZ.targets, hl, lastMove: PZ.last });
}
function puzzleTap(sq) {
  if (PZ.busy) return;
  const g = PZ.game;
  if (g.turn() !== "w") return;
  const piece = g.get(sq);
  if (PZ.sel && PZ.targets.includes(sq)) { tryPuzzleMove(PZ.sel, sq); return; }
  if (piece && piece.color === "w") {
    PZ.sel = sq;
    PZ.targets = g.moves({ square: sq, verbose: true }).map(m => m.to);
  } else { PZ.sel = null; PZ.targets = []; }
  drawPuzzle();
}

/* --- Zugprüfung --- */
function tryPuzzleMove(from, to) {
  const pz = currentPuzzle();
  PZ.sel = null; PZ.targets = [];
  clearArrows($("arrows"));
  if (pz.goalType === "endgame") return tryEndgameMove(from, to);
  const mv = PZ.game.move({ from, to, promotion: "q" });
  if (!mv) { drawPuzzle(); return; }
  const isListed = pz.solutions.some(s => s.from === from && s.to === to);
  let solved;
  if (pz.goalType === "mate1") solved = PZ.game.in_checkmate();
  else solved = isListed;
  if (solved) return puzzleSuccess(mv, isListed);
  // ---- Fehler: Pia zeigt, warum ----
  sndBad();
  PZ.failed = true;
  srsFail(pz, mv.san);
  PZ.lastWrong = { from, to, san: mv.san };
  PZ.last = { from, to };
  drawPuzzle({ [to]: "bad" });
  showWhy(mv);
}
function refutation(mv) {
  const pz = currentPuzzle();
  const custom = pz.explain && pz.explain[mv.from + mv.to];
  const g = PZ.game;                     // Schwarz am Zug
  let reply = null;
  if (!g.game_over()) {
    const r = ChessAI.analyse(g, 3, { maxNodes: 60000 });
    reply = r.length ? r[0].move : null;
  }
  let text;
  if (custom) text = custom;
  else if (g.in_checkmate()) text = "Das wäre sogar matt – aber nicht das Ziel dieser Aufgabe.";
  else if (g.in_stalemate()) text = "Patt! Schwarz kann nicht mehr ziehen und steht nicht im Schach – das ist nur Remis.";
  else if (!reply) text = "Das führt nicht zum Ziel.";
  else if (pz.goalType === "mate1" && g.in_check()) {
    text = "Das ist Schach, aber noch <b>kein Matt</b>: " + (reply.captured ? "Schwarz schlägt einfach " + pieceName(reply.captured) + " (" + deSan(reply.san) + ")." : "Der König entkommt mit " + deSan(reply.san) + ".");
  } else if (pz.goalType === "mate1") {
    text = "Das ist nicht einmal Schach – der König hat alle Zeit der Welt. Schwarz spielt z. B. <b>" + deSan(reply.san) + "</b>.";
  } else if (reply.captured) {
    text = "Schwarz antwortet <b>" + deSan(reply.san) + "</b> und schlägt " + pieceName(reply.captured) + ".";
  } else if (reply.piece === "k") {
    text = "Der König zieht einfach nach " + reply.to + " (<b>" + deSan(reply.san) + "</b>) – nichts gewonnen.";
  } else if (g.isAttacked(reply.from, "w")) {
    text = "Schwarz antwortet <b>" + deSan(reply.san) + "</b> und bringt " + pieceName(reply.piece) + " in Sicherheit.";
  } else {
    text = "Schwarz antwortet <b>" + deSan(reply.san) + "</b> – und du hast nichts gewonnen.";
  }
  return { reply, text };
}
function showWhy(mv) {
  PZ.busy = true;
  const { reply, text } = refutation(mv);
  setBubble("puzzleBubble", "Hmm, <b>" + deSan(mv.san) + "</b>? " + text + " <b>Versuch es nochmal!</b> 💪", "warn");
  const finish = () => {
    setTimeout(() => {
      PZ.game.undo(); if (reply) { /* Antwort wurde nur animiert, nicht ausgeführt */ }
      PZ.last = null; PZ.busy = false;
      $("btnWhy").style.display = "";
      drawPuzzle();
    }, 1500);
  };
  if (reply) {
    const svg = $("arrows");
    drawArrow(svg, reply.from, reply.to, "bad");
    setTimeout(() => animateMove($("board"), reply.from, reply.to, () => {
      PZ.game.move(reply); drawPuzzle({ [reply.to]: "bad" }); drawArrow(svg, reply.from, reply.to, "bad");
      setTimeout(() => { PZ.game.undo(); clearArrows(svg); finish(); }, 900);
    }), 350);
  } else finish();
}
$("btnWhy").addEventListener("click", () => {
  if (PZ.busy || !PZ.lastWrong) return;
  const mv = PZ.game.move({ from: PZ.lastWrong.from, to: PZ.lastWrong.to, promotion: "q" });
  if (!mv) return;
  PZ.last = { from: mv.from, to: mv.to };
  drawPuzzle({ [mv.to]: "bad" });
  showWhy(mv);
});
function puzzleSuccess(mv, isListed) {
  const pz = currentPuzzle();
  sndGood();
  PZ.busy = true;
  PZ.last = { from: mv.from, to: mv.to };
  drawPuzzle({ [mv.to]: "good" });
  drawArrow($("arrows"), mv.from, mv.to, "good");
  const first = !S.stars[PZ.set].includes(PZ.idx);
  if (first) { S.stars[PZ.set].push(PZ.idx); currentLog().stars++; }
  currentLog().puzzles++;
  dailyPuzzleSolved(pz.id);
  srsSuccess(pz);
  save();
  const isMate = PZ.game.in_checkmate();
  let msg = (isMate ? "<b>Schachmatt!</b> " : "<b>Genau richtig!</b> ") + "<b>" + deSan(mv.san) + "</b> – " + (pz.success || "");
  if (pz.goalType === "mate1" && pz.solutions.length > 1) msg += (isListed ? " (Einer von " + pz.solutions.length + " Wegen zum Matt! 🤩)" : " (Sogar ein Weg, den ich nicht auf dem Zettel hatte! 🤯)");
  msg += " ⭐ " + (first ? "Ein neuer Stern für dich!" : "Super gelöst!");
  setBubble("puzzleBubble", msg, "cheer");
  setTimeout(() => { PZ.busy = false; afterPuzzleSolved(); }, 2600);
}
function afterPuzzleSolved() {
  clearArrows($("arrows"));
  PZ.last = null;
  if (PZ.mode === "review") {
    if (PZ.queue.length) { const n = PZ.queue.shift(); PZ.set = n.set; PZ.idx = n.idx; loadPuzzle(); }
    else openOverlay("🔁", "Wiederholung geschafft!", "Alle fälligen Rätsel nochmal gelöst. So bleibt das Wissen im Kopf! 🧠", [{ label: "Weiter", fn: () => route("home") }]);
    return;
  }
  if (PZ.mode === "single") { renderMistakes(); show("mistakes"); return; }
  const list = THEMES[PZ.set].list;
  if (themeDone(PZ.set)) {
    const T = THEMES[PZ.set];
    const newSticker = awardSticker(PZ.set);
    if (newSticker) {
      S.rewardCredits++; save();
      openOverlay(T.sticker.emoji, "Thema geschafft!", "Du hast alle „" + T.title + "“-Aufgaben gelöst! Dafür gibt es die Sammelfigur <b>" + T.sticker.name + "</b> fürs Album und ein Belohnungs-Spiel! 🕹️",
        [{ label: "Belohnung spielen! 🕹️", fn: tryStartReward },
         { label: "Ins Album schauen 📒", style: "ghost", fn: () => route("album") },
         { label: "Weiter trainieren", style: "ghost", fn: () => { refreshPuzzleMenu(); show("puzzlemenu"); } }]);
      checkDiplom();
    } else {
      openOverlay("🏅", "Alles gelöst!", "Dieses Thema hast du komplett – suche dir ein neues aus!", [{ label: "Zu den Themen", fn: () => { refreshPuzzleMenu(); show("puzzlemenu"); } }]);
    }
  } else {
    PZ.idx = nextUnsolved(PZ.set, PZ.idx + 1);
    loadPuzzle();
  }
}
$("btnHint").addEventListener("click", () => {
  if (PZ.busy) return;
  const pz = currentPuzzle();
  S.hints++;
  let sol = pz.solutions[0];
  if (pz.goalType === "endgame" && PZ.solver) { const w = PZ.solver.fastestWin(PZ.game); if (w) sol = w; }
  setBubble("puzzleBubble", "💡 " + pz.tip);
  PZ.sel = sol.from;
  PZ.targets = PZ.game.moves({ square: sol.from, verbose: true }).map(m => m.to);
  drawPuzzle();
});
$("btnPuzzleBack").addEventListener("click", () => { PZ.busy = false; if (PZ.mode === "review") route("home"); else route("puzzles"); });

/* --- Bauernendspiele (mehrzügig, solver-gesteuert) --- */
function tryEndgameMove(from, to) {
  const pz = currentPuzzle(), g = PZ.game, solver = PZ.solver;
  if (!solver) { drawPuzzle(); return; }
  const results = solver.moveResults(g);
  const res = results.find(r => r.move.from === from && r.move.to === to && (!r.move.promotion || r.move.promotion === "q"));
  const mv = g.move({ from, to, promotion: "q" });
  if (!mv) { drawPuzzle(); return; }
  PZ.last = { from, to };
  mv.captured ? sndCapture() : sndMove();
  if (res && res.value === "win") {
    if (mv.promotion) { return puzzleSuccess(mv, true); }
    if (g.in_checkmate()) return puzzleSuccess(mv, true);
    drawPuzzle();
    PZ.busy = true;
    const reply = solver.defend(g);
    setBubble("puzzleBubble", rnd(["Guter Zug! Ich versuche es trotzdem… 🏃", "Hm, du bleibst auf Kurs. Mal sehen! 🤔", "Richtig! Ich rücke näher… 👀"]));
    setTimeout(() => animateMove($("board"), reply.from, reply.to, () => {
      g.move(reply); PZ.last = { from: reply.from, to: reply.to }; PZ.busy = false;
      if (g.in_stalemate()) { setBubble("puzzleBubble", "Patt?! Das sollte nicht passieren…", "warn"); }
      drawPuzzle();
    }), 400);
    return;
  }
  // Fehler: Gewinn verschenkt
  sndBad(); PZ.failed = true; srsFail(pz, mv.san);
  PZ.lastWrong = { from, to, san: mv.san };
  PZ.busy = true;
  drawPuzzle({ [to]: "bad" });
  const reply = solver.defend(g);
  let why;
  if (g.in_stalemate()) why = "Patt! Schwarz kann nicht ziehen und steht nicht im Schach – nur Remis.";
  else if (!reply) why = "So kommt der Bauer nicht durch.";
  else {
    g.move(reply);
    const afterStale = g.in_stalemate();
    const canCatch = g.pieces().some(p => p.type === "p") && g.moves({ verbose: true }).length === 0;
    g.undo();
    why = afterStale ? "Nach <b>" + deSan(reply.san) + "</b> ist es Patt – Remis!" :
      "Nach <b>" + deSan(reply.san) + "</b> " + (reply.captured ? "ist der Bauer weg." : "hält der schwarze König den Bauern auf – er kommt nicht mehr durch.");
    void canCatch;
  }
  setBubble("puzzleBubble", "Hmm, <b>" + deSan(mv.san) + "</b> verschenkt den Gewinn. " + why + " <b>Nochmal!</b> 💪", "warn");
  const svg = $("arrows");
  const finish = () => setTimeout(() => { g.undo(); PZ.last = null; PZ.busy = false; clearArrows(svg); $("btnWhy").style.display = "none"; drawPuzzle(); }, 1500);
  if (reply) {
    drawArrow(svg, reply.from, reply.to, "bad");
    setTimeout(() => animateMove($("board"), reply.from, reply.to, () => { g.move(reply); drawPuzzle({ [reply.to]: "bad" }); drawArrow(svg, reply.from, reply.to, "bad"); setTimeout(() => { g.undo(); finish(); }, 900); }), 350);
  } else finish();
}

/* ---------- Sticker ---------- */
function awardSticker(id) {
  if (S.stickers.includes(id)) return false;
  S.stickers.push(id); save();
  const def = THEMES[id] ? THEMES[id].sticker : BONUS_STICKERS.find(b => b.id === id);
  if (def) toast(def.emoji + " Neue Sammelfigur: " + def.name + "!");
  return true;
}
function renderAlbum() {
  const grid = $("albumGrid"); grid.innerHTML = "";
  const all = THEME_ORDER.map(t => ({ id: t, ...THEMES[t].sticker, how: "Löse alle „" + THEMES[t].title + "“-Rätsel" })).concat(BONUS_STICKERS);
  for (const st of all) {
    const has = S.stickers.includes(st.id);
    const el = document.createElement("div");
    el.className = "slot" + (has ? "" : " empty");
    el.innerHTML = '<div class="big">' + (has ? st.emoji : "❔") + '</div><b style="font-size:.8rem">' + (has ? st.name : "???") + '</b><small>' + (has ? "gesammelt ✅" : st.how) + '</small>';
    grid.appendChild(el);
  }
  const n = S.stickers.length, total = all.length;
  $("albumBubble").innerHTML = n === total ? "Das Album ist voll! Du bist eine echte Sammlerin! 🎉" : n === 0 ? "Noch ganz leer! Löse ein ganzes Thema für deine erste Sammelfigur. ✨" : n + " von " + total + " Figuren gesammelt. Die leeren Plätze warten auf dich! ✨";
}
function checkDiplom() {
  if (THEME_ORDER.every(themeDone) && !S.diplom) {
    S.diplom = todayKey(); save();
    setTimeout(() => openOverlay("🏰", "TURMDIPLOM!", "Alle Themen gemeistert! Du hast dir das Turmdiplom verdient – drucke deine Urkunde aus!", [{ label: "Urkunde ansehen 📜", fn: () => { renderCertificate("diplom"); show("certificate"); } }, { label: "Später", style: "ghost", fn: null }]), 400);
  }
}

/* =====================================================
   PARTIEN (Turm-Endspiel, Robi, Familien-Duell)
   ===================================================== */
let G = { game: null, mode: null, sel: null, targets: [], last: null, busy: false, pendingWarn: false, undosLeft: 99, level: null, names: null };
function helpLevel() { return S.winsFull < 2 ? 1 : (S.winsFull < 4 ? 2 : 3); }
function recommendedLevel() {
  const w = S.winsFull, last = S.lastResults.slice(-3);
  let lvl = Math.min(8, 1 + Math.floor(w / 2));
  if (last.length >= 2 && last.every(r => r === "L")) lvl = Math.max(1, lvl - 1);
  return lvl;
}
function chooseLevel() {
  const rec = recommendedLevel();
  let html = '<div class="levelgrid">';
  for (const l of LEVELS) html += '<button data-lvl="' + l.id + '" class="' + (l.id === S.level ? "active" : "") + (l.id === rec ? " rec" : "") + '">' + l.emoji + " " + l.id + " " + l.name + '<small>' + l.desc + (l.id === rec ? " · empfohlen" : "") + '</small></button>';
  html += "</div>";
  openOverlay("🤖", "Wie stark soll Robi sein?", "Wähle eine Stufe. Ab Stufe 5 spielt Robi mit der <b>Stockfish</b>-Engine (Internet nötig).", [{ label: "Los geht's!", fn: () => startFullGame(S.level) }, { label: "Abbrechen", style: "ghost", fn: null }], html);
  $("ovExtra").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    S.level = parseInt(b.dataset.lvl, 10); save();
    $("ovExtra").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
  }));
}
function startEndgame() {
  G = { game: new Chess("4k3/8/8/8/8/8/8/R3K3 w - - 0 1"), mode: "end", sel: null, targets: [], last: null, busy: false, pendingWarn: false, undosLeft: 99, level: { engine: "builtin", depth: 2, blunder: 0, maxNodes: 40000, window: 30 } };
  $("turnbar").style.display = "none"; $("levelBadge").textContent = "";
  setBubble("gameBubble", "<b>Turm-Endspiel:</b> Sperre den schwarzen König mit dem Turm ein und hilf mit deinem König. Du schaffst das! 🏰");
  drawGame(); show("game");
}
function startFullGame(levelId) {
  const level = LEVELS.find(l => l.id === levelId) || LEVELS[0];
  G = { game: new Chess(), mode: "full", sel: null, targets: [], last: null, busy: false, pendingWarn: false, undosLeft: helpLevel() < 3 ? 99 : 1, level };
  $("turnbar").style.display = "none";
  $("levelBadge").textContent = level.emoji + " Stufe " + level.id;
  const lvl = helpLevel();
  const intro = lvl === 1 ? "Ich warne dich vor gefährlichen Zügen und du darfst sie zurücknehmen. 🤗" :
    lvl === 2 ? "Ich sage dir nach deinem Zug, was ich denke. Zurücknehmen geht noch!" :
      "Jetzt spielst du wie die Großen – ich analysiere erst nach der Partie! 🦁";
  setBubble("gameBubble", "<b>Partie gegen Robi (" + level.name + ")!</b> Du bist Weiß. " + intro);
  drawGame(); show("game");
  if (level.engine === "stockfish") ensureStockfish();
}
function startDuelSetup() {
  const html = '<div style="text-align:left"><label style="font-size:.85rem">⬜ Weiß</label><input type="text" id="duelW" value="' + esc(S.name) + '" maxlength="14"><label style="font-size:.85rem;margin-top:8px;display:block">⬛ Schwarz</label><input type="text" id="duelB" value="' + esc(S.duelOpponent || "Mama") + '" maxlength="14"></div>';
  openOverlay("👨‍👩‍👧", "Familien-Duell", "Zwei Spieler an einem Gerät. Pia kommentiert beide Seiten – ohne Zurücknehmen!", [
    { label: "Los geht's!", fn: () => { const w = $("duelW").value.trim() || S.name, b = $("duelB").value.trim() || "Schwarz"; S.duelOpponent = b; save(); startDuel(w, b); } },
    { label: "Abbrechen", style: "ghost", fn: null }], html);
}
function startDuel(wName, bName) {
  G = { game: new Chess(), mode: "duel", sel: null, targets: [], last: null, busy: false, pendingWarn: false, undosLeft: 0, level: null, names: { w: wName, b: bName } };
  $("turnbar").style.display = "flex"; $("levelBadge").textContent = "";
  $("tbWhite").textContent = "⬜ " + wName; $("tbBlack").textContent = "⬛ " + bName;
  setBubble("gameBubble", "<b>" + esc(wName) + "</b> spielt Weiß, <b>" + esc(bName) + "</b> spielt Schwarz. Weiß beginnt – viel Spaß euch beiden! 🎉");
  drawGame(); show("game");
}
function drawGame() {
  renderBoard($("board2"), G.game, { onTap: gameTap, selected: G.sel, targets: G.targets, lastMove: G.last });
  $("btnUndo").style.display = G.undosLeft > 0 && G.mode !== "duel" ? "" : "none";
  if (G.mode === "duel") { $("tbWhite").classList.toggle("on", G.game.turn() === "w"); $("tbBlack").classList.toggle("on", G.game.turn() === "b"); }
}
function gameTap(sq) {
  if (G.busy || G.pendingWarn) return;
  const g = G.game;
  const humanColor = G.mode === "duel" ? g.turn() : "w";
  if (g.turn() !== humanColor) return;
  const piece = g.get(sq);
  if (G.sel && G.targets.includes(sq)) { playerMove(G.sel, sq); return; }
  if (piece && piece.color === humanColor) {
    G.sel = sq; G.targets = g.moves({ square: sq, verbose: true }).map(m => m.to);
  } else { G.sel = null; G.targets = []; }
  drawGame();
}
function playerMove(from, to) {
  const g = G.game;
  const mv = g.move({ from, to, promotion: "q" });
  if (!mv) return;
  G.sel = null; G.targets = []; G.last = { from, to };
  mv.captured ? sndCapture() : sndMove();
  drawGame();
  if (checkGameEnd()) return;
  const danger = analyzeDanger(g);
  if (G.mode === "duel") {
    const who = G.names[mv.color], next = G.names[g.turn()];
    if (danger) setBubble("gameBubble", "Vorsicht, " + esc(who) + ": " + danger.text + " Jetzt ist " + esc(next) + " dran.", "warn");
    else praiseMove(mv, who);
    return;
  }
  const lvl = helpLevel();
  if (danger && lvl <= 2) {
    G.pendingWarn = true;
    setBubble("gameBubble", "⚠️ <b>Vorsicht, " + S.name + "!</b> " + danger.text + " Möchtest du den Zug zurücknehmen?", "warn");
    $("warnRow").style.display = "flex";
    return;
  }
  if (danger && lvl === 3) setBubble("gameBubble", "Mutig! Aber pass auf: " + danger.text, "warn");
  else praiseMove(mv);
  aiTurn();
}
function praiseMove(mv, who) {
  const g = G.game, name = who ? esc(who) : "";
  const opp = G.mode === "duel" ? esc(G.names[g.turn()]) : "Robi";
  if (g.in_check()) { setBubble("gameBubble", "<b>Schach" + (name ? " von " + name : "") + "!</b> " + opp + "s König muss reagieren. 👏", "cheer"); return; }
  if (mv.captured) { setBubble("gameBubble", "Gut geschnappt" + (name ? ", " + name : "") + "! " + pieceName(mv.captured).replace(/^(einen|die|den) /, m => m) + " erobert. 😋", "cheer"); return; }
  const msgs = ["Solider Zug" + (name ? ", " + name : "") + "! 👍", "Weiter so – entwickle deine Figuren!", "Gut. Denk immer: Was will " + opp + " jetzt?", "Schön! Behalte deinen König im Auge."];
  setBubble("gameBubble", rnd(msgs));
}
/* Gefahr: kann der Gegner jetzt Material gewinnen oder matt setzen? */
function analyzeDanger(g) {
  let worst = 0, victim = null, mateThreat = false;
  const moves = g.moves({ verbose: true });
  for (const m of moves) {
    g.move(m);
    if (g.in_checkmate()) mateThreat = true;
    g.undo();
    if (m.captured) {
      let gain = PIECEVAL[m.captured];
      g.move(m);
      const recaps = g.moves({ verbose: true }).filter(r => r.to === m.to);
      g.undo();
      if (recaps.length) gain -= PIECEVAL[m.piece];
      if (gain > worst) { worst = gain; victim = m.captured; }
    }
  }
  const opp = G.mode === "duel" ? esc(G.names[g.turn()]) : "Robi";
  if (mateThreat) return { text: opp + " könnte <b>matt setzen</b>! Schau genau hin. 😱" };
  if (worst >= 3) return { text: opp + " kann " + pieceName(victim) + " <b>gewinnen</b>! 🙈" };
  return null;
}
$("btnTakeback").addEventListener("click", () => {
  G.game.undo(); G.pendingWarn = false; G.last = null;
  $("warnRow").style.display = "none";
  setBubble("gameBubble", "Gut, dass du nochmal nachdenkst! Das machen auch Großmeister. 🧠", "cheer");
  drawGame();
});
$("btnKeep").addEventListener("click", () => {
  G.pendingWarn = false;
  $("warnRow").style.display = "none";
  setBubble("gameBubble", "Okay, du bist die Chefin! Mal sehen, was passiert…");
  aiTurn();
});
$("btnUndo").addEventListener("click", () => {
  if (G.busy || G.pendingWarn) return;
  if (G.game.hist.length < 2) return;
  G.game.undo(); G.game.undo();
  if (helpLevel() >= 3) G.undosLeft--;
  G.last = null;
  setBubble("gameBubble", "Zug zurückgenommen. Neuer Versuch! 🔄");
  drawGame();
});

/* ---------- Robi (KI) ---------- */
const ENGINE = { sf: null, status: "idle", error: null };
function ensureStockfish() {
  if (ENGINE.status === "ready" || ENGINE.status === "loading") return ENGINE.promise;
  ENGINE.status = "loading";
  ENGINE.sf = new ChessAI.StockfishEngine();
  toast("Robi wärmt sich auf – Stockfish wird geladen…");
  ENGINE.promise = ENGINE.sf.load(15000).then(() => { ENGINE.status = "ready"; toast("Stockfish ist bereit! 🧠"); return ENGINE.sf; })
    .catch(e => { ENGINE.status = "failed"; ENGINE.error = e.message; toast("Stockfish nicht erreichbar – Robi spielt mit eingebauter KI."); throw e; });
  return ENGINE.promise;
}
async function robiMove(g, level) {
  const fallback = { engine: "builtin", depth: level.fallbackDepth || level.depth || 2, blunder: level.blunder, maxNodes: level.maxNodes || 120000, window: 20 };
  if (level.engine === "stockfish") {
    try {
      const sf = await ensureStockfish();
      const cands = await sf.candidates(g.fen(), { depth: level.depth, multipv: level.multipv || 1, skill: level.skill });
      const legal = g.moves({ verbose: true });
      const valid = cands.filter(c => legal.some(m => m.from === c.move.from && m.to === c.move.to));
      if (valid.length) {
        if (level.blunder && Math.random() < level.blunder) return ChessAI.chooseBuiltin(g, { depth: 1, blunder: 1, maxNodes: 3000 });
        const top = valid.filter(c => c.score >= valid[0].score - (level.window || 0));
        return rnd(top).move;
      }
    } catch (e) { /* Fallback unten */ }
  }
  return ChessAI.chooseBuiltin(g, fallback);
}
function aiTurn() {
  G.busy = true;
  const g = G.game, token = G;
  setTimeout(async () => {
    if (token !== G) return;
    if (g.game_over()) { G.busy = false; checkGameEnd(); return; }
    const m = await robiMove(g, G.level);
    if (token !== G) return;
    if (m) {
      const mv = g.move(m); G.last = { from: mv.from, to: mv.to };
      mv.captured ? sndCapture() : sndMove();
      if (mv.captured && !G.pendingWarn) setBubble("gameBubble", "Robi hat " + pieceName(mv.captured) + " geschlagen. Was ist dein Plan? 🤔");
      else if (g.in_check()) setBubble("gameBubble", "<b>Schach!</b> Dein König ist angegriffen – bring ihn in Sicherheit!", "warn");
    }
    G.busy = false; drawGame(); checkGameEnd();
  }, 550);
}

/* ---------- Partieende ---------- */
function checkGameEnd() {
  const g = G.game;
  if (!g.game_over()) return false;
  $("warnRow").style.display = "none";
  const again = () => G.mode === "end" ? startEndgame() : G.mode === "duel" ? startDuel(G.names.w, G.names.b) : startFullGame(S.level);
  if (g.in_checkmate()) {
    const winner = g.turn() === "b" ? "w" : "b";
    if (G.mode === "duel") {
      sndGood(); S.duels++; awardSticker("duell"); save();
      openOverlay("🏆", "Schachmatt – " + G.names[winner] + " gewinnt!", "Tolle Partie, ihr beiden! " + esc(G.names[winner === "w" ? "b" : "w"]) + ", du bekommst bestimmt die Revanche. 🤝",
        [{ label: "Revanche! 🔄", fn: () => startDuel(G.names.b, G.names.w) }, { label: "Menü", style: "ghost", fn: () => route("home") }]);
      return true;
    }
    if (winner === "w") {
      sndGood();
      S.wins++; S.rewardCredits++;
      if (G.mode === "end") { S.winsEnd++; if (S.winsEnd >= 3) awardSticker("turm-meister"); } else { S.winsFull++; S.lastResults.push("W"); awardSticker("erster-sieg"); }
      currentLog().wins++;
      dailyWin(); save();
      openOverlay("🏆", "Schachmatt – du gewinnst!", "Fantastisch, " + S.name + "! Du hast dir ein Belohnungs-Spiel verdient! 🕹️",
        [{ label: "Belohnung spielen! 🕹️", fn: tryStartReward }, { label: "Nochmal Schach!", style: "ghost", fn: again }]);
    } else {
      sndBad(); S.losses++; if (G.mode === "full") S.lastResults.push("L"); save();
      openOverlay("🤗", "Robi hat gewonnen", "Kopf hoch! Aus verlorenen Partien lernt man am meisten. " + (S.lastResults.slice(-2).join("") === "LL" && S.level > 1 ? "Tipp: Probier mal eine leichtere Stufe." : "Versuch es gleich nochmal!"),
        [{ label: "Revanche! 💪", fn: again }, { label: "Menü", style: "ghost", fn: () => route("home") }]);
    }
  } else {
    const why = g.in_stalemate() ? "Patt! Der König ist nicht im Schach, kann aber nicht mehr ziehen – das ist Remis. Lass dem König immer ein Feld, bevor du matt setzt!" :
      g.insufficient_material() ? "Remis – zu wenig Material, niemand kann mehr matt setzen." :
        g.in_threefold_repetition() ? "Remis durch dreifache Stellungswiederholung." : "Remis – 50 Züge ohne Schlagen oder Bauernzug.";
    if (G.mode === "duel") { S.duels++; awardSticker("duell"); save(); }
    openOverlay("🤝", "Unentschieden", why, [{ label: "Nochmal!", fn: again }, { label: "Menü", style: "ghost", fn: () => route("home") }]);
  }
  return true;
}

/* =====================================================
   BELOHNUNGSSPIELE
   ===================================================== */
let REWARD = null;
function tryStartReward() {
  if (S.rewardCredits <= 0) {
    openOverlay("🔒", "Noch gesperrt", "Gewinne zuerst eine Partie, löse ein ganzes Rätsel-Thema oder schaffe die Tagesmission – dann darfst du 5 Minuten spielen!",
      [{ label: "Okay, ich trainiere!", fn: () => route("home") }]);
    return;
  }
  const games = RewardGames.GAMES;
  openOverlay("🎟️", "Welches Spiel?", "Du hast " + S.rewardCredits + " Ticket" + (S.rewardCredits === 1 ? "" : "s") + ". Jedes Spiel dauert höchstens 5 Minuten.",
    Object.keys(games).map(k => ({ label: games[k].emoji + " " + games[k].name, style: k === "arkanoid" ? "honey" : "ghost", fn: () => startReward(k) })).concat([{ label: "Später", style: "ghost", fn: null }]));
}
function startReward(name) {
  S.rewardCredits--; save();
  stopReward();
  show("reward");
  $("rewardBubble").textContent = "Du hast es dir verdient! 🎉 " + RewardGames.GAMES[name].hint;
  REWARD = RewardGames.start(name, {
    canvas: $("rewardCanvas"), hud: { left: $("hudLeft"), mid: $("hudMid"), right: $("hudRight") }, pad: $("tetrisPad"), snd: SND,
    onEnd: (e, t, x) => { REWARD = null; if (t === "Bis später!") return; openOverlay(e, t, x, [{ label: "Zurück zum Schach ♟️", fn: () => route("home") }]); }
  });
}
function stopReward() { if (REWARD) { const r = REWARD; REWARD = null; r.stop(); } }
$("btnRewardExit").addEventListener("click", () => route("home"));

/* =====================================================
   DESIGNS
   ===================================================== */
function applyDesign() {
  document.body.className = "";
  if (S.design !== "classic") document.body.classList.add("design-" + S.design);
}
function renderDesigns() {
  const stars = totalStars(), box = $("designList"); box.innerHTML = "";
  for (const d of DESIGNS) {
    const unlocked = stars >= d.need;
    const el = document.createElement("div");
    el.className = "design" + (S.design === d.id ? " active" : "") + (unlocked ? "" : " locked");
    let mini = '<div class="mini">';
    for (let i = 0; i < 16; i++) mini += '<div style="background:' + (((i + Math.floor(i / 4)) % 2) ? d.d : d.l) + '"></div>';
    mini += "</div>";
    el.innerHTML = mini + '<div style="flex:1"><b>' + d.emoji + " " + d.name + '</b><div class="meta" style="font-size:.8rem;opacity:.75">' + (unlocked ? (S.design === d.id ? "ausgewählt ✅" : "freigeschaltet") : "ab " + d.need + " ⭐ (noch " + (d.need - stars) + ")") + '</div></div>' + (unlocked ? "" : "🔒");
    el.addEventListener("click", () => {
      if (!unlocked) { toast("Sammle noch " + (d.need - stars) + " Sterne für dieses Design ⭐"); return; }
      S.design = d.id; save(); applyDesign(); renderDesigns(); sndMove();
    });
    box.appendChild(el);
  }
  const next = DESIGNS.find(d => stars < d.need);
  $("designBubble").innerHTML = next ? "Du hast " + stars + " Sterne. Das nächste Design „" + next.name + "“ gibt es ab " + next.need + " ⭐!" : "Alle Designs freigeschaltet – du bist ein Sternen-Profi! 🌟";
}

/* =====================================================
   URKUNDE
   ===================================================== */
function weekRange(d) {
  const day = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { mon, sun };
}
const fmtDate = d => d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
function weekStats() {
  const { mon, sun } = weekRange(new Date());
  const st = { stars: 0, puzzles: 0, wins: 0, min: 0, sessions: 0 };
  for (const e of S.log) {
    const d = new Date(e.d + "T12:00:00");
    if (d >= mon && d <= sun) { st.stars += e.stars; st.puzzles += e.puzzles; st.wins += e.wins; st.min += e.min; st.sessions++; }
  }
  return { ...st, mon, sun };
}
function renderCertificate(kind) {
  const c = $("cert");
  if (kind === "diplom") {
    const done = THEME_ORDER.every(themeDone);
    c.className = "cert diplom";
    c.innerHTML = '<div class="bigemoji">🏰</div><h1>Turmdiplom</h1><div class="sub">Lauras Schach-Akademie</div>' +
      (done ? '<p>Hiermit wird bestätigt, dass</p><div class="name">' + esc(S.name) + '</div><p>alle Themen der Schach-Akademie gemeistert hat:<br>' + THEME_ORDER.map(t => THEMES[t].emoji + " " + THEMES[t].title).join(" · ") + '</p>' +
        '<div class="stat"><div><b>' + totalStars() + '</b>Sterne</div><div><b>' + S.wins + '</b>Siege</div><div><b>' + S.sessions + '</b>Trainings</div></div><p>Verliehen am ' + esc(S.diplom || todayKey()) + '</p>'
        : '<p>Noch nicht ganz! Für das Turmdiplom müssen alle Themen gelöst sein.</p><div class="stat">' + THEME_ORDER.map(t => '<div><b>' + THEMES[t].emoji + '</b>' + S.stars[t].length + "/" + THEMES[t].list.length + '</div>').join("") + '</div>') +
      '<div class="sig">Pia, Bauern-Coach 🐣</div>';
    $("certBubble").textContent = done ? "Das Turmdiplom! Ich bin so stolz auf dich! 🏰" : "Das Turmdiplom bekommst du, wenn alle Themen gelöst sind. Du schaffst das!";
  } else {
    const w = weekStats();
    c.className = "cert";
    c.innerHTML = '<div class="bigemoji">📜</div><h1>Wochenurkunde</h1><div class="sub">' + fmtDate(w.mon) + " – " + fmtDate(w.sun) + '</div><p>Diese Woche hat</p><div class="name">' + esc(S.name) + '</div><p>fleißig Schach trainiert:</p>' +
      '<div class="stat"><div><b>' + w.stars + '</b>neue Sterne</div><div><b>' + w.puzzles + '</b>Rätsel gelöst</div><div><b>' + w.wins + '</b>Siege</div><div><b>' + w.min + '</b>Minuten</div></div>' +
      '<p>Auf dem Weg zum Turmdiplom: ' + totalStars() + " von " + TOTAL_PUZZLES + ' Aufgaben geschafft.</p><div class="sig">Pia, Bauern-Coach 🐣</div>';
    $("certBubble").textContent = "Deine Wochenurkunde! Drucke sie aus und häng sie auf. 🖨️";
  }
}
$("btnCertWeek").addEventListener("click", () => renderCertificate("week"));
$("btnCertDiplom").addEventListener("click", () => renderCertificate("diplom"));
$("btnPrint").addEventListener("click", () => window.print());

/* =====================================================
   ELTERNBEREICH
   ===================================================== */
function renderParents() {
  $("inpName").value = S.name;
  $("storageText").textContent = storageOk ? "Der Fortschritt wird automatisch auf diesem Gerät gespeichert (localStorage). Für einen Gerätewechsel: Sicherung speichern und dort laden." : "Achtung: Auf diesem Gerät kann nicht gespeichert werden (privater Modus?). Bitte regelmäßig eine Sicherung speichern.";
  renderEngineInfo();
  const fails = Object.values(S.srs).reduce((n, e) => n + e.fails, 0);
  $("statsText").innerHTML = "Sitzungen: <b>" + S.sessions + "</b> · Sterne: <b>" + totalStars() + "/" + TOTAL_PUZZLES + "</b> · Siege: <b>" + S.wins + "</b> (Turm-Endspiel " + S.winsEnd + ", Robi " + S.winsFull + ") · Niederlagen: <b>" + S.losses + "</b> · Duelle: <b>" + S.duels + "</b><br>Fehlversuche bei Rätseln: <b>" + fails + "</b> · Tipps: <b>" + S.hints + "</b> · Robi-Stufe: <b>" + S.level + "</b> · Trainingsminuten: <b>" + S.log.reduce((n, e) => n + e.min, 0) + "</b>";
}
function renderEngineInfo() {
  const t = $("engineText");
  if (ENGINE.status === "ready") t.textContent = "Stockfish läuft (Quelle: " + ENGINE.sf.source + "). Stufen 5–8 nutzen die Engine.";
  else if (ENGINE.status === "loading") t.textContent = "Wird geladen…";
  else if (ENGINE.status === "failed") t.textContent = "Konnte nicht geladen werden (" + ENGINE.error + "). Ohne Internet spielt Robi auf den Stufen 5–8 mit der eingebauten KI (Suchtiefe 3–4). Tipp: stockfish.js in den Ordner engine/ legen und die App über http:// öffnen.";
  else t.textContent = "Noch nicht geladen. Wird beim Start einer Partie ab Stufe 5 automatisch von cdnjs.cloudflare.com geladen (Internet nötig).";
}
$("inpName").addEventListener("change", () => { S.name = $("inpName").value.trim() || "Laura"; save(); toast("Name gespeichert: " + S.name); });
$("btnEngineTest").addEventListener("click", () => { ensureStockfish().then(renderEngineInfo, renderEngineInfo); renderEngineInfo(); });
$("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "schach-akademie-" + todayKey() + ".json";
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});
$("btnImport").addEventListener("click", () => $("fileImport").click());
$("fileImport").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || data.v !== 2 || !data.stars) throw new Error("Format");
      openOverlay("⬆️", "Sicherung laden?", "Der aktuelle Fortschritt wird durch die Sicherung ersetzt (" + Object.values(data.stars).reduce((n, a) => n + a.length, 0) + " Sterne, " + data.sessions + " Sitzungen).",
        [{ label: "Ja, laden", fn: () => { S = Object.assign(defaultState(), data); for (const t of THEME_ORDER) if (!Array.isArray(S.stars[t])) S.stars[t] = []; S.sessionRunning = true; S.sessionSec = 30 * 60; save(); applyDesign(); renderParents(); toast("Sicherung geladen ✅"); } }, { label: "Abbrechen", style: "ghost", fn: null }]);
    } catch (err) { toast("Das ist keine gültige Sicherung."); }
    e.target.value = "";
  };
  r.readAsText(f);
});
$("btnReset").addEventListener("click", () => {
  openOverlay("🗑️", "Wirklich alles löschen?", "Sterne, Sticker, Siege und Wiederholungen werden gelöscht. Das kann nicht rückgängig gemacht werden.",
    [{ label: "Abbrechen", style: "ghost", fn: null }, { label: "Ja, alles löschen", style: "honey", fn: () => { const name = S.name; S = defaultState(); S.name = name; for (const t of THEME_ORDER) S.stars[t] = []; S.sessionRunning = true; S.sessionSec = 30 * 60; save(); applyDesign(); renderParents(); toast("Fortschritt gelöscht"); } }]);
});

/* ---------- Start ---------- */
(function init() {
  document.querySelectorAll(".coach").forEach(c => c.insertAdjacentHTML("afterbegin", PIA_SVG));
  loadState();
  applyDesign();
  const stars = totalStars();
  $("startBubble").innerHTML = S.sessions === 0
    ? "Hallo <b>" + esc(S.name) + "</b>! Ich bin <b>Pia</b>, dein Bauern-Coach. Bereit für dein Training? 🌟"
    : "Willkommen zurück, <b>" + esc(S.name) + "</b>! Du hast schon <b>" + stars + " Sterne</b>" + (S.stickers.length ? " und " + S.stickers.length + " Sammelfiguren" : "") + ". Weiter geht's! 🌟";
  const due = duePuzzles();
  if (due.length) { $("startInfo").style.display = ""; $("startInfo").innerHTML = "🔁 <b>" + due.length + " Rätsel</b> warten heute auf eine Wiederholung."; }
  if (!storageOk) $("footer").textContent = "Achtung: Speichern auf diesem Gerät nicht möglich – Fortschritt gilt nur für diese Sitzung.";
})();
