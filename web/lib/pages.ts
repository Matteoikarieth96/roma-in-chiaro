/* Pagine: stesso markup di scripts/template.html (pageHome, pageMunicipio, pageTutti, pageConfronta,
   pageFonti). Qui si costruisce solo l'HTML; i comportamenti (mappa, ordinamento, icone info) li
   aggiunge wire*() dopo che la pagina è nel DOM. */
import {
  A, D, IDS, LIC_ANAC_URL, M, MUN_BLOCKS, MUN_HEAD, MUN_KPIS, HERO_KPIS, HOME_BLOCKS, ROMANI, aLink, addInfo, barsRanking, dateIt, esc, fmt,
  fonteHtml, groupsOf, info, isNum, licenzaTesto, mapSvg, metric, metricInfo, metricSelect, metricSrc, naBlock, romaLabelOf, safeUrl, srcLine, values,
} from "./engine";
import { R } from "./routes";
import { graficiMunicipio, tempoTutti } from "./municipio-grafici";
import { creditoMappa, fontiMappa } from "./mappa";
import { classificheHome, torteHome } from "./home";

export type Nav = (href: string) => void;

/* ---------- testo breve: le spiegazioni lunghe passano nelle icone info ---------- */
function compact(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".head h2 + p").forEach(p => { const h = p.previousElementSibling as HTMLElement; addInfo(h, `<p>${p.innerHTML}</p>`, h.textContent || ""); p.remove(); });
  root.querySelectorAll<HTMLElement>(".panel > p.src:not(.keep):not(.fonte)").forEach(p => { const h = p.parentElement!.querySelector<HTMLElement>(":scope > h3"); if (!h) return; addInfo(h, `<p>${p.innerHTML}</p>`, h.textContent || ""); p.remove(); });
  root.querySelectorAll<HTMLElement>("section.block").forEach(sec => {
    const notes = [...sec.querySelectorAll<HTMLElement>(":scope > p.src:not(.fonte):not(.keep)")]; if (!notes.length) return;
    const html = notes.map(n => `<p>${n.innerHTML}</p>`).join("");
    const f = sec.querySelector<HTMLElement>(":scope > p.fonte > .info"), h = sec.querySelector<HTMLElement>(".head h2");
    if (f) f.dataset.info = html + f.dataset.info; else if (h) addInfo(h, html, h.textContent || ""); else return;
    notes.forEach(n => n.remove());
  });
}

/* ---------- tabelle: ordina cliccando l'intestazione ---------- */
function cellVal(td: HTMLTableCellElement | undefined) {
  if (!td) return null;
  if (td.dataset.v !== undefined) return td.dataset.v === "" ? null : Number(td.dataset.v);
  const t = (td.innerText || td.textContent || "").split("\n")[0].trim();
  if (!t || t === "n.d." || t === "Non disponibile") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t;
  const m = t.match(/^[+-]?\d[\d.]*(,\d+)?/);
  if (m) { let n = Number(m[0].replace(/\./g, "").replace(",", ".")); if (/\bmld\b/.test(t)) n *= 1e9; else if (/\bmln\b/.test(t)) n *= 1e6; return n; }
  return t.toLowerCase();
}
function cmpVals(a, b, dir) {
  if (a === null) return b === null ? 0 : 1; if (b === null) return -1; /* i vuoti restano in fondo */
  const r = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "it", { numeric: true });
  return r * dir;
}
function enhanceTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>(".table-wrap > table").forEach(tbl => {
    if (tbl.dataset.ok) return; tbl.dataset.ok = "1";
    const tb = tbl.tBodies[0]; if (!tb || !tbl.tHead) return;
    const heads = [...tbl.tHead.rows[tbl.tHead.rows.length - 1].cells];
    const body = [...tb.rows].filter(r => !r.classList.contains("tot")), tot = [...tb.rows].filter(r => r.classList.contains("tot"));
    let sort = { col: -1, dir: 1 };
    heads.forEach((th, c) => {
      th.classList.add("sort"); th.tabIndex = 0;
      const first = th.firstChild; if (first && first.nodeType === 3) { const s = document.createElement("span"); s.className = "lab"; s.textContent = first.textContent; th.replaceChild(s, first); }
      const go = (e: Event) => {
        if ((e.target as HTMLElement).closest(".info,a")) return;
        sort = { col: c, dir: sort.col === c ? -sort.dir : (th.classList.contains("num") ? -1 : 1) };
        heads.forEach(h => h.removeAttribute("aria-sort")); th.setAttribute("aria-sort", sort.dir > 0 ? "ascending" : "descending");
        body.slice().sort((x, y) => cmpVals(cellVal(x.cells[c]), cellVal(y.cells[c]), sort.dir)).concat(tot).forEach(r => tb.appendChild(r));
      };
      th.addEventListener("click", go); th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } });
    });
  });
}
/* L'icona info resta attaccata all'ultima parola (span.info-g, white-space:nowrap): senza, a fine riga andava a capo
   da sola. Se prima c'è un elemento in linea (non un link), l'icona entra al suo interno dopo l'ultimo testo;
   un link corto resta intero con l'icona. Gira dopo compact, che cerca le icone come figlie dirette. */
