/* Prima di `next dev` e `next build`.
   1. Elenca gli snapshot in ../data/snapshot (in ordine alfabetico, come scripts/build.py) e scrive
      generated/snapshots.js, che li importa così come sono: nessun numero viene copiato o cambiato.
   2. Costruisce l'indice della ricerca con lo script Python del progetto (build_search.py).
   I file in generated/ si rigenerano a ogni avvio e non vanno modificati a mano. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(WEB, "..");
const SNAP = join(ROOT, "data/snapshot");
const GEN = join(WEB, "generated");
mkdirSync(GEN, { recursive: true });

const files = readdirSync(SNAP).filter(f => f.endsWith(".json")).sort();
if (!files.length) throw new Error("nessuno snapshot in " + SNAP);
const keys = files.map(f => f.replace(/\.json$/, ""));
for (const k of keys) if (!/^[a-z0-9_]+$/.test(k)) throw new Error("nome di snapshot non valido: " + k);

const js = [
  "/* Generato da scripts/prepare-data.mjs: non modificare. */",
  ...keys.map((k, i) => `import s${i} from "../../data/snapshot/${k}.json";`),
  'import IX from "./search-index.json";',
  `export const D = { ${keys.map((k, i) => `${k}: s${i}`).join(", ")} };`,
  "export { IX };",
  "",
].join("\n");
writeFileSync(join(GEN, "snapshots.js"), js);
writeFileSync(join(GEN, "snapshots.d.ts"), "/* Generato da scripts/prepare-data.mjs */\nexport const D: Record<string, any>;\nexport const IX: any;\n");

/* L'indice usa solo la libreria standard di Python: il venv del progetto se c'è, altrimenti python3
   del sistema (per esempio sulle macchine di build di Vercel). */
const venv = join(ROOT, ".venv/bin/python");
const py = existsSync(venv) ? venv : "python3";
execFileSync(py, ["-I", join(WEB, "scripts/export_search_index.py"), join(GEN, "search-index.json")], { stdio: "inherit" });
console.log(`snapshot: ${keys.length} (${keys.join(", ")})`);
