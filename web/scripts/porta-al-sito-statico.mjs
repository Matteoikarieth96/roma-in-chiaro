/* Porta nel sito statico (../scripts/template.html → ../site/index.html) il codice delle pagine che vive in web/lib:
   grafici condivisi, PNRR e Giubileo 2025, grafici della scheda municipio, Confronta e mappa della pagina iniziale.
   Toglie i tipi TypeScript (compilatore di web/node_modules) e scrive ../scripts/da-web.js, un solo blocco
   JavaScript che build.py mette nel file del sito al segnaposto __DA_WEB__ di template.html, prima del router. Così il testo e i grafici sono gli stessi
   nei due siti senza copiarli a mano.

   Uso, da web/ dopo ogni modifica a questi file:  npm run porta  (poi ../aggiorna.sh sito)
   compare-text.mjs segnala le pagine che non coincidono, per esempio se ci si dimentica di rilanciarlo.

   Differenze volute rispetto a Next.js, tutte qui sotto:
   - indirizzi con il cancelletto (#/municipio/6) al posto delle pagine vere (oggetto R);
   - Leaflet e i due file della mappa sono già nel file del sito (window.L e due <script type="application/json">),
     invece di essere scaricati a parte. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(WEB, "..", "scripts", "da-web.js");

/* in ordine: ogni file usa solo quelli prima di lui e le funzioni globali del sito statico */
const FILES = ["lib/grafici.ts", "lib/fondi.ts", "lib/home.ts", "lib/municipio-grafici.ts", "lib/confronto.ts", "lib/mappa.ts", "lib/mappa-leaflet.ts"];
const EXPORTS = ["wireGrafici", "htmlFondo", "wireFondo", "classificheHome", "torteHome", "graficiMunicipio", "tempoTutti", "htmlConfronto", "wireConfronto", "creditoMappa", "fontiMappa", "montaMappa"];

/* funzioni del sito statico che hanno lo stesso nome in engine.ts e pages.ts: devono esserci */
const GLOBALI = ["A", "D", "IDS", "M", "POP_SRC", "ROMANI", "aLink", "afterRender", "breaks", "dateIt", "esc", "f1", "f2", "fEur", "fInt", "fmt",
  "fonteHtml", "groupsOf", "info", "isNum", "kpi", "mapLabels", "metric", "metricInfo", "naBlock", "safeUrl", "srcLine", "values"];

/* sostituzioni puntuali: ognuna deve trovare esattamente il testo indicato */
const SOST = {
  "lib/mappa.ts": [["process.env.NEXT_PUBLIC_MAPPA_TILE_URL", '""']],
  "lib/mappa-leaflet.ts": [[
    'Promise.all([import("leaflet"), import("../data/mappa-quartieri.json"), import("../data/mappa-municipi.json")])',
    'Promise.all([window.L ? Promise.resolve(window.L) : Promise.reject(new Error("Leaflet assente")), jsonDa("mappa-quartieri"), jsonDa("mappa-municipi")])',
  ]],
};

