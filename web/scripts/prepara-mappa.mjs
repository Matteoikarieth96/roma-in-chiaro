/* Prepara i due file della mappa della pagina iniziale (web/data/mappa-municipi.json e
   web/data/mappa-quartieri.json). Si lancia a mano quando cambiano i confini, non al build:
     node scripts/prepara-mappa.mjs [percorso di quartieri-2026.simplified.geojson]
   Fonti (solo lettura):
   - quartieri, rioni e zone funzionali: data/quartieri-2026.simplified.geojson del progetto
     Quartieri di Roma 2026 di Urbe Hub (github.com/urbe-hub/quartieri-roma-2026, codice MIT),
     che lo ha scaricato dal geoportale GeoRoma di Roma Capitale (deliberazione A.C. n. 150/2026).
     I nomi, con gli accenti corretti, vengono da ../data/snapshot/quartieri.json (stesso codice area).
   - municipi: ../data/raw/municipi-roma.geojson, OpenStreetMap admin_level=9 (ODbL 1.0), lo
     stesso file usato per data/snapshot/mappa.json.
   Lo script semplifica le linee (Douglas-Peucker, circa 6 m), arrotonda a 5 decimali (circa 1 m)
   e calcola per ogni area un punto interno per l'etichetta. Nessun dato viene aggiunto. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(WEB, "..");
const QSRC = resolve(process.argv[2] || join(ROOT, "..", "quartieri-roma-2026", "data", "quartieri-2026.simplified.geojson"));
const MSRC = join(ROOT, "data", "raw", "municipi-roma.geojson");
const NOMI = join(ROOT, "data", "snapshot", "quartieri.json");
const OUT = join(WEB, "data");
const TOL = 0.00006; /* gradi, circa 5-7 m a Roma */

const r5 = v => Math.round(v * 1e5) / 1e5;
function dp(pts, tol) {
  if (pts.length < 5) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && md > tol * tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* anello semplificato e arrotondato, in [lat, lon] per Leaflet; mai meno di 4 punti */
function ring(r) {
  let s = dp(r, TOL); if (s.length < 4) s = r;
  const out = []; let prev = "";
  for (const [x, y] of s) { const p = [r5(y), r5(x)], k = p.join(); if (k !== prev) out.push(p); prev = k; }
  return out;
}
const polys = g => g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];

/* punto interno lontano dai bordi (algoritmo "polylabel", versione breve), sul poligono più grande */
function area(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return Math.abs(s / 2); }
function segDist2(px, py, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) { const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy); if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; } }
  dx = px - x; dy = py - y; return dx * dx + dy * dy;
}
function signedDist(x, y, poly) {
  let inside = false, md = Infinity;
  for (const r of poly) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    md = Math.min(md, segDist2(x, y, a, b));
  }
  return (inside ? 1 : -1) * Math.sqrt(md);
}
function polylabel(poly, prec = 0.0002) {
  const o = poly[0]; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of o) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const size = Math.min(x1 - x0, y1 - y0); if (!size) return [x0, y0];
  const cell = (x, y, h) => { const d = signedDist(x, y, poly); return { x, y, h, d, max: d + h * Math.SQRT2 }; };
  const q = []; let h = size / 2;
  for (let x = x0; x < x1; x += size) for (let y = y0; y < y1; y += size) q.push(cell(x + h, y + h, h));
  let best = cell((x0 + x1) / 2, (y0 + y1) / 2, 0);
  while (q.length) {
    q.sort((a, b) => a.max - b.max); const c = q.pop();
    if (c.d > best.d) best = c;
    if (c.max - best.d <= prec) continue;
    h = c.h / 2; q.push(cell(c.x - h, c.y - h, h), cell(c.x + h, c.y - h, h), cell(c.x - h, c.y + h, h), cell(c.x + h, c.y + h, h));
  }
  return [best.x, best.y];
}
function etichetta(g) {
  const big = polys(g).slice().sort((a, b) => area(b[0]) - area(a[0]))[0];
  const [x, y] = polylabel(big); return [r5(y), r5(x)];
}

const nomi = Object.fromEntries(JSON.parse(readFileSync(NOMI, "utf8")).aree.map(a => [a.codice, a]));
const Q = JSON.parse(readFileSync(QSRC, "utf8")).features.map(f => {
  const p = f.properties, n = nomi[p.codice];
  if (!n) throw new Error("area senza nome nello snapshot: " + p.codice);
  if (Number(n.municipio) !== Number(p.municipio_num_arabo)) throw new Error("municipio diverso per " + p.codice);
  return { c: p.codice, n: n.nome, t: n.tipo, m: Number(p.municipio_num_arabo), l: etichetta(f.geometry), g: polys(f.geometry).map(pl => pl.map(ring)) };
});
const M = JSON.parse(readFileSync(MSRC, "utf8")).features.map(f => ({
  m: Number(f.properties.municipio), l: etichetta(f.geometry), g: polys(f.geometry).map(pl => pl.map(ring)),
}));
if (M.length !== 15 || Q.length !== 457) throw new Error(`attesi 15 municipi e 457 aree, trovati ${M.length} e ${Q.length}`);

mkdirSync(OUT, { recursive: true });
const FQ = "Roma Capitale, geoportale GeoRoma, aree della deliberazione A.C. n. 150/2026 (dati aperti, art. 52, c. 2, CAD), dal file data/quartieri-2026.simplified.geojson di Quartieri di Roma 2026 (Urbe Hub, github.com/urbe-hub/quartieri-roma-2026); nomi da data/snapshot/quartieri.json; linee semplificate da web/scripts/prepara-mappa.mjs";
const FM = "OpenStreetMap, confini amministrativi admin_level=9, da data/raw/municipi-roma.geojson; © OpenStreetMap contributors, ODbL 1.0 (database derivato, resta sotto ODbL); linee semplificate da web/scripts/prepara-mappa.mjs";
writeFileSync(join(OUT, "mappa-quartieri.json"), JSON.stringify({ fonte: FQ, aree: Q }));
writeFileSync(join(OUT, "mappa-municipi.json"), JSON.stringify({ fonte: FM, municipi: M }));
const pts = a => a.reduce((s, x) => s + x.g.flat(2).length, 0);
console.log(`mappa: ${M.length} municipi (${pts(M)} punti), ${Q.length} aree (${pts(Q)} punti)`);