function incollaInfo(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".info").forEach(b => {
    if (b.parentElement?.classList.contains("info-g")) return;
    let prev = b.previousSibling;
    while (prev instanceof HTMLElement && prev.tagName !== "A" && prev.lastChild && getComputedStyle(prev).display === "inline") { prev.appendChild(b); prev = b.previousSibling; }
    const g = document.createElement("span"); g.className = "info-g";
    if (prev instanceof Text) {
      const m = /\S+\s*$/.exec(prev.textContent || ""); if (!m) return;
      const parola = prev.splitText(m.index);
      b.before(g); g.append(parola, b);
    } else if (prev instanceof HTMLElement && prev.tagName === "A") { b.before(g); g.append(prev, b); }
  });
}
export function afterRender(root: HTMLElement, fonti = false) { if (!fonti) compact(root); enhanceTables(root); incollaInfo(root); }

export function wireMap(root: HTMLElement, signal: AbortSignal, onClick: (id: string) => void) {
  const tip = document.getElementById("tip");
  root.querySelectorAll<SVGPathElement>(".map path").forEach(p => {
    p.addEventListener("click", () => onClick(p.dataset.id!), { signal });
    if (!tip) return;
    p.addEventListener("mousemove", e => { tip.style.display = "block"; tip.textContent = p.querySelector("title")!.textContent; tip.style.left = Math.min(e.clientX + 14, innerWidth - 270) + "px"; tip.style.top = (e.clientY + 14) + "px"; }, { signal });
    p.addEventListener("mouseleave", () => { tip.style.display = "none"; }, { signal });
  });
}

/* ---------- pagine ---------- */
export const homeMetric = (cur: string | null) => metric(cur) || M.find(x => x.home) || M[0];
export function htmlHome(cur: string | null) {
  const m = homeMetric(cur);
  const heroKpis = HERO_KPIS.map(f => f()).join("");
  return `
  <div class="hero"><div class="hero-marchio"><span class="marchio" aria-hidden="true"></span><h1>Dove vanno i soldi dei Municipi di Roma</h1></div>
    <p class="lede">Bilancio, appalti, progetti e servizi dei 15 municipi. Ogni numero ha fonte e periodo.</p></div>
  ${heroKpis ? `<div class="grid g4">${heroKpis}</div>` : ""}
  ${classificheHome()}
  <section class="block"><div class="head"><div><h2>La mappa</h2><p>Scegli un indicatore: la mappa e la classifica si aggiornano. Clicca un municipio per aprire la sua scheda.</p></div><div class="metric-pick">${metricSelect(m.id)}</div></div>
    <div class="map-layout"><div class="panel map">${mapSvg(m)}${creditoMappa()}</div><div class="panel"><h3>${esc(m.label)}</h3>${barsRanking(m)}${m.note ? `<p class="src">${esc(m.note)}</p>` : ""}</div></div>
    ${metricSrc(m)}</section>
  ${HOME_BLOCKS.map(f => f()).join("")}
  ${torteHome()}`;
}

