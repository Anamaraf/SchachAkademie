#!/usr/bin/env node
/* Erzeugt die App-Icons in icons/ aus einer eingebauten SVG-Zeichnung (Playwright,
   wie tools/smoke-test.js):  node tools/make-icons.js
   Die PNGs sind eingecheckt – dieses Skript wird nur gebraucht, wenn sich das
   Motiv oder die Farben ändern. */
"use strict";
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright");

const OUT = path.join(__dirname, "..", "icons");

/* Farben wie in src/style.css */
const VIOLET = "#6C4BC4", VIOLET_D = "#3F2A7E", HONEY = "#FFB933", HONEY_D = "#E09C12", WHITE = "#FFFFFF";

/* Bauer, gezeichnet in einem 512er-Feld und um 14 px nach oben gerückt,
   damit er optisch mittig sitzt. Er bleibt innerhalb der "safe zone"
   (mittlere 80 %), die maskierbare Icons unter Android verlangen. */
function pawn(scale) {
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -270)">
    <rect x="164" y="384" width="184" height="46" rx="20" fill="${HONEY}"/>
    <rect x="164" y="384" width="184" height="14" rx="7" fill="${HONEY_D}" opacity=".35"/>
    <path d="M222 252 C222 310 206 348 188 384 L324 384 C306 348 290 310 290 252 Z" fill="${WHITE}"/>
    <rect x="196" y="218" width="120" height="32" rx="16" fill="${WHITE}"/>
    <circle cx="256" cy="168" r="58" fill="${WHITE}"/>
  </g>`;
}

function svg(size, maskable) {
  /* "any"-Icons bekommen abgerundete Ecken, maskierbare laufen randlos –
     dort schneidet Android die Form selbst zu. */
  const bg = maskable
    ? `<rect width="512" height="512" fill="url(#g)"/>`
    : `<rect width="512" height="512" rx="112" ry="112" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${VIOLET}"/><stop offset="1" stop-color="${VIOLET_D}"/>
  </linearGradient></defs>
  ${bg}
  ${pawn(maskable ? 0.82 : 0.94)}
</svg>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-192.png", 192, true],
    ["icon-maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true]
  ];
  for (const [name, size, maskable] of jobs) {
    const file = path.join(OUT, name);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg(size, maskable)}`);
    /* Screenshot genau des SVG-Elements – so stimmt die Größe auf das Pixel. */
    await page.locator("svg").screenshot({ path: file, omitBackground: true });
    console.log("Icon: icons/" + name + " (" + Math.round(fs.statSync(file).size / 1024) + " KB)");
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
