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
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));

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
