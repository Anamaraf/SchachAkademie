/* Service Worker für Lauras Schach-Akademie.
   Ziel: Nach dem ersten Laden läuft die App vollständig offline.

   VERSION wird von tools/build.js aus dem Inhalt der gebauten Dateien gesetzt.
   Ändert sich die App, ändert sich die Version, der Browser erkennt den neuen
   Worker, legt einen frischen Cache an und wirft den alten weg. */
"use strict";

const VERSION = "__BUILD_VERSION__";
const CACHE = "schach-akademie-" + VERSION;

/* Die App selbst; Schrift, CSS und JS stecken bereits in dieser einen Datei. */
const APP = "./index.html";
const SHELL = [
  APP,
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

/* Stockfish (Stufen 5–8) liegt auf einem CDN. Nach dem ersten Laden wird es
   mitgecacht, danach spielt Robi auch offline auf voller Stärke. */
const ENGINE = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  /* status 0 = opaque (cross-origin ohne CORS) – lässt sich cachen, aber nicht lesen. */
  if (response && (response.status === 200 || response.type === "opaque")) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  /* Seitenaufrufe: passender Cache-Eintrag, sonst die App-Datei. So funktioniert
     offline auch der Aufruf von lauras-schach-akademie.html oder vom Stammpfad. */
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request, { ignoreSearch: true })
        .then(hit => hit || fetch(request).catch(() => null))
        .then(res => res || caches.match(APP, { ignoreSearch: true }))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin || request.url === ENGINE) {
    event.respondWith(cacheFirst(request).catch(() => caches.match(request, { ignoreSearch: true })));
  }
});
