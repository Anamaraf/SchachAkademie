#!/usr/bin/env node
/* Prüft die gebaute PWA in einem echten Browser (Playwright + Chromium):
   Manifest, Icons, Service Worker, eingebettete Schrift und – der eigentliche
   Punkt – dass die App nach dem ersten Laden ohne Netz weiterläuft.

   Aufruf:  node tools/build.js && node tools/pwa-test.js */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");
const root = path.join(__dirname, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8"
};

function serve() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const file = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

let failed = 0;
function assert(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ " + msg); failed++; }
}

(async () => {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port + "/";
  /* Strenge Autoplay-Regel wie auf dem Handy: Ton erst nach einer Nutzeraktion.
     So fällt auf, wenn der Audio-Kontext angehalten bleibt. */
  const browser = await chromium.launch({ args: ["--autoplay-policy=document-user-activation-required"] });
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  /* Sprachausgabe durch eine Attrappe ersetzen: headless Chromium hat keine
     Stimmen, gesprochen werden soll aber trotzdem geprüft werden. */
  await context.addInitScript(() => {
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: u => window.__spoken.push(u.text),
        cancel: () => { },
        addEventListener: () => { }
      }
    });
  });
  /* Audio-Kontexte mitschreiben, ohne die App dafür anzufassen. */
  await context.addInitScript(() => {
    const Real = window.AudioContext || window.webkitAudioContext;
    window.__ctx = [];
    window.AudioContext = window.webkitAudioContext = class extends Real {
      constructor(...a) { super(...a); window.__ctx.push(this); }
    };
  });

  console.log("Manifest und Icons");
  await page.goto(base);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector("link[rel=manifest]").getAttribute("href");
    return (await fetch(href)).json();
  });
  assert(manifest.name === "Lauras Schach-Akademie", "Manifest wird geladen und geparst");
  assert(manifest.display === "standalone", "display: standalone (startet ohne Adressleiste)");
  assert(manifest.icons.some(i => i.purpose === "maskable" && i.sizes === "512x512"), "maskierbares 512er-Icon vorhanden");
  const iconStatus = await page.evaluate(async icons =>
    Promise.all(icons.map(async i => (await fetch(i.src)).status)), manifest.icons);
  assert(iconStatus.every(s => s === 200), "alle Icons erreichbar (" + iconStatus.join(", ") + ")");

  console.log("Schrift");
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check("700 1rem Fredoka")), "Fredoka ist eingebettet und geladen");

  console.log("Service Worker");
  const active = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  assert(active, "Service Worker ist aktiv");
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    return { name: names[0], count: (await cache.keys()).length };
  });
  assert(/^schach-akademie-/.test(cached.name), "Cache heißt " + cached.name);
  assert(cached.count >= 7, "App-Hülle liegt im Cache (" + cached.count + " Einträge)");

  console.log("Ton");
  const tone = await context.newPage();
  await tone.goto(base);
  await tone.waitForSelector("#btnGo");
  assert(await tone.evaluate(() => window.__ctx.length) === 0,
    "vor der ersten Berührung wird kein Audio-Kontext angelegt");
  /* Klick auf eine neutrale Stelle ohne eigenen Handler: Nur der Entsperrer darf
     hier greifen. Ohne ihn bliebe der Ton stumm, bis zufällig ein Klang fällig
     ist – und dann steht der Kontext womöglich schon angehalten da. */
  await tone.click("header");
  const audio = await tone.evaluate(async () => {
    await new Promise(r => setTimeout(r, 300));
    return { count: window.__ctx.length, states: window.__ctx.map(c => c.state) };
  });
  assert(audio.count === 1, "erste Berührung legt den Audio-Kontext an");
  assert(audio.states.length > 0 && audio.states.every(st => st === "running"), "Audio-Kontext läuft (" + (audio.states.join(", ") || "keiner") + ")");
  await tone.close();

  console.log("Vorlesen");
  const read = await context.newPage();
  await read.goto(base);
  await read.waitForSelector("#btnGo");
  await read.click("#btnGo");
  await read.waitForSelector("#scr-home.active");
  await read.waitForFunction(() => window.__spoken.length > 0, null, { timeout: 5000 }).catch(() => { });
  const spoken = await read.evaluate(() => window.__spoken);
  assert(spoken.length > 0, "Pia spricht ihre Sprechblase (" + JSON.stringify(spoken[0] || "") + ")");
  assert(spoken.every(t => !/\p{Extended_Pictographic}/u.test(t)), "keine Emojis in der Sprachausgabe");
  assert(spoken.every(t => t.trim().length > 0), "keine leeren Ansagen");
  /* Ausschalten muss auch wirklich still sein. */
  await read.click("#btnVoice");
  const before = await read.evaluate(() => { window.__spoken.length = 0; return document.getElementById("btnVoice").textContent; });
  await read.click("#homeBubble");
  await read.waitForTimeout(400);
  assert(await read.evaluate(() => window.__spoken.length) === 0, "ausgeschaltet bleibt es still (Knopf zeigt " + before + ")");
  await read.close();

  console.log("Offline");
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#btnGo", { timeout: 10000 });
  assert(true, "Start-Bildschirm lädt ohne Netz");
  await page.click("#btnGo");
  await page.waitForSelector("#scr-home.active", { timeout: 10000 });
  assert(true, "Navigation funktioniert ohne Netz");
  assert(await page.evaluate(() => document.fonts.check("700 1rem Fredoka")), "Schrift auch offline da");

  const deep = await context.newPage();
  await deep.goto(base + "lauras-schach-akademie.html");
  await deep.waitForSelector("#btnGo", { timeout: 10000 });
  assert(true, "auch lauras-schach-akademie.html lädt ohne Netz");

  assert(errors.length === 0, "keine JavaScript-Fehler" + (errors.length ? ": " + errors.join(" | ") : ""));

  await browser.close();
  server.close();
  console.log(failed ? "\nFEHLGESCHLAGEN: " + failed : "\nAlles grün.");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