const parti = [];
for (const f of FILES) {
  let src = readFileSync(join(WEB, f), "utf8");
  for (const [a, b] of SOST[f] || []) {
    const n = src.split(a).length - 1;
    if (n !== 1) throw new Error(`${f}: atteso 1 "${a.slice(0, 50)}…", trovati ${n}`);
    src = src.replace(a, b);
  }
  /* ogni file resta nel suo ambito (STATI, P e altri nomi si ripetono tra i file): riceve per nome solo
     quello che importa dagli altri file della lista e restituisce quello che esporta */
  const usa = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([\w-]+)"/g)) {
    const da = "lib/" + m[2] + ".ts";
    if (!FILES.includes(da)) continue; /* engine, pages, routes: funzioni globali del sito statico o R qui sotto */
    const nomi = m[1].split(",").map(x => x.trim()).filter(x => x && !x.startsWith("type "));
    usa.push(`const { ${nomi.join(", ")} } = MOD[${JSON.stringify(da)}];`);
  }
  const esporta = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let)\s+(\w+)/gm)].map(m => m[1]);
  let js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: false } }).outputText;
  /* import e export: nel sito statico tutto sta nello stesso blocco */
  js = js.replace(/^import\s[\s\S]*?from\s+"[^"]+";\s*$/gm, "").replace(/^import\s+"[^"]+";\s*$/gm, "").replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, "").replace(/^export\s*\{\s*\};?\s*$/gm, "");
  if (/^\s*(import|export)\b/m.test(js)) throw new Error(`${f}: import o export rimasti`);
  if (/\bimport\(/.test(js)) throw new Error(`${f}: import() rimasto`);
  parti.push(`/* ======== ${f} ======== */\nMOD[${JSON.stringify(f)}] = (() => {\n${usa.join("\n")}\n${js.trim()}\nreturn { ${esporta.join(", ")} };\n})();\n`);
}

const testo = `/* Generato da web/scripts/porta-al-sito-statico.mjs a partire da ${FILES.map(f => "web/" + f).join(", ")}.
   Non modificare a mano: cambia i file in web/lib, poi \`cd web && npm run porta\` e \`./aggiorna.sh sito\`.
   Codice distribuito sotto GNU AGPL-3.0 (vedi LICENSE). */
const DAWEB = (() => {
  "use strict";
  ${GLOBALI.map(g => `if (typeof ${g} === "undefined") throw new Error("da-web.js: manca ${g}");`).join("\n  ")}
  /* indirizzi del sito statico: le stesse pagine di web/lib/routes.ts, con il cancelletto */
  const R = {
    home: "#/",
    mun: id => "#/municipio/" + id,
    tutti: "#/tutti",
    conf: (a, b) => (a ? \`#/confronto/\${a}/\${b || ""}\` : "#/confronto"),
    fonti: "#/fonti",
    pnrr: "#/pnrr",
    giubileo: "#/giubileo-2025",
    cerca: (qs = "") => "#/cerca" + (qs ? "?" + qs : ""),
  };
  /* i due file della mappa sono nel sito come <script type="application/json"> */
  const jsonDa = id => new Promise((ok, no) => { const el = document.getElementById(id); if (!el) return no(new Error("manca " + id)); try { ok(JSON.parse(el.textContent)); } catch (e) { no(e); } });
  /* come wireMap di web/lib/pages.ts: clic e suggerimento sulla mappa SVG, con il segnale che li toglie */
  const wireMap = (root, signal, onClick) => {
    const tip = document.getElementById("tip");
    root.querySelectorAll(".map path").forEach(p => {
      p.addEventListener("click", () => onClick(p.dataset.id), { signal });
      if (!tip) return;
      p.addEventListener("mousemove", e => { tip.style.display = "block"; tip.textContent = p.querySelector("title").textContent; tip.style.left = Math.min(e.clientX + 14, innerWidth - 270) + "px"; tip.style.top = (e.clientY + 14) + "px"; }, { signal });
      p.addEventListener("mouseleave", () => { tip.style.display = "none"; }, { signal });
    });
  };

  const MOD = {};
${parti.join("\n")}
  const tutto = Object.assign({}, ...Object.values(MOD));
  for (const k of ${JSON.stringify(EXPORTS)}) if (typeof tutto[k] !== "function") throw new Error("da-web.js: manca " + k);
  return { ...tutto, wireMap };
})();
`;
/* niente "</script" dentro il blocco: chiuderebbe lo <script> del sito */
if (/<\/script/i.test(testo)) throw new Error("da-web.js contiene </script");
writeFileSync(OUT, testo);
console.log(`scripts/da-web.js: ${FILES.length} file, ${testo.split("\n").length} righe, ${Math.round(testo.length / 1024)} KB`);
