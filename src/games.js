/* =====================================================
   Lauras Schach-Akademie – Belohnungsspiele
   Gemeinsame Schnittstelle:
     RewardGames.start(name, {canvas, hud:{left,mid,right}, pad, onEnd(emoji,title,text), snd})
     -> { stop() }
   Spiele: "arkanoid", "flitzer" (Auto-Flitzer), "tetris". Jedes maximal 5 Minuten.
   ===================================================== */
(function (root) {
  "use strict";
  const LIMIT = 300;
  const COLORS = ["#FFB933", "#E2606B", "#6C4BC4", "#3F9E6E", "#5AA7DE", "#F48FB1", "#8FA86F"];
  const GAMES = {
    arkanoid: { name: "Arkanoid", emoji: "🧱", hint: "Wische unter dem Ball hin und her." },
    flitzer: { name: "Auto-Flitzer", emoji: "🚗", hint: "Tippe links oder rechts (oder Pfeiltasten) und weiche den Hindernissen aus!" },
    tetris: { name: "Tetris", emoji: "🧩", hint: "Baue volle Reihen! Knöpfe unten oder Pfeiltasten." }
  };

  function setupCanvas(cv, ratio) {
    const wrap = cv.parentElement;
    cv.width = Math.min(420, wrap.clientWidth || 360);
    cv.height = Math.round(cv.width * ratio);
    return cv.getContext("2d");
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }
  function makeTimer(o, st, onTimeout) {
    st.time = LIMIT;
    o.hud.mid.textContent = "5:00";
    const t = setInterval(() => {
      if (st.over) { clearInterval(t); return; }
      st.time--;
      o.hud.mid.textContent = Math.floor(st.time / 60) + ":" + String(st.time % 60).padStart(2, "0");
      if (st.time <= 0) onTimeout();
    }, 1000);
    return t;
  }

  /* ---------- Arkanoid ---------- */
  function startArkanoid(o) {
    const cv = o.canvas, ctx = setupCanvas(cv, 1.33), W = cv.width, H = cv.height;
    const st = { paddle: { w: W * 0.24, h: 12, x: W / 2, y: H - 26 },
      ball: { x: W / 2, y: H - 60, vx: 3.2 * (Math.random() < .5 ? 1 : -1), vy: -4.2, r: 7 },
      bricks: [], lives: 3, score: 0, over: false, raf: 0 };
    const cols = 7, rows = 5, bw = (W - 24) / cols, bh = 20;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) st.bricks.push({ x: 12 + c * bw, y: 44 + r * (bh + 6), w: bw - 6, h: bh, alive: true, col: COLORS[r] });
    const movePaddle = x => { const rect = cv.getBoundingClientRect(); st.paddle.x = Math.max(st.paddle.w / 2, Math.min(W - st.paddle.w / 2, (x - rect.left) * (W / rect.width))); };
    cv.onpointermove = e => movePaddle(e.clientX);
    cv.onpointerdown = e => movePaddle(e.clientX);
    const onKey = e => { if (e.key === "ArrowLeft") st.paddle.x = Math.max(st.paddle.w / 2, st.paddle.x - 22); if (e.key === "ArrowRight") st.paddle.x = Math.min(W - st.paddle.w / 2, st.paddle.x + 22); };
    window.addEventListener("keydown", onKey);
    o.hud.left.textContent = "❤️❤️❤️"; o.hud.right.textContent = "0";
    const end = (e, t, x) => { if (st.over) return; st.over = true; clearInterval(timer); cancelAnimationFrame(st.raf); window.removeEventListener("keydown", onKey); o.onEnd(e, t, x, st.score); };
    const timer = makeTimer(o, st, () => end("⏰", "Zeit um!", "5 Minuten Spielspaß sind vorbei – zurück ans Brett, Großmeisterin!"));
    function loop() {
      if (st.over) return;
      const b = st.ball, p = st.paddle;
      b.x += b.vx; b.y += b.vy;
      if (b.x < b.r || b.x > W - b.r) b.vx *= -1;
      if (b.y < b.r) b.vy *= -1;
      if (b.y > H + 20) {
        st.lives--; o.snd.bad();
        o.hud.left.textContent = "❤️".repeat(Math.max(0, st.lives));
        if (st.lives <= 0) { end("🕹️", "Alle Leben weg!", "Trotzdem gut gespielt! Zurück zum Schach."); return; }
        b.x = W / 2; b.y = H - 60; b.vx = 3.2 * (Math.random() < .5 ? 1 : -1); b.vy = -4.2;
      }
      if (b.y + b.r >= p.y && b.y + b.r <= p.y + p.h + 8 && Math.abs(b.x - p.x) < p.w / 2 + b.r && b.vy > 0) {
        b.vy *= -1; b.vx = ((b.x - p.x) / (p.w / 2)) * 4.5; o.snd.move();
      }
      let left = 0;
      for (const br of st.bricks) {
        if (!br.alive) continue; left++;
        if (b.x > br.x - b.r && b.x < br.x + br.w + b.r && b.y > br.y - b.r && b.y < br.y + br.h + b.r) {
          br.alive = false; b.vy *= -1; st.score += 10; o.snd.capture(); o.hud.right.textContent = st.score;
        }
      }
      if (left === 0) { o.snd.good(); end("🌟", "Alle Steine weg!", "Wahnsinn! Du bist auch im Arkanoid ein Profi!"); return; }
      ctx.clearRect(0, 0, W, H);
      for (const br of st.bricks) { if (!br.alive) continue; ctx.fillStyle = br.col; roundRect(ctx, br.x, br.y, br.w, br.h, 5); }
      ctx.fillStyle = "#FFB933"; roundRect(ctx, p.x - p.w / 2, p.y, p.w, p.h, 6);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      st.raf = requestAnimationFrame(loop);
    }
    loop();
    return { stop: () => end("👋", "Bis später!", "") };
  }

  /* ---------- Auto-Flitzer ---------- */
  function startFlitzer(o) {
    const cv = o.canvas, ctx = setupCanvas(cv, 1.33), W = cv.width, H = cv.height;
    const lanes = 3, laneW = W / lanes;
    const st = { lane: 1, x: laneW * 1.5, obstacles: [], speed: 3.2, dist: 0, score: 0, lives: 3, over: false, raf: 0, tick: 0, stripe: 0, inv: 0 };
    const carW = laneW * 0.5, carH = carW * 1.7, carY = H - carH - 24;
    o.hud.left.textContent = "❤️❤️❤️"; o.hud.right.textContent = "0";
    const steer = dir => { st.lane = Math.max(0, Math.min(lanes - 1, st.lane + dir)); o.snd.move(); };
    cv.onpointerdown = e => { const rect = cv.getBoundingClientRect(); steer((e.clientX - rect.left) < rect.width / 2 ? -1 : 1); };
    const onKey = e => { if (e.key === "ArrowLeft") steer(-1); if (e.key === "ArrowRight") steer(1); };
    window.addEventListener("keydown", onKey);
    const end = (e, t, x) => { if (st.over) return; st.over = true; clearInterval(timer); cancelAnimationFrame(st.raf); window.removeEventListener("keydown", onKey); o.onEnd(e, t, x, st.score); };
    const timer = makeTimer(o, st, () => end("⏰", "Zeit um!", "5 Minuten Rennspaß sind vorbei – zurück ans Brett!"));
    const EMOJI = ["🚧", "🐄", "🪨", "🛢️", "🌵"];
    function loop() {
      if (st.over) return;
      st.tick++;
      st.x += (laneW * (st.lane + 0.5) - st.x) * 0.25;
      st.speed = 3.2 + Math.min(4, st.tick / 900);
      st.stripe = (st.stripe + st.speed) % 40;
      if (st.tick % Math.max(28, 60 - Math.floor(st.tick / 150)) === 0) {
        const lane = Math.floor(Math.random() * lanes);
        // nie alle Spuren gleichzeitig blockieren
        const recent = st.obstacles.filter(ob => ob.y < 80);
        if (recent.length < lanes - 1) st.obstacles.push({ lane, y: -40, e: EMOJI[Math.floor(Math.random() * EMOJI.length)], passed: false });
      }
      for (const ob of st.obstacles) {
        ob.y += st.speed;
        if (!ob.passed && ob.y > carY + carH) { ob.passed = true; st.score += 5; o.hud.right.textContent = st.score; }
        if (st.inv <= 0 && ob.lane === st.lane && ob.y + 30 > carY && ob.y < carY + carH) {
          st.lives--; st.inv = 60; o.snd.bad(); ob.passed = true; ob.y = H + 100;
          o.hud.left.textContent = "❤️".repeat(Math.max(0, st.lives));
          if (st.lives <= 0) { end("💥", "Autsch – Kollision!", "Punkte: " + st.score + ". Beim nächsten Mal noch flinker!"); return; }
        }
      }
      st.obstacles = st.obstacles.filter(ob => ob.y < H + 60);
      if (st.inv > 0) st.inv--;
      // Zeichnen
      ctx.fillStyle = "#3d3d55"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2E2440"; ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.setLineDash([20, 20]); ctx.lineDashOffset = -st.stripe;
      for (let l = 1; l < lanes; l++) { ctx.beginPath(); ctx.moveTo(l * laneW, 0); ctx.lineTo(l * laneW, H); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = Math.round(laneW * 0.45) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const ob of st.obstacles) ctx.fillText(ob.e, laneW * (ob.lane + 0.5), ob.y);
      if (st.inv % 10 < 5) {
        ctx.fillStyle = "#FFB933"; roundRect(ctx, st.x - carW / 2, carY, carW, carH, 10);
        ctx.fillStyle = "#6C4BC4"; roundRect(ctx, st.x - carW / 2 + 6, carY + 10, carW - 12, carH * 0.3, 6);
        ctx.fillStyle = "#2E2440";
        roundRect(ctx, st.x - carW / 2 - 4, carY + 8, 6, 18, 2); roundRect(ctx, st.x + carW / 2 - 2, carY + 8, 6, 18, 2);
        roundRect(ctx, st.x - carW / 2 - 4, carY + carH - 26, 6, 18, 2); roundRect(ctx, st.x + carW / 2 - 2, carY + carH - 26, 6, 18, 2);
      }
      st.raf = requestAnimationFrame(loop);
    }
    loop();
    return { stop: () => end("👋", "Bis später!", "") };
  }

  /* ---------- Tetris ---------- */
  const SHAPES = {
    I: [[1, 1, 1, 1]], O: [[1, 1], [1, 1]], T: [[0, 1, 0], [1, 1, 1]], S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]], J: [[1, 0, 0], [1, 1, 1]], L: [[0, 0, 1], [1, 1, 1]]
  };
  function startTetris(o) {
    const cv = o.canvas, ctx = setupCanvas(cv, 1.5), W = cv.width, H = cv.height;
    const cols = 10, rows = 18, cell = Math.floor(Math.min(W / cols, H / rows));
    const ox = Math.floor((W - cols * cell) / 2), oy = Math.floor((H - rows * cell) / 2);
    const st = { grid: Array.from({ length: rows }, () => new Array(cols).fill(0)), score: 0, lines: 0, over: false, raf: 0, drop: 0, interval: 48, piece: null };
    o.hud.left.textContent = "Reihen: 0"; o.hud.right.textContent = "0";
    const keys = Object.keys(SHAPES);
    const spawn = () => {
      const k = keys[Math.floor(Math.random() * keys.length)];
      st.piece = { shape: SHAPES[k].map(r => r.slice()), x: Math.floor(cols / 2) - 1, y: 0, col: COLORS[keys.indexOf(k)] };
      if (collides(st.piece.shape, st.piece.x, st.piece.y)) end("🧱", "Der Turm ist voll!", "Reihen: " + st.lines + ", Punkte: " + st.score + ". Stark gespielt!");
    };
    const collides = (shape, x, y) => shape.some((row, r) => row.some((v, c) => v && (y + r >= rows || x + c < 0 || x + c >= cols || (y + r >= 0 && st.grid[y + r][x + c]))));
    const rotate = shape => shape[0].map((_, c) => shape.map(row => row[c]).reverse());
    const lock = () => {
      st.piece.shape.forEach((row, r) => row.forEach((v, c) => { if (v && st.piece.y + r >= 0) st.grid[st.piece.y + r][st.piece.x + c] = st.piece.col; }));
      let cleared = 0;
      for (let r = rows - 1; r >= 0; r--) if (st.grid[r].every(Boolean)) { st.grid.splice(r, 1); st.grid.unshift(new Array(cols).fill(0)); cleared++; r++; }
      if (cleared) { st.lines += cleared; st.score += [0, 10, 30, 60, 100][cleared]; o.snd.good(); st.interval = Math.max(14, 48 - Math.floor(st.lines / 4) * 4); }
      else o.snd.capture();
      o.hud.left.textContent = "Reihen: " + st.lines; o.hud.right.textContent = st.score;
      spawn();
    };
    const act = k => {
      if (st.over || !st.piece) return;
      const p = st.piece;
      if (k === "left" && !collides(p.shape, p.x - 1, p.y)) p.x--;
      else if (k === "right" && !collides(p.shape, p.x + 1, p.y)) p.x++;
      else if (k === "down") { if (!collides(p.shape, p.x, p.y + 1)) { p.y++; st.score += 1; o.hud.right.textContent = st.score; } else lock(); }
      else if (k === "rot") { const r = rotate(p.shape); if (!collides(r, p.x, p.y)) p.shape = r; else if (!collides(r, p.x - 1, p.y)) { p.shape = r; p.x--; } else if (!collides(r, p.x + 1, p.y)) { p.shape = r; p.x++; } }
    };
    const onKey = e => { const map = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "down", ArrowUp: "rot", " ": "rot" }; if (map[e.key]) { e.preventDefault(); act(map[e.key]); } };
    window.addEventListener("keydown", onKey);
    const padHandler = e => { const b = e.target.closest("button"); if (b) act(b.dataset.k); };
    if (o.pad) { o.pad.style.display = "flex"; o.pad.addEventListener("click", padHandler); }
    cv.onpointerdown = e => { const rect = cv.getBoundingClientRect(); const rx = (e.clientX - rect.left) / rect.width, ry = (e.clientY - rect.top) / rect.height; if (ry > 0.8) act("down"); else if (rx < 0.33) act("left"); else if (rx > 0.66) act("right"); else act("rot"); };
    const end = (e, t, x) => { if (st.over) return; st.over = true; clearInterval(timer); cancelAnimationFrame(st.raf); window.removeEventListener("keydown", onKey); if (o.pad) { o.pad.style.display = "none"; o.pad.removeEventListener("click", padHandler); } o.onEnd(e, t, x, st.score); };
    const timer = makeTimer(o, st, () => end("⏰", "Zeit um!", "Reihen: " + st.lines + ". Zurück ans Schachbrett!"));
    spawn();
    function loop() {
      if (st.over) return;
      st.drop++;
      if (st.drop >= st.interval) { st.drop = 0; act("down"); }
      ctx.fillStyle = "#2E2440"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#3d3d55"; ctx.fillRect(ox, oy, cols * cell, rows * cell);
      const draw = (x, y, col) => { ctx.fillStyle = col; roundRect(ctx, ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2, 3); };
      st.grid.forEach((row, r) => row.forEach((v, c) => { if (v) draw(c, r, v); }));
      if (st.piece) st.piece.shape.forEach((row, r) => row.forEach((v, c) => { if (v && st.piece.y + r >= 0) draw(st.piece.x + c, st.piece.y + r, st.piece.col); }));
      st.raf = requestAnimationFrame(loop);
    }
    loop();
    return { stop: () => end("👋", "Bis später!", "") };
  }

  root.RewardGames = {
    GAMES,
    start(name, o) {
      if (o.pad) o.pad.style.display = "none";
      if (name === "flitzer") return startFlitzer(o);
      if (name === "tetris") return startTetris(o);
      return startArkanoid(o);
    }
  };
})(typeof self !== "undefined" ? self : this);
