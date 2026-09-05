#!/usr/bin/env node
/* Baut aus src/ die auslieferbaren Dateien:

   lauras-schach-akademie.html  Einzeldatei, alles eingebettet (zum Weitergeben)
   index.html                   dieselbe App unter dem Namen, den ein Webserver
                                von sich aus ausliefert (für GitHub Pages / PWA)
   manifest.webmanifest         Kopie aus src/
   sw.js                        Kopie aus src/, mit eingesetzter Version

   Die Version ist eine Kurz-Prüfsumme über App, Manifest und Icons. Ändert
   sich etwas, ändert sich die Version, und der Browser holt sich die neue
   Fassung, statt die alte aus dem Cache zu zeigen. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const root = path.join(__dirname, ".."), src = path.join(root, "src"), icons = path.join(root, "icons");

/* ---------- CSS inkl. Schrift einbetten ---------- */
let css = fs.readFileSync(path.join(src, "style.css"), "utf8");
const font = fs.readFileSync(path.join(src, "fredoka-latin.woff2"));
css = css.replace('url("fredoka-latin.woff2")', 'url("data:font/woff2;base64,' + font.toString("base64") + '")');
if (css.includes("fredoka-latin.woff2")) throw new Error("Schrift wurde nicht eingebettet – Pfad in style.css geprüft?");

/* ---------- HTML zusammensetzen ---------- */
let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
html = html.replace(/<!-- BUILD:CSS -->[\s\S]*?<!-- \/BUILD:CSS -->/, () => "<style>\n" + css + "\n</style>");
html = html.replace(/<!-- BUILD:JS -->[\s\S]*?<!-- \/BUILD:JS -->/, () => {
  const files = ["chess.js", "ai.js", "puzzles.js", "games.js", "app.js"];
  return files.map(f => "<script id=\"src-" + f.replace(".js", "") + "\">\n" + fs.readFileSync(path.join(src, f), "utf8").replace(/<\/script/gi, "<\\/script") + "\n</script>").join("\n");
});

const outputs = ["lauras-schach-akademie.html", "index.html"];
for (const name of outputs) fs.writeFileSync(path.join(root, name), html);

/* ---------- Manifest ---------- */
const manifest = fs.readFileSync(path.join(src, "manifest.webmanifest"), "utf8");
JSON.parse(manifest); // fällt auf die Nase, wenn das Manifest kaputt ist
fs.writeFileSync(path.join(root, "manifest.webmanifest"), manifest);

/* ---------- Service Worker mit Version ---------- */
const hash = crypto.createHash("sha256").update(html).update(manifest);
const iconFiles = fs.existsSync(icons) ? fs.readdirSync(icons).sort() : [];
for (const f of iconFiles) hash.update(fs.readFileSync(path.join(icons, f)));
const version = hash.digest("hex").slice(0, 12);

let sw = fs.readFileSync(path.join(src, "sw.js"), "utf8");
if (!sw.includes("__BUILD_VERSION__")) throw new Error("Platzhalter __BUILD_VERSION__ fehlt in src/sw.js");
sw = sw.replace("__BUILD_VERSION__", version);
fs.writeFileSync(path.join(root, "sw.js"), sw);

const kb = f => Math.round(fs.statSync(path.join(root, f)).size / 1024) + " KB";
console.log("Gebaut:");
for (const name of outputs) console.log("  " + name.padEnd(28) + kb(name));
console.log("  manifest.webmanifest        " + kb("manifest.webmanifest"));
console.log("  sw.js                       " + kb("sw.js") + "  (Version " + version + ")");
console.log("  icons/                      " + iconFiles.length + " Dateien");
