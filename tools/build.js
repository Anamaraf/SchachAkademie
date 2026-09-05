#!/usr/bin/env node
/* Baut aus src/ die Einzeldatei lauras-schach-akademie.html (CSS und JS werden eingebettet). */
"use strict";
const fs = require("fs"), path = require("path");
const src = path.join(__dirname, "..", "src"), out = path.join(__dirname, "..", "lauras-schach-akademie.html");
let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
html = html.replace(/<!-- BUILD:CSS -->[\s\S]*?<!-- \/BUILD:CSS -->/, () => "<style>\n" + fs.readFileSync(path.join(src, "style.css"), "utf8") + "\n</style>");
html = html.replace(/<!-- BUILD:JS -->[\s\S]*?<!-- \/BUILD:JS -->/, () => {
  const files = ["chess.js", "ai.js", "puzzles.js", "games.js", "app.js"];
  return files.map(f => "<script id=\"src-" + f.replace(".js", "") + "\">\n" + fs.readFileSync(path.join(src, f), "utf8").replace(/<\/script/gi, "<\\/script") + "\n</script>").join("\n");
});
fs.writeFileSync(out, html);
console.log("Gebaut: " + out + " (" + Math.round(fs.statSync(out).size / 1024) + " KB)");
