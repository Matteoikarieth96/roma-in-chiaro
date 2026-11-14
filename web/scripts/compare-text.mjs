/* Confronta il sito statico (../site/index.html, rotte #/...) con l'export Next.js (out/), pagina per pagina.
   Per ogni pagina confronta: testo visibile di <main id="app">, testi delle icone info (data-info),
   titoli degli SVG fuori dalla mappa, link (con gli indirizzi tradotti #/x -> /x/),
   il testo del piè di pagina, il menu delle sezioni (voci, indirizzi, voce attiva) e il titolo della scheda.
   Sulla mappa prova anche ogni indicatore del menu a tendina. Raccoglie gli errori della console di tutti e
   due i siti. Sulle pagine dei fondi controlla lo scorrimento orizzontale (1280 e 375, chiaro e scuro) e,
   a 375, il pannello del menu (si apre, il fuoco entra, Esc lo chiude e il fuoco torna al pulsante).
   Mappa della pagina iniziale (Leaflet con i quartieri): aspetta che compaia in tutti e due i siti, la toglie dal
   testo confrontato (zoom e nomi dipendono dal momento) e confronta invece se c'è, la riga dei crediti sotto la
   mappa e il pannello "Mappa della pagina iniziale" delle fonti. Del sito statico elenca gli indirizzi esterni
   chiamati: devono essere solo le tile di OpenStreetMap.

   Uso (dopo `npm run build`):  node scripts/compare-text.mjs [--shots]
   --shots salva anche le schermate in screenshots/ (desktop 1280 e mobile 375, chiaro e scuro, menu aperto);
   quelle del sito statico hanno il prefisso statico-.
   Chrome: quello installato sul Mac (variabile CHROME per un altro percorso). Parte sempre con
   --use-mock-keychain --password-store=basic e si chiude alla fine. */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(WEB, "out");
const OLD = pathToFileURL(join(WEB, "..", "site", "index.html")).href;
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = process.argv.includes("--shots");
const VERBOSE = process.argv.includes("--verbose");  /* stampa a che punto è, per capire dove si ferma */
const passo = t => { if (VERBOSE) process.stderr.write("· " + t + "\n"); };
if (!existsSync(join(OUT, "index.html"))) throw new Error("manca out/: lancia prima npm run build");

/* server statico minimo per out/ (cartelle con index.html, come un hosting qualsiasi) */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".json": "application/json", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = join(OUT, p);
  if (!f.startsWith(OUT)) { res.writeHead(403).end(); return; }
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404, { "content-type": TYPES[".html"] }).end(readFileSync(join(OUT, "404.html"))); return; }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }).end(readFileSync(f));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const NEW = `http://127.0.0.1:${server.address().port}`;

/* vecchio indirizzo -> nuovo, per confrontare i link */
function mapHref(h) {
  if (!h || !h.startsWith("#")) return h;
  const raw = h.replace(/^#\/?/, ""), [path, qs = ""] = raw.split("?"), s = path.split("/");
  if (!raw) return "/";
  if (s[0] === "municipio") return `/municipio/${s[1]}/`;
  if (s[0] === "confronto") return s[1] ? `/confronto/?a=${s[1]}&b=${s[2] || ""}` : "/confronto/";
  if (s[0] === "cerca") return "/cerca/" + (qs ? "?" + qs : "");
  return `/${s[0]}/`;
}
const fixInfo = html => html.replace(/href="(#[^"]*)"/g, (_, h) => `href="${mapHref(h)}"`);