export function htmlMunicipio(id: string) {
  if (!IDS.includes(id)) id = "1";
  const head = MUN_HEAD.map(f => f(id)).join("");
  return `
  <div class="hero"><nav class="mun-nav" aria-label="Municipi">${IDS.map(i => `<a href="${R.mun(i)}"${i === id ? ' aria-current="page"' : ""}>${ROMANI[i]}</a>`).join("")}</nav>
    <div class="mun-title"><h1>Municipio ${ROMANI[id]}</h1><a class="btn" href="${R.conf(id, id === "1" ? "2" : "1")}" title="Confronta con un altro municipio" aria-label="Confronta il Municipio ${ROMANI[id]} con un altro municipio"><svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5v13M14 3.5v13"/><path d="M3.5 6 6 3.5 8.5 6M11.5 14l2.5 2.5 2.5-2.5"/></svg></a></div>${head}</div>
  <div class="grid g4">${MUN_KPIS.map(f => f(id)).join("")}</div>
  ${graficiMunicipio(id, MUN_BLOCKS.map(f => f(id)))}
  <section class="block"><div class="head"><div><h2>Profilo del territorio</h2><p>Abitanti, redditi, imprese e servizi. A destra il valore di Roma: sotto ogni numero è scritto se è la somma dei municipi o il totale della città.</p></div></div>
    ${A ? `<div class="table-wrap"><table><thead><tr><th>Indicatore</th><th>Periodo</th><th class="num">Municipio ${ROMANI[id]}</th><th class="num">Posizione</th><th class="num">Roma</th></tr></thead><tbody>
    ${M.filter(m => m.snap === "profilo_annuario").map(m => { const vs = values(m).filter(r => isNum(r.v)).sort((x, y) => y.v - x.v); const pos = vs.findIndex(r => r.id === id) + 1;
      return `<tr><td>${esc(m.label)}<br><small class="src" style="margin:0">${esc(m.src)}</small></td><td>${esc(m.periodo)}</td><td class="num">${fmt(m.get(id), m.unit)}</td><td class="num" data-v="${pos || ""}">${pos ? pos + "° su " + vs.length : "n.d."}</td><td class="num">${fmt(m.roma, m.unit)}${isNum(m.roma) ? `<br><small class="src" style="margin:0">${esc(romaLabelOf(m))}</small>` : ""}</td></tr>`; }).join("")}
    </tbody></table></div>${srcLine("profilo_annuario", "tabelle indicate riga per riga")}` : naBlock("Profilo")}
  </section>`;
}

/* Tutti i municipi: ogni indicatore in tabelle per gruppo, ordinabili */
export function htmlTutti() {
  const cols = M, groups = groupsOf(cols);
  return `
  <div class="hero"><h1>Tutti i municipi</h1>
  <p class="lede">Ogni indicatore per i 15 municipi. Clicca un'intestazione per ordinare.</p></div>
  ${tempoTutti()}
  ${groups.map(g => { const gc = cols.filter(m => m.group === g);
    const ref = Object.fromEntries(gc.map(m => [m.id, Math.max(...IDS.map(id => m.get(id)).filter(isNum))]));
    return `<section class="block"><div class="head"><div><h2>${esc(g)}</h2><p>Gli indicatori hanno periodi diversi: leggi il periodo sotto ciascun nome prima di metterli in relazione.</p></div></div>
  <div class="table-wrap"><table><thead><tr><th>Municipio</th>${gc.map(m => `<th class="num">${esc(m.label)}${info(metricInfo(m), m.label)}<br><small>${esc(m.periodo || "")}</small></th>`).join("")}</tr></thead>
  <tbody>${IDS.map(id => `<tr><td data-v="${id}"><a href="${R.mun(id)}">Municipio ${ROMANI[id]}</a></td>${gc.map(m => { const v = m.get(id); return `<td class="num" data-v="${isNum(v) ? v : ""}">${fmt(v, m.unit, ref[m.id])}</td>`; }).join("")}</tr>`).join("")}
  ${gc.some(m => isNum(m.roma)) ? `<tr class="tot"><td>Roma</td>${gc.map(m => `<td class="num">${fmt(m.roma, m.unit)}${isNum(m.roma) ? `<br><small style="font-weight:400">${esc(romaLabelOf(m))}</small>` : ""}</td>`).join("")}</tr>` : ""}</tbody></table></div>
  ${[...new Set(gc.map(m => m.snap))].map(s => srcLine(s)).join("")}</section>`; }).join("")}`;
}

