#!/usr/bin/env node
/* Browser-Smoke-Test der gebauten Einzeldatei (Playwright + Chromium). Aufruf: node tools/smoke-test.js */
"use strict";
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const FILE = "file://" + path.join(__dirname, "..", "lauras-schach-akademie.html");
const shots = path.join(__dirname, "..", "..", "..", "..", "tmp"); // wird per --shots überschrieben
const shotDir = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;
let step = 0;
async function shot(page, name) { if (shotDir) await page.screenshot({ path: path.join(shotDir, String(++step).padStart(2, "0") + "-" + name + ".png"), fullPage: true }); }
const tap = (page, sq, board) => page.click("#" + (board || "board") + " [data-sq='" + sq + "']");
const text = (page, sel) => page.$eval(sel, e => e.textContent);
function assert(cond, msg) { if (!cond) throw new Error("FEHLER: " + msg); console.log("  ✓ " + msg); }

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium/chrome-linux/chrome" }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts.googleapis|ERR_/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(FILE);
  await page.waitForSelector("#btnGo");
  console.log("Start");
  await shot(page, "start");
  await page.click("#btnGo");
  assert(await page.$eval("#scr-home", e => e.classList.contains("active")), "Home-Bildschirm aktiv");
  await shot(page, "home");

  // ---- Rätsel: Matt in 1, falscher Zug, dann richtiger Zug ----
  await page.click("[data-go='puzzles']");
  await page.click("#themeTiles .mode");
  await page.waitForSelector("#scr-puzzle.active");
  await tap(page, "e1"); await tap(page, "e7");           // Te7 – falsch
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("warn"));
  const warn = await text(page, "#puzzleBubble");
  assert(/Te7/.test(warn) && /kein Matt|Versuch/.test(warn), "Falscher Zug erklärt: " + warn.slice(0, 80));
  await shot(page, "puzzle-wrong");
  await page.waitForFunction(() => document.querySelectorAll("#arrows *").length > 0);
  assert(true, "Pfeil für Gegnerantwort gezeichnet");
  await page.waitForFunction(() => document.getElementById("btnWhy").style.display !== "none", { timeout: 8000 });
  assert(await page.$eval("#board [data-sq='e1'] .pc", e => !!e), "Stellung nach Fehler zurückgesetzt");
  await tap(page, "e1"); await tap(page, "e8");           // Te8# – richtig
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("cheer"));
  const cheer = await text(page, "#puzzleBubble");
  assert(/Schachmatt/.test(cheer) && /Te8/.test(cheer), "Richtiger Zug gefeiert: " + cheer.slice(0, 70));
  await shot(page, "puzzle-right");
  await page.waitForFunction(() => /Aufgabe 2 von/.test(document.getElementById("lessonbox").textContent), { timeout: 8000 });
  assert(true, "Nächste Aufgabe geladen");
  const stars = await page.evaluate(() => JSON.parse(localStorage.getItem("lauras-schach-akademie.v2")).stars.matt.length);
  assert(stars === 1, "Stern gespeichert (localStorage)");
  const srs = await page.evaluate(() => JSON.parse(localStorage.getItem("lauras-schach-akademie.v2")).srs["matt-1"]);
  assert(srs && srs.fails === 1 && srs.due === 3, "Spaced Repetition: Fehler notiert, Rätsel kommt in 2 Sitzungen wieder");
  // Aufgabe 2: vier Mattzüge – De8# ist eine der dokumentierten Lösungen
  await tap(page, "f7"); await tap(page, "e8");
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("cheer"));
  assert(/mehreren|Wegen zum Matt/.test(await text(page, "#puzzleBubble")), "Alternative Lösung De8# akzeptiert");

  // ---- Fehlerliste ----
  await page.click("#btnPuzzleBack");
  await page.click("[data-go='mistakes']");
  await page.waitForSelector("#scr-mistakes.active");
  assert(/Matt in 1 · Aufgabe 1/.test(await text(page, "#mistakeList")), "Fehlerliste zeigt Aufgabe 1");
  await shot(page, "mistakes");

  // ---- Freischaltung simulieren und Bauernendspiel spielen ----
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("lauras-schach-akademie.v2"));
    s.stars = { matt: [0, 1, 2, 3, 4], gabel: [0, 1, 2, 3], fesselung: [0, 1, 2], spiess: [0, 1, 2], abzug: [0, 1, 2], bauern: [] };
    s.rewardCredits = 2; s.srs["gabel-1"] = { fails: 2, ok: 0, due: 1, history: [{ s: 1, d: "2026-09-01", san: "Kb2" }] };
    localStorage.setItem("lauras-schach-akademie.v2", JSON.stringify(s));
  });
  await page.reload(); await page.waitForSelector("#btnGo");
  assert(/Willkommen zurück/.test(await text(page, "#startBubble")), "Wiedererkennung beim Start");
  assert(/1 Rätsel/.test(await text(page, "#startInfo")), "Wiederholungshinweis beim Start");
  await page.click("#btnGo");
  assert(await page.$eval("#tile-review", e => e.style.display !== "none"), "Wiederholungs-Kachel sichtbar");
  await page.click("[data-go='puzzles']");
  const tiles = await page.$$("#themeTiles .mode");
  assert(tiles.length === 6, "6 Themen-Kacheln");
  await tiles[5].click();
  await page.waitForFunction(() => /Bring ihn zur Umwandlung/.test(document.getElementById("puzzleBubble").textContent), { timeout: 20000 });
  assert(true, "Endspiel-Solver fertig");
  await tap(page, "a1"); await tap(page, "b2");            // Kb2 – verschenkt den Gewinn
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("warn"));
  assert(/verschenkt den Gewinn/.test(await text(page, "#puzzleBubble")), "Endspiel-Fehler erkannt");
  await page.waitForFunction(() => !!document.querySelector("#board [data-sq='a1'] .pc") && !document.querySelector("#board [data-sq='b2'] .pc"), { timeout: 8000 });
  for (const [f, t] of [["h4", "h5"], ["h5", "h6"], ["h6", "h7"], ["h7", "h8"]]) {
    await page.waitForFunction(() => typeof PZ === "undefined" || !PZ.busy);
    await tap(page, f); await tap(page, t);
    await page.waitForTimeout(1300);
  }
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("cheer"), { timeout: 8000 });
  assert(/richtig|Genau/.test(await text(page, "#puzzleBubble")), "Bauer umgewandelt – Aufgabe gelöst");
  await shot(page, "endgame-solved");

  // ---- Wiederholung ----
  await page.waitForTimeout(3000);
  await page.click("#btnPuzzleBack");
  await page.evaluate(() => route("home")).catch(() => {});
  await page.click("#tile-review");
  await page.waitForSelector("#scr-puzzle.active");
  assert(/Wiederholung/.test(await text(page, "#lessonbox")), "Wiederholungsmodus aktiv");
  await tap(page, "d4"); await tap(page, "d5");
  await page.waitForFunction(() => document.getElementById("puzzleBubble").classList.contains("cheer"));
  await page.waitForSelector("#overlay.show", { timeout: 8000 });
  assert(/Wiederholung geschafft/.test(await text(page, "#ovTitle")), "Wiederholung abgeschlossen");
  await page.click("#ovButtons button");

  // ---- Partie gegen Robi (Stufe 1) ----
  await page.click("[data-go='fullgame']");
  await page.waitForSelector("#overlay.show");
  await page.click("#ovExtra button[data-lvl='1']");
  await page.click("#ovButtons button");
  await page.waitForSelector("#scr-game.active");
  await tap(page, "e2", "board2"); await tap(page, "e4", "board2");
  await page.waitForFunction(() => typeof G !== "undefined" && !G.busy && G.game.turn() === "w" && G.game.hist.length === 2, { timeout: 8000 });
  assert(true, "Robi hat geantwortet");
  await shot(page, "game");

  // ---- Familien-Duell ----
  await page.evaluate(() => route("home"));
  await page.click("[data-go='duel']");
  await page.waitForSelector("#overlay.show");
  await page.fill("#duelB", "Papa");
  await page.click("#ovButtons button");
  await page.waitForSelector("#turnbar", { state: "visible" });
  await tap(page, "e2", "board2"); await tap(page, "e4", "board2");
  await tap(page, "e7", "board2"); await tap(page, "e5", "board2");
  assert(/Papa/.test(await text(page, "#tbBlack")) && await page.$eval("#tbWhite", e => e.classList.contains("on")), "Duell: beide Seiten ziehen, Zugrecht angezeigt");
  await shot(page, "duel");

  // ---- Belohnungsspiele ----
  for (const g of ["tetris", "flitzer", "arkanoid"]) {
    await page.evaluate(() => route("home"));
    await page.click("#rewardTile");
    await page.waitForSelector("#overlay.show");
    const btn = await page.$$("#ovButtons button");
    const labels = await Promise.all(btn.map(b => b.textContent()));
    const idx = labels.findIndex(l => new RegExp(g === "flitzer" ? "Flitzer" : g, "i").test(l));
    await btn[idx].click();
    await page.waitForSelector("#scr-reward.active");
    await page.waitForTimeout(700);
    if (g === "tetris") { assert(await page.$eval("#tetrisPad", e => e.style.display !== "none"), "Tetris-Steuerung sichtbar"); await page.click("#tetrisPad button[data-k='rot']"); }
    await page.keyboard.press("ArrowLeft");
    const drawn = await page.$eval("#rewardCanvas", c => { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3]) n++; return n > 50; });
    assert(drawn, g + " zeichnet auf den Canvas");
    await shot(page, "reward-" + g);
    await page.click("#btnRewardExit");
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("lauras-schach-akademie.v2")); s.rewardCredits = 2; localStorage.setItem("lauras-schach-akademie.v2", JSON.stringify(s)); S.rewardCredits = 2; });
  }

  // ---- Album, Designs, Urkunde, Eltern ----
  await page.click("[data-go='album']");
  assert((await page.$$("#albumGrid .slot")).length === 10 && (await page.$$("#albumGrid .slot.empty")).length === 10, "Album: 10 Plätze, alle leer sichtbar");
  await shot(page, "album");
  await page.evaluate(() => route("home"));
  await page.click("[data-go='designs']");
  const designs = await page.$$("#designList .design");
  await designs[1].click();
  assert(await page.$eval("body", b => b.classList.contains("design-einhorn")), "Design Einhorn-Rosa aktiviert");
  await shot(page, "designs");
  await page.evaluate(() => route("home"));
  await page.click("[data-go='certificate']");
  assert(/Wochenurkunde/.test(await text(page, "#cert")), "Wochenurkunde gerendert");
  await page.click("#btnCertDiplom");
  assert(/Turmdiplom/.test(await text(page, "#cert")), "Turmdiplom-Ansicht gerendert");
  await shot(page, "certificate");
  await page.evaluate(() => route("home"));
  await page.click("[data-go='parents']");
  assert(/Sitzungen/.test(await text(page, "#statsText")), "Elternbereich Statistik");
  await page.click("#btnEngineTest");
  await page.waitForFunction(() => /Konnte nicht|läuft/.test(document.getElementById("engineText").textContent), { timeout: 30000 });
  console.log("  Engine-Status: " + (await text(page, "#engineText")).slice(0, 90));
  await shot(page, "parents");

  await browser.close();
  if (errors.length) { console.log("\nFehler in der Konsole:\n" + errors.join("\n")); process.exit(1); }
  console.log("\nSmoke-Test bestanden, keine JS-Fehler.");
})().catch(e => { console.error(e); process.exit(1); });