const ROUTES = [
  ["mappa", "#/", "/"],
  ...Array.from({ length: 15 }, (_, i) => [`municipio-${i + 1}`, `#/municipio/${i + 1}`, `/municipio/${i + 1}/`]),
  ["tutti", "#/tutti", "/tutti/"],
  ["confronto", "#/confronto", "/confronto/"],
  ["confronto-6-12", "#/confronto/6/12", "/confronto/?a=6&b=12"],
  ["confronto-15-1", "#/confronto/15/1", "/confronto/?a=15&b=1"],
  ["confronto-1-6", "#/confronto/1/6", "/confronto/?a=1&b=6"],
  ["fonti", "#/fonti", "/fonti/"],
  ["pnrr", "#/pnrr", "/pnrr/"],
  ["giubileo-2025", "#/giubileo-2025", "/giubileo-2025/"],
  ["cerca", "#/cerca", "/cerca/"],
  ["cerca-ostia", "#/cerca?q=Ostia", "/cerca/?q=Ostia"],
  ["cerca-tiburtina", "#/cerca?q=Via%20Tiburtina", "/cerca/?q=Via%20Tiburtina"],
  ["cerca-borghese", "#/cerca?q=Villa%20Borghese", "/cerca/?q=Villa%20Borghese"],
  ["cerca-quartieri", "#/cerca?q=Ostia&c=quartieri", "/cerca/?q=Ostia&c=quartieri"],
  ["cerca-vuota", "#/cerca?q=Tor%20Bela%20Monca", "/cerca/?q=Tor%20Bela%20Monca"],
  ["cerca-scuola", "#/cerca?q=scuola", "/cerca/?q=scuola"],
];

const snap = () => {
  const app = document.getElementById("app");
  const foot = document.querySelector("footer");
  /* la mappa Leaflet resta fuori dal testo: si confronta solo se c'è */
  const lf = app.querySelector(".mq-map"), prima = lf?.style.display;
  if (lf) lf.style.display = "none";
  const text = app.innerText;
  if (lf) lf.style.display = prima;
  const fuori = el => !el.closest(".mq-map");
  const pannello = [...app.querySelectorAll(".panel")].find(p => p.querySelector(":scope > h3")?.textContent.trim().startsWith("Mappa della pagina iniziale"));
  return {
    text,
    leaflet: !!app.querySelector(".panel.map .leaflet-container"),
    credito: app.querySelector(".map-credit")?.innerText ?? null,
    pannelloMappa: pannello ? pannello.innerText : null,
    info: [...app.querySelectorAll("[data-info]")].filter(fuori).map(b => b.getAttribute("data-info")),
    titles: [...app.querySelectorAll("svg title")].filter(t => !t.closest(".panel.map")).map(t => t.textContent),
    links: [...app.querySelectorAll("a[href]")].filter(fuori).map(a => a.getAttribute("href") + " | " + a.textContent.trim()),
    footer: foot ? foot.innerText : "",
    nav: [...document.querySelectorAll("#menu nav a")].map(a => a.getAttribute("href") + " | " + a.textContent.trim() + (a.getAttribute("aria-current") === "page" ? " | attiva" : "")),
    groups: [...document.querySelectorAll("#menu nav .grp-t")].map(g => g.textContent.trim()),
    contatti: [...document.querySelectorAll("#menu .contatti .grp-t, #menu .contatti li > *")].map(e => [e.tagName === "A" ? e.getAttribute("href") : "", e.getAttribute("target") || "", e.getAttribute("rel") || "", e.textContent.trim()].join(" | ")),
    bottone: (b => b ? b.getAttribute("aria-label") + " | " + b.getAttribute("aria-expanded") : "")(document.querySelector(".menu-btn")),
    title: document.title,
  };
};

