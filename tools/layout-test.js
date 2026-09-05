#!/usr/bin/env node
/* Prüft, dass die Schachfelder auf jedem Bildschirm quadratisch sind – auf
   schmalen Handys ebenso wie im Querformat, wo senkrecht wenig Platz ist.

   Aufruf:  node tools/build.js && node tools/layout-test.js */
"use strict";
const path = require("path");
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const FILE = "file://" + path.join(__dirname, "..", "lauras-schach-akademie.html");

/* Handy hoch, kleines Handy, großes Handy, Tablet-schmal, Querformat. */
const SIZES = [[360, 640], [412, 732], [320, 568], [420, 860], [540, 720], [800, 400]];
const TOLERANZ = 1; // ein Pixel Rundung ist in Ordnung

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ " + msg); failed++; }
}

function measure(page, sel) {
  return page.evaluate(s => {
    const sq = [...document.querySelectorAll(s + " .sq")];
    if (sq.length !== 64) return { n: sq.length };
    const r = sq.map(e => e.getBoundingClientRect());
    return {
      n: 64,
      w: r[0].width, h: r[0].height,
      schief: r.reduce((m, x) => Math.max(m, Math.abs(x.width - x.height)), 0),
      breite: Math.max(...r.map(x => x.width)) - Math.min(...r.map(x => x.width)),
      hoehe: Math.max(...r.map(x => x.height)) - Math.min(...r.map(x => x.height))
    };
  }, sel);
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(FILE);
    await page.click("#btnGo");
    await page.click("[data-go='puzzles']");
    await page.click("#themeTiles .mode");
    await page.waitForSelector("#scr-puzzle.active");
    const m = await measure(page, "#board");
    const label = (w + "x" + h).padEnd(8);
    if (m.n !== 64) assert(false, label + " 64 Felder erwartet, " + m.n + " gefunden");
    else {
      assert(m.schief <= TOLERANZ,
        label + " Felder quadratisch (" + m.w.toFixed(1) + "x" + m.h.toFixed(1) + ", Abweichung " + m.schief.toFixed(2) + "px)");
      assert(m.breite <= TOLERANZ && m.hoehe <= TOLERANZ,
        label + " alle Felder gleich groß (Breite ±" + m.breite.toFixed(2) + ", Höhe ±" + m.hoehe.toFixed(2) + ")");
    }
    await page.close();
  }
  await browser.close();
  console.log(failed ? "\nFEHLGESCHLAGEN: " + failed : "\nAlles grün.");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