export function htmlFonti() {
  const snaps = Object.entries(D).filter(([k, s]) => s && s.fonte && k !== "mappa");
  const lst = v => Array.isArray(v) ? v : (v ? [v] : []);
  return `
  <div class="hero"><h1>Da dove vengono i numeri</h1>
  <p class="lede">Il sito non calcola stime e non riempie i vuoti: se un dato manca, lo dice. Ogni insieme di dati viene scaricato da uno script che si può rilanciare e controllato contro i totali stampati nella fonte.</p></div>
  <section class="block"><div class="head"><div><h2>Regole</h2></div></div><div class="grid g2">
    <div class="panel"><h3>Cosa facciamo</h3><ul>
      <li>Ogni numero porta la fonte, il periodo e la data in cui abbiamo scaricato i file della fonte.</li>
      <li>Stanziamenti, appalti e pagamenti restano separati: sono contabilità diverse e non si sommano.</li>
      <li>I municipi si confrontano tra loro. Accanto a ogni valore di Roma scriviamo cosa è: la somma dei municipi, il totale della città o tutte le strutture di Roma Capitale.</li>
      <li>I progetti PNRR, Giubileo e fondi UE sono mostrati nel municipio dove si trovano. Sono gestiti per lo più dai dipartimenti di Roma Capitale: non sono spesa del municipio.</li>
      <li>I valori per abitante usano i residenti al 31/12/2025 (Annuario, Tab. 1.2).</li></ul></div>
    <div class="panel"><h3>Cosa non facciamo</h3><ul>
      <li>Non stimiamo i dati mancanti e non trasformiamo un vuoto in zero.</li>
      <li>Non attribuiamo ai municipi la spesa dei dipartimenti centrali, anche se avviene sul loro territorio. Unica eccezione sono i progetti con fondi straordinari: li mostriamo per luogo, non come spesa del municipio.</li>
      <li>Un valore alto o basso è un segnale da approfondire, non la prova di uno spreco.</li>
      <li>SIOPE e i pagamenti trimestrali di Roma Capitale non hanno il dettaglio per municipio: per questo non mostriamo pagamenti per municipio.</li>
      <li>Non mostriamo le imprese aggiudicatarie: il dataset dei CIG non le contiene; ANAC le pubblica in un altro insieme di dati, non ancora collegato.</li></ul></div>
  </div></section>
  <section class="block"><div class="head"><div><h2>Insiemi di dati</h2></div></div><div class="grid g2">
  ${snaps.map(([k, s]) => `<div class="panel"><h3>${esc(s.titolo || k)}</h3>
    <p class="src" style="margin-top:0">${fonteHtml(s.fonte)}${s.fonte.ente ? ", " + esc(s.fonte.ente) : ""}</p>
    ${s.periodo ? `<p><b>Periodo:</b> ${esc(typeof s.periodo === "string" ? s.periodo : Object.entries(s.periodo).map(([a, b]) => a + ": " + b).join("; "))}</p>` : ""}
    ${s.misura ? `<p><b>Cosa misura:</b> ${esc(s.misura)}</p>` : ""}
    ${lst(s.non_misura).length ? `<p><b>Cosa non misura:</b></p><ul>${lst(s.non_misura).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${s.indicatori ? `<details><summary>Limiti dei singoli indicatori</summary><ul>${Object.values<any>(s.indicatori).map(i => `<li><b>${esc(i.etichetta)}</b> (${esc(i.tabella)}, ${esc(i.periodo)}): ${lst(i.non_misura).map(esc).join(" ")}</li>`).join("")}</ul></details>` : ""}
    <p class="src"><b>Licenza:</b> ${esc(licenzaTesto(s.fonte))}${safeUrl(s.fonte.licenza_url) ? ` (${aLink(safeUrl(s.fonte.licenza_url), "testo della licenza")})` : (k === "appalti_anac" ? ` (${aLink(LIC_ANAC_URL, "testo della licenza")})` : "")} · file scaricati il ${dateIt(s.verificato)}</p>
    ${k === "appalti_anac" ? `<p class="src">Aggreghiamo e rielaboriamo per municipio i dati ANAC. Le tabelle che ne ricaviamo sono rilasciate con la stessa licenza, CC BY-SA 4.0.</p>` : ""}</div>`).join("")}
  <div class="panel"><h3>Confini dei municipi</h3><p class="src" style="margin-top:0">${esc(D.mappa?.fonte || "")}. I confini che ne ricaviamo restano sotto ${aLink("https://opendatacommons.org/licenses/odbl/1-0/", "ODbL 1.0")}.</p></div>
  ${fontiMappa()}
  </div></section>`;
}