function diffLines(a, b) {
  const A = a.split("\n"), B = b.split("\n"), out = [];
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n && out.length < 12; i++) if (A[i] !== B[i]) out.push(`  riga ${i + 1}\n    vecchio: ${JSON.stringify(A[i])}\n    nuovo:   ${JSON.stringify(B[i])}`);
  return out;
}
function compare(name, o, n) {
  const d = [];
  if (o.text !== n.text) d.push(`testo visibile diverso:\n${diffLines(o.text, n.text).join("\n")}`);
  const oi = o.info.map(fixInfo);
  if (JSON.stringify(oi) !== JSON.stringify(n.info)) {
    const k = oi.findIndex((x, i) => x !== n.info[i]);
    d.push(`icone info diverse (${oi.length} vecchie, ${n.info.length} nuove), prima differenza #${k}:\n    vecchio: ${oi[k]}\n    nuovo:   ${n.info[k]}`);
  }
  if (JSON.stringify(o.titles) !== JSON.stringify(n.titles)) d.push(`titoli degli SVG diversi`);
  if (o.leaflet !== n.leaflet) d.push(`mappa con i quartieri: ${o.leaflet ? "c'è" : "manca"} nel sito statico, ${n.leaflet ? "c'è" : "manca"} in Next.js`);
  if (o.credito !== n.credito) d.push(`crediti sotto la mappa diversi:\n    vecchio: ${JSON.stringify(o.credito)}\n    nuovo:   ${JSON.stringify(n.credito)}`);
  if (o.pannelloMappa !== n.pannelloMappa) d.push(`pannello "Mappa della pagina iniziale" diverso:\n${diffLines(o.pannelloMappa || "", n.pannelloMappa || "").join("\n")}`);
  const ol = o.links.map(l => { const [h, ...t] = l.split(" | "); return mapHref(h) + " | " + t.join(" | "); });
  if (JSON.stringify(ol) !== JSON.stringify(n.links)) {
    const k = ol.findIndex((x, i) => x !== n.links[i]);
    d.push(`link diversi (${ol.length} vecchi, ${n.links.length} nuovi), primo: ${ol[k]}  ->  ${n.links[k]}`);
  }
  if (o.footer !== n.footer) d.push(`piè di pagina diverso:\n${diffLines(o.footer, n.footer).join("\n")}`);
  const on = o.nav.map(l => { const [h, ...t] = l.split(" | "); return mapHref(h) + " | " + t.join(" | "); });
  if (JSON.stringify(on) !== JSON.stringify(n.nav) || JSON.stringify(o.groups) !== JSON.stringify(n.groups)) d.push(`menu diverso:\n    vecchio: ${JSON.stringify(o.groups)} ${JSON.stringify(on)}\n    nuovo:   ${JSON.stringify(n.groups)} ${JSON.stringify(n.nav)}`);
  if (JSON.stringify(o.contatti) !== JSON.stringify(n.contatti)) d.push(`contatti del menu diversi:\n    vecchio: ${JSON.stringify(o.contatti)}\n    nuovo:   ${JSON.stringify(n.contatti)}`);
  if (o.bottone !== n.bottone) d.push(`pulsante del menu diverso: ${o.bottone} -> ${n.bottone}`);
  if (o.title !== n.title) d.push(`titolo della scheda diverso: ${JSON.stringify(o.title)} -> ${JSON.stringify(n.title)}`);
  return d;
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ["--use-mock-keychain", "--password-store=basic", "--no-first-run", "--no-default-browser-check"],
});
const errors = [];
const report = [];
let pass = 0;
const tileKo = { statico: 0, next: 0 }, esterni = new Set();
try {
  const oldP = await browser.newPage(), newP = await browser.newPage();
  for (const p of [oldP, newP]) await p.setViewport({ width: 1280, height: 900 });
  newP.on("console", m => { if (m.type() === "error" || m.type() === "warn") errors.push(`${m.type()}: ${m.text()} (${newP.url()})`); });
  newP.on("pageerror", e => errors.push(`pageerror: ${e.message} (${newP.url()})`));
  const sito = u => "statico " + u.replace(/^.*index\.html/, "");
  oldP.on("console", m => { if (m.type() === "error" || m.type() === "warn") errors.push(`${m.type()}: ${m.text()} (${sito(oldP.url())})`); });
  oldP.on("pageerror", e => errors.push(`pageerror: ${e.message} (${sito(oldP.url())})`));
  const OSM = u => /^https:\/\/tile\.openstreetmap\.org\//.test(u);
  newP.on("requestfailed", r => { if (OSM(r.url())) tileKo.next++; else errors.push(`request failed: ${r.url()}`); });
  oldP.on("requestfailed", r => { if (OSM(r.url())) tileKo.statico++; else errors.push(`request failed (statico): ${r.url()}`); });
  oldP.on("request", r => { const u = r.url(); if (!/^(file|data|about|blob):/.test(u)) esterni.add(OSM(u) ? "https://tile.openstreetmap.org/ (tile)" : u); });
  newP.on("response", r => { if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  const settle = async (p, cerca) => {
    await new Promise(r => setTimeout(r, 250));
    if (cerca) await p.waitForFunction(() => document.querySelector("#s-res")?.children.length > 0, { timeout: 8000 });
    /* pagina iniziale: la mappa con i quartieri arriva dopo il caricamento */
    if (await p.$(".map-credit")) await p.waitForFunction(() => document.querySelector(".panel.map .leaflet-container"), { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 250));
  };
  await oldP.goto(OLD + "#/", { waitUntil: "load" });
  for (const [name, oh, nh] of ROUTES) {
    const cerca = name.startsWith("cerca"); passo(name);
    /* pagina vecchia: si ricarica da capo, come se l'indirizzo fosse aperto in una scheda nuova */
    await oldP.goto("about:blank"); await oldP.goto(OLD + oh, { waitUntil: "load" }); await settle(oldP, cerca);
    await newP.goto(NEW + nh, { waitUntil: "networkidle0" }); await settle(newP, cerca);
    const o = await oldP.evaluate(snap), n = await newP.evaluate(snap);
    const d = compare(name, o, n);
    if (n.text.length < 200) d.push(`pagina quasi vuota (${n.text.length} caratteri)`);
    const quanto = `${n.text.length} caratteri, ${n.info.length} icone info, ${n.links.length} link`;
    report.push(d.length ? `✗ ${name} (${quanto})\n  ${d.join("\n  ")}` : `✓ ${name} (${quanto})`); if (!d.length) pass++;
  }
  /* mappa: ogni indicatore del menu a tendina */
  await oldP.goto("about:blank"); await oldP.goto(OLD + "#/", { waitUntil: "load" }); await settle(oldP);
  await newP.goto(NEW + "/", { waitUntil: "networkidle0" }); await settle(newP);
  const opts = await newP.$$eval("#pick option", o => o.map(x => x.value));
  let okM = 0; const badM = [];
  for (const v of opts) {
    for (const p of [oldP, newP]) { await p.select("#pick", v); }
    await settle(oldP); await settle(newP);
    const d = compare(v, await oldP.evaluate(snap), await newP.evaluate(snap));
    if (d.length) badM.push(`✗ mappa con ${v}\n  ${d.join("\n  ")}`); else okM++;
  }
  report.push(`${badM.length ? "✗" : "✓"} mappa: ${okM} indicatori su ${opts.length} uguali`, ...badM);

  /* pagine dei fondi straordinari, su tutti e due i siti: scorrimento orizzontale a 1280 e 375, chiaro e scuro,
     pannello del menu a 375 e, con --shots, schermate della pagina intera (prefisso statico- per il sito vecchio) */
  const FONDI = [["pnrr", "#/pnrr", "/pnrr/"], ["giubileo-2025", "#/giubileo-2025", "/giubileo-2025/"]];
  const menuOk = async p => {
    passo("menu");
    /* due schede nello stesso Chrome: quella dietro non disegna, e il clic di puppeteer aspetta un disegno che non arriva */
    await p.bringToFront();
    await p.click(".menu-btn"); await new Promise(r => setTimeout(r, 400));
    const aperto = await p.evaluate(() => ({ open: document.getElementById("menu")?.dataset.open === "true", dentro: !!document.activeElement?.closest("#menu"), corrente: document.activeElement?.getAttribute("aria-current") === "page" }));
    await p.keyboard.press("Escape"); await new Promise(r => setTimeout(r, 400));
    const chiuso = await p.evaluate(() => ({ open: document.getElementById("menu")?.dataset.open === "true", btn: document.activeElement?.classList.contains("menu-btn"), scroll: document.documentElement.style.overflow }));
    const ko = [];
    if (!aperto.open) ko.push("non si apre"); if (!aperto.dentro || !aperto.corrente) ko.push("il fuoco non va sulla voce attiva");
    if (chiuso.open) ko.push("Esc non lo chiude"); if (!chiuso.btn) ko.push("il fuoco non torna al pulsante"); if (chiuso.scroll === "hidden") ko.push("la pagina resta bloccata");
    return ko;
  };
  for (const [name, oh, nh] of FONDI) {
    const note = [];
    for (const [w, h] of [[1280, 900], [375, 812]]) for (const scheme of ["light", "dark"]) {
      for (const [p, url, sito, pre] of [[oldP, OLD + oh, "statico", "statico-"], [newP, NEW + nh, "Next.js", ""]]) {
        await p.setViewport({ width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
        await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
        passo(`${sito} ${name} ${w} ${scheme}`); if (p === oldP) await p.goto("about:blank");
        await p.goto(url, { waitUntil: p === oldP ? "load" : "networkidle0" }); await settle(p);
        const hs = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (hs > 0) { errors.push(`scorrimento orizzontale di ${hs}px: ${sito} ${name} a ${w}px, ${scheme}`); note.push(`${sito} scorre di ${hs}px a ${w}px`); }
        if (SHOTS) { mkdirSync(join(WEB, "screenshots"), { recursive: true }); await p.screenshot({ path: join(WEB, "screenshots", `${pre}${w < 500 ? "mobile" : "desktop"}-${name}-${scheme === "light" ? "chiaro" : "scuro"}.png`), fullPage: true }); }
        if (w < 500 && scheme === "light") { const ko = await menuOk(p); if (ko.length) { errors.push(`menu a 375px, ${sito} ${name}: ${ko.join(", ")}`); note.push(`menu ${sito}: ${ko.join(", ")}`); } }
      }
    }
    report.push(`${note.length ? "✗" : "✓"} ${name}: nessuno scorrimento orizzontale a 1280 e 375, chiaro e scuro; pannello del menu a 375 ok su tutti e due i siti${note.length ? " (tranne: " + note.join(", ") + ")" : ""}`);
  }
  await oldP.setViewport({ width: 1280, height: 900 }); await oldP.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  /* colonna del menu sul computer: il pulsante la chiude (contenuto a tutta larghezza), resta chiusa ricaricando, si riapre */
  await newP.setViewport({ width: 1280, height: 900 });
  for (const [p, url, sito] of [[oldP, OLD + "#/tutti", "statico"], [newP, NEW + "/tutti/", "Next.js"]]) {
    passo(`colonna del menu ${sito}`);
    const stato = () => p.evaluate(() => { const b = document.querySelector(".menu-btn"), s = document.getElementById("menu");
      return { label: b.getAttribute("aria-label"), exp: b.getAttribute("aria-expanded"), vis: getComputedStyle(s).display !== "none",
        largo: Math.round(document.querySelector(".content").getBoundingClientRect().width), memo: (() => { try { return localStorage.getItem("menu"); } catch { return "?"; } })() }; });
    if (p === oldP) await p.goto("about:blank");
    await p.goto(url, { waitUntil: p === oldP ? "load" : "networkidle0" }); await settle(p); await p.bringToFront();
    const a = await stato();
    await p.click(".menu-btn"); await new Promise(r => setTimeout(r, 300)); const c = await stato();
    if (p === oldP) await p.goto("about:blank");
    await p.goto(url, { waitUntil: p === oldP ? "load" : "networkidle0" }); await settle(p); const r = await stato();
    await p.bringToFront(); await p.click(".menu-btn"); await new Promise(r => setTimeout(r, 300)); const z = await stato();
    const ko = [];
    if (!(a.vis && a.label === "Chiudi il menu" && a.exp === "true")) ko.push(`all'inizio ${JSON.stringify(a)}`);
    if (!(!c.vis && c.label === "Apri il menu" && c.exp === "false" && c.largo > a.largo && c.memo === "chiuso")) ko.push(`chiusa ${JSON.stringify(c)}`);
    if (!(!r.vis && r.label === "Apri il menu")) ko.push(`ricaricando ${JSON.stringify(r)}`);
    if (!(z.vis && z.label === "Chiudi il menu" && z.exp === "true" && z.memo === "aperto")) ko.push(`riaperta ${JSON.stringify(z)}`);
    if (ko.length) errors.push(`colonna del menu, ${sito}: ${ko.join("; ")}`);
    report.push(`${ko.length ? "✗" : "✓"} colonna del menu ${sito} a 1280: si chiude (contenuto da ${a.largo} a ${c.largo} px), resta chiusa ricaricando, si riapre`);
  }
  await newP.setViewport({ width: 1280, height: 900 }); await newP.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);

  if (SHOTS) {
    const dir = join(WEB, "screenshots"); mkdirSync(dir, { recursive: true });
    const shot = async (file, url, w, h, scheme, prep, p = newP) => {
      await p.setViewport({ width: w, height: h, deviceScaleFactor: w < 500 ? 2 : 1, isMobile: w < 500, hasTouch: w < 500 });
      await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
      if (p === oldP) { await p.goto("about:blank"); await p.goto(OLD + url, { waitUntil: "load" }); await settle(p); }
      else { await p.goto(NEW + url, { waitUntil: "networkidle0" }); await settle(p, url.startsWith("/cerca")); }
      if (prep) await prep(p);
      const hs = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (hs > 0) errors.push(`scorrimento orizzontale di ${hs}px: ${file}`);
      await p.bringToFront(); await new Promise(r => setTimeout(r, 300));
      await p.screenshot({ path: join(dir, file) });
    };
    const openMenu = async p => { await p.click(".menu-btn"); await new Promise(r => setTimeout(r, 400)); };
    for (const scheme of ["light", "dark"]) {
      const t = scheme === "light" ? "chiaro" : "scuro";
      await shot(`desktop-mappa-${t}.png`, "/", 1280, 900, scheme);
      await shot(`desktop-municipio-6-${t}.png`, "/municipio/6/", 1280, 900, scheme);
      await shot(`desktop-cerca-ostia-${t}.png`, "/cerca/?q=Ostia", 1280, 900, scheme);
      await shot(`mobile-mappa-${t}.png`, "/", 375, 812, scheme);
      await shot(`mobile-menu-aperto-${t}.png`, "/tutti/", 375, 812, scheme, openMenu);
      await shot(`mobile-municipio-6-${t}.png`, "/municipio/6/", 375, 812, scheme);
      for (const [w, h, f] of [[1280, 900, "desktop"], [375, 812, "mobile"]]) {
        await shot(`statico-${f}-mappa-${t}.png`, "#/", w, h, scheme, null, oldP);
        await shot(`statico-${f}-municipio-6-${t}.png`, "#/municipio/6", w, h, scheme, null, oldP);
        await shot(`statico-${f}-confronto-1-6-${t}.png`, "#/confronto/1/6", w, h, scheme, null, oldP);
      }
    }
    await shot("desktop-confronto-chiaro.png", "/confronto/?a=6&b=12", 1280, 900, "light");
    await shot("desktop-fonti-scuro.png", "/fonti/", 1280, 900, "dark");
    await shot("mobile-cerca-chiaro.png", "/cerca/?q=Villa%20Borghese", 375, 812, "light");
  }
} finally {
  await browser.close();
  server.close();
}
report.push(`indirizzi esterni chiamati dal sito statico: ${[...esterni].join(", ") || "nessuno"}`,
  `tile di OpenStreetMap non scaricate (non contano come errore): statico ${tileKo.statico}, Next.js ${tileKo.next}`);
const txt = [`Confronto sito statico / Next.js, ${new Date().toISOString()}`, `pagine uguali: ${pass} su ${ROUTES.length}`, ...report,
  `errori e avvisi nella console dei due siti: ${errors.length}`, ...errors.map(e => "  " + e)].join("\n");
writeFileSync(join(WEB, "screenshots", "confronto-testi.txt"), txt + "\n");
console.log(txt);
process.exit(pass === ROUTES.length && !errors.length ? 0 : 1);
