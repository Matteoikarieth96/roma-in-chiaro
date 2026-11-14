/* Generato da web/scripts/porta-al-sito-statico.mjs a partire da web/lib/grafici.ts, web/lib/fondi.ts, web/lib/home.ts, web/lib/municipio-grafici.ts, web/lib/confronto.ts, web/lib/mappa.ts, web/lib/mappa-leaflet.ts.
   Non modificare a mano: cambia i file in web/lib, poi `cd web && npm run porta` e `./aggiorna.sh sito`.
   Codice distribuito sotto GNU AGPL-3.0 (vedi LICENSE). */
const DAWEB = (() => {
  "use strict";
  if (typeof A === "undefined") throw new Error("da-web.js: manca A");
  if (typeof D === "undefined") throw new Error("da-web.js: manca D");
  if (typeof IDS === "undefined") throw new Error("da-web.js: manca IDS");
  if (typeof M === "undefined") throw new Error("da-web.js: manca M");
  if (typeof POP_SRC === "undefined") throw new Error("da-web.js: manca POP_SRC");
  if (typeof ROMANI === "undefined") throw new Error("da-web.js: manca ROMANI");
  if (typeof aLink === "undefined") throw new Error("da-web.js: manca aLink");
  if (typeof afterRender === "undefined") throw new Error("da-web.js: manca afterRender");
  if (typeof breaks === "undefined") throw new Error("da-web.js: manca breaks");
  if (typeof dateIt === "undefined") throw new Error("da-web.js: manca dateIt");
  if (typeof esc === "undefined") throw new Error("da-web.js: manca esc");
  if (typeof f1 === "undefined") throw new Error("da-web.js: manca f1");
  if (typeof f2 === "undefined") throw new Error("da-web.js: manca f2");
  if (typeof fEur === "undefined") throw new Error("da-web.js: manca fEur");
  if (typeof fInt === "undefined") throw new Error("da-web.js: manca fInt");
  if (typeof fmt === "undefined") throw new Error("da-web.js: manca fmt");
  if (typeof fonteHtml === "undefined") throw new Error("da-web.js: manca fonteHtml");
  if (typeof groupsOf === "undefined") throw new Error("da-web.js: manca groupsOf");
  if (typeof info === "undefined") throw new Error("da-web.js: manca info");
  if (typeof isNum === "undefined") throw new Error("da-web.js: manca isNum");
  if (typeof kpi === "undefined") throw new Error("da-web.js: manca kpi");
  if (typeof mapLabels === "undefined") throw new Error("da-web.js: manca mapLabels");
  if (typeof metric === "undefined") throw new Error("da-web.js: manca metric");
  if (typeof metricInfo === "undefined") throw new Error("da-web.js: manca metricInfo");
  if (typeof naBlock === "undefined") throw new Error("da-web.js: manca naBlock");
  if (typeof safeUrl === "undefined") throw new Error("da-web.js: manca safeUrl");
  if (typeof srcLine === "undefined") throw new Error("da-web.js: manca srcLine");
  if (typeof values === "undefined") throw new Error("da-web.js: manca values");
  /* indirizzi del sito statico: le stesse pagine di web/lib/routes.ts, con il cancelletto */
  const R = {
    home: "#/",
    mun: id => "#/municipio/" + id,
    tutti: "#/tutti",
    conf: (a, b) => (a ? `#/confronto/${a}/${b || ""}` : "#/confronto"),
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
/* ======== lib/grafici.ts ======== */
MOD["lib/grafici.ts"] = (() => {

/* Pezzi dei grafici condivisi dalle pagine dei fondi (PNRR, Giubileo 2025) e dalla scheda municipio.
   HTML e SVG in linea, senza librerie. Colori: token --c1…--c5, --c-na, --data e --data-hl in globals.css,
   controllati con lo script della skill dataviz (validate_palette.js) su chiaro e scuro.
   Un valore mancante non entra nei grafici e nelle tabelle resta "non disponibile", mai 0. */

const pct = (a, b) => (b > 0 ? f1.format(a / b * 100) + "%" : "n.d.");
/* ---------- assi ---------- */
function nice(max) {
    if (!(max > 0))
        return { step: 1, top: 1 };
    const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    return { step, top: Math.ceil(max / step - 1e-9) * step };
}
const num = (v) => (Number.isInteger(v) ? fInt.format(v) : f1.format(v));
function tick(v, unit, top) {
    if (v === 0)
        return "0";
    if (unit === "eur")
        return top >= 1e9 ? num(v / 1e9) + " mld" : top >= 1e6 ? num(v / 1e6) + " mln" : fInt.format(v);
    if (unit === "pct")
        return num(v) + "%";
    return fInt.format(v);
}
/* asse: per i conteggi dice che cosa si conta (default: progetti) */
const UNIT_ASSE = (unit, top, asse) => unit === "eur" ? (top >= 1e9 ? "miliardi di euro" : top >= 1e6 ? "milioni di euro" : "euro") : unit === "eur_ab" ? "euro per abitante" : asse || "numero di progetti";
function ticksOf(max, unit) {
    const { step, top } = nice(max);
    const ticks = [];
    for (let t = 0; t <= top + step / 1e6; t += step)
        ticks.push(t);
    const labels = ticks.map(t => tick(t, unit, top)), w = Math.max(...labels.map(l => l.length)) * 0.6 + 0.4;
    return { top, ticks, labels, w };
}
const yAxis = (t) => `<div class="ch-y" style="width:${t.w.toFixed(1)}em">${t.ticks.map((v, i) => `<span style="bottom:${(v / t.top * 100).toFixed(2)}%">${esc(t.labels[i])}</span>`).join("")}</div>`;
const grid = (t) => `<div class="ch-grid">${t.ticks.map(v => `<i style="bottom:${(v / t.top * 100).toFixed(2)}%"${v === 0 ? ' class="base"' : ""}></i>`).join("")}</div>`;
function colChart(o) {
    const tot = (r) => r.segs.reduce((s, x) => s + (isNum(x.v) ? x.v : 0), 0);
    const totals = o.rows.map(tot), max = Math.max(0, ...totals), t = ticksOf(max, o.unit), { top } = t;
    const iMax = totals.indexOf(max), n = o.rows.length;
    const cols = o.rows.map((r, i) => {
        const h = top ? totals[i] / top * 100 : 0;
        const segs = r.segs.filter(s => isNum(s.v) && s.v > 0).map(s => `<i style="flex-grow:${s.v};background:${s.c}"></i>`).join("");
        const lab = i === iMax && max > 0 ? `<b class="ch-top${i >= n - 2 ? " end" : i <= 1 ? " start" : ""}" style="bottom:calc(${h.toFixed(2)}% + 4px)">${esc(o.unit === "int" ? fInt.format(max) : fmt(max, o.unit))}</b>` : "";
        return `<div class="ch-col" data-tip="${esc(r.tip)}"><span class="ch-bar" style="height:${h.toFixed(2)}%">${segs}</span>${lab}</div>`;
    }).join("");
    return `<div class="ch" role="img" aria-label="${esc(o.aria)}" style="--n:${n}">
    ${yAxis(t)}
    <div class="ch-plot">${grid(t)}<div class="ch-cols">${cols}</div></div>
    <div></div><div class="ch-x${o.stagger ? " stagger" : ""}">${o.rows.map(r => `<span>${esc(r.label)}</span>`).join("")}</div>
  </div><p class="ch-unit">Asse verticale: ${UNIT_ASSE(o.unit, top, o.asse)}</p>`;
}
function lineChart(o) {
    const n = o.x.length, all = o.series.flatMap(s => s.vals.filter(isNum));
    const t = ticksOf(Math.max(0, ...all), o.unit), { top } = t;
    const X = (i) => (i + 0.5) / n * 100, Y = (v) => 100 - v / top * 100;
    const lines = o.series.map(s => {
        const runs = [];
        let cur = [];
        s.vals.forEach((v, i) => { if (isNum(v))
            cur.push(`${X(i).toFixed(2)},${Y(v).toFixed(2)}`);
        else {
            if (cur.length)
                runs.push(cur);
            cur = [];
        } });
        if (cur.length)
            runs.push(cur);
        return runs.map(r => r.length > 1 ? `<polyline points="${r.join(" ")}" stroke="${s.c}"/>` : "").join("");
    }).join("");
    const dots = o.series.map(s => s.vals.map((v, i) => isNum(v) ? `<i style="left:${X(i).toFixed(2)}%;bottom:${(v / top * 100).toFixed(2)}%;background:${s.c}"></i>` : "").join("")).join("");
    const every = o.every || 1;
    return `<div class="ch ln" role="img" aria-label="${esc(o.aria)}" style="--n:${n}">
    ${yAxis(t)}
    <div class="ch-plot">${grid(t)}<div class="ch-cols">${o.x.map((_, i) => `<div class="ch-col" data-tip="${esc(o.tips[i])}"></div>`).join("")}</div>
      <svg class="ln-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg><div class="ln-dots">${dots}</div></div>
    <div></div><div class="ch-x">${o.x.map((l, i) => `<span>${i % every === 0 || i === n - 1 ? esc(l) : ""}</span>`).join("")}</div>
  </div><p class="ch-unit">Asse verticale: ${UNIT_ASSE(o.unit, top, o.asse)}</p>`;
}
const legend = (items) => `<div class="legend">${items.map(s => `<span class="li"><i style="background:${s.c}"></i>${esc(s.label)}</span>`).join("")}</div>`;
function donut(slices, total, aria, unit = "eur") {
    const ref = Math.max(...slices.map(s => s.v)); /* stessa unità in tutta la legenda, dalla fetta più grande */
    const cx = 100, cy = 100, R1 = 96, R0 = 60;
    const pt = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    let a = -Math.PI / 2;
    const paths = slices.map(s => {
        const ang = s.v / total * 2 * Math.PI, a0 = a, a1 = a + ang;
        a = a1;
        /* 2 px di fondo tra le fette, uguali sul bordo esterno e su quello interno */
        const o0 = a0 + 1 / R1, o1 = a1 - 1 / R1, i0 = a0 + 1 / R0, i1 = a1 - 1 / R0;
        if (o1 <= o0)
            return "";
        const big = o1 - o0 > Math.PI ? 1 : 0;
        const d = `M${pt(R1, o0)}A${R1} ${R1} 0 ${big} 1 ${pt(R1, o1)}L${pt(R0, Math.max(i1, i0))}A${R0} ${R0} 0 ${big} 0 ${pt(R0, i0)}Z`;
        const tip = `${s.label}: ${fmt(s.v, unit)}, ${pct(s.v, total)}${s.nota ? ` (${s.nota})` : ""}`;
        return `<path d="${d}" fill="${s.c}" data-tip="${esc(tip)}"><title>${esc(tip)}</title></path>`;
    }).join("");
    return `<div class="dn"><svg viewBox="0 0 200 200" role="img" aria-label="${esc(aria)}">${paths}
    <text x="100" y="94" text-anchor="middle" class="dn-l">Totale</text><text x="100" y="116" text-anchor="middle" class="dn-v">${esc(fmt(total, unit))}</text></svg>
    <ul class="dn-leg">${slices.map(s => `<li><i style="background:${s.c}"></i><span class="n">${esc(s.label)}</span><span class="v">${esc(fmt(s.v, unit, ref))}</span><span class="p">${pct(s.v, total)}</span></li>`).join("")}</ul></div>`;
}
/* ---------- barre orizzontali impilate: per categorie con nomi lunghi ---------- */
function stackBars(rows, unit, aria) {
    const tot = (r) => r.segs.reduce((s, x) => s + (isNum(x.v) ? x.v : 0), 0);
    const max = Math.max(0, ...rows.map(tot));
    return `<div class="bars sb" role="img" aria-label="${esc(aria)}">${rows.map(r => {
        const t = tot(r);
        return `<div class="bar-row" data-tip="${esc(r.tip)}"><span class="n" title="${esc(r.label)}">${esc(r.label)}</span><span class="sb-t"><span class="sb-b" style="width:${max > 0 ? (t / max * 100).toFixed(2) : 0}%">${r.segs.filter(s => isNum(s.v) && s.v > 0).map(s => `<i style="flex-grow:${s.v};background:${s.c}"></i>`).join("")}</span></span><span class="val">${esc(fmt(t, unit, max))}</span></div>`;
    }).join("")}</div>`;
}
/* ---------- classifica con barra: titolo, riga di contesto, valore ---------- */
function ranking(items, unit = "eur") {
    const mx = items[0]?.v || 0;
    return `<ol class="rk">${items.map(x => { const u = x.href; return `<li><${u ? `a href="${esc(u)}" target="_blank" rel="noopener"` : "div"} class="rk-r" data-tip="${esc(x.tip)}"><span class="rk-t">${esc(x.titolo)}</span><span class="rk-m">${esc(x.meta)}</span><span class="rk-b"><i style="width:${(x.v / mx * 100).toFixed(2)}%"></i></span><span class="rk-v">${esc(fmt(x.v, unit, mx))}</span></${u ? "a" : "div"}></li>`; }).join("")}</ol>`;
}
/* tabella con i dati di un grafico: la stessa informazione senza colori né puntatore */
const datiTab = (head, rows, numFrom = 1) => `<details class="dati"><summary>Dati del grafico</summary><div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th${i >= numFrom ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.join("")}</tr>`).join("")}</tbody></table></div></details>`;
const td = (v, unit, ref) => unit ? `<td class="num" data-v="${isNum(v) ? v : ""}">${isNum(v) ? fmt(v, unit, ref) : "non disponibile"}</td>` : `<td>${esc(v)}</td>`;
const nota = (t) => `<p class="src keep ch-note">${esc(t)}</p>`;
/* ---------- comportamenti: suggerimento al passaggio e scelta della vista (bottoni data-vista) ---------- */
function wireGrafici(root, signal) {
    const tip = document.getElementById("tip");
    const hide = () => { if (tip)
        tip.style.display = "none"; };
    const show = (e) => {
        const t = e.target?.closest?.("[data-tip]");
        if (!t || !tip)
            return hide();
        tip.textContent = t.dataset.tip || "";
        tip.style.display = "block";
        tip.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - 270)) + "px";
        tip.style.top = (e.clientY + 14) + "px";
    };
    root.addEventListener("pointermove", show, { signal });
    root.addEventListener("pointerdown", show, { signal });
    root.addEventListener("pointerleave", hide, { signal });
    addEventListener("scroll", hide, { signal, passive: true });
    signal.addEventListener("abort", hide);
    root.querySelectorAll("[data-vista]").forEach(b => b.addEventListener("click", () => {
        const sec = b.closest("section");
        sec.querySelectorAll("[data-vista]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        sec.querySelectorAll("[data-pannello]").forEach(p => { p.hidden = p.dataset.pannello !== b.dataset.vista; });
    }, { signal }));
}
return { pct, nice, colChart, lineChart, legend, donut, stackBars, ranking, datiTab, td, nota, wireGrafici };
})();

/* ======== lib/fondi.ts ======== */
MOD["lib/fondi.ts"] = (() => {
const { colChart, datiTab, donut, legend, nota, pct, ranking, td, wireGrafici } = MOD["lib/grafici.ts"];
/* Pagine dei fondi straordinari: PNRR e Giubileo 2025. Stesso codice, in JavaScript semplice, in fondo a
   scripts/sections.js (sito statico, #/pnrr e #/giubileo-2025): un testo o un grafico si cambia in tutti e due.
   Legge solo data/snapshot/progetti.json (via engine.D) e i residenti di profilo_annuario.json.
   Regole: si contano solo le schede con contato_nel_totale; l'importo è importo_programma_euro
   (fondi del programma assegnati, non pagamenti); un importo mancante resta "non disponibile" e
   non entra nelle somme; le date sono solo quelle scritte nel campo Periodo della scheda.
   Grafici in HTML e SVG in linea, senza librerie. Colori: token --c1…--c5 e --c-na in globals.css,
   controllati con lo script della skill dataviz (validate_palette.js) su chiaro e scuro. */



const P = D.progetti;
const LETTO = P ? "elenco letto il " + dateIt(P.verificato) : "";
/* gruppi cittadini, con le stesse etichette del blocco della pagina iniziale */
const GRUPPI = [["senza_municipio", "Senza municipio indicato"], ["intermunicipale", "Intermunicipali"], ["piu_municipi", "Su più municipi"]];
function records(prog) {
    if (!P)
        return [];
    const out = [];
    const push = (r, area, ord, luogo) => {
        if (r.programma !== prog || !r.contato_nel_totale)
            return;
        out.push({ r, area, ord, luogo, v: isNum(r.importo_programma_euro) ? r.importo_programma_euro : null });
    };
    IDS.forEach(id => (P.municipi[id]?.progetti || []).forEach(r => push(r, id, +id, "Municipio " + ROMANI[id])));
    GRUPPI.forEach(([k, l], i) => (P.cittadino?.[k]?.progetti || []).forEach(r => {
        const tags = (r.municipio_tag || []).filter(t => ROMANI[t]);
        push(r, k, 16 + i, k === "piu_municipi" && tags.length > 1 ? `${l} (${tags.map(t => ROMANI[t]).join(", ")})` : l);
    }));
    return out;
}
const sum = (rs) => rs.reduce((s, x) => s + (x.v ?? 0), 0);
const STATI = [
    { key: "In corso", label: "In corso", c: "var(--c1)" },
    { key: "Concluso", label: "Concluso", c: "var(--c2)" },
    { key: null, label: "Stato non indicato", c: "var(--c-na)" },
];
const statoOf = (r) => STATI.find(s => s.key === r.stato) || STATI[2];
const progetti = (n) => `${fInt.format(n)} ${n === 1 ? "progetto" : "progetti"}`;
/* ---------- date: solo "dal G mese AAAA al G mese AAAA" scritto nella scheda ---------- */
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const RX_PER = /^dal (\d{1,2}) (\p{L}+) (\d{4}) al (\d{1,2}) (\p{L}+) (\d{4})$/u;
function periodo(s) {
    const m = RX_PER.exec(String(s || "").trim());
    if (!m)
        return null;
    const mi = MESI.indexOf(m[2].toLowerCase()), mf = MESI.indexOf(m[5].toLowerCase());
    if (mi < 0 || mf < 0)
        return null;
    return { inizio: [+m[3], Math.floor(mi / 3) + 1], fine: [+m[6], Math.floor(mf / 3) + 1] };
}
/* riga della fonte: in pagina ente, pagina del programma e data di lettura; dettagli nell'icona info */
function fonte(prog, extra) {
    const f = P.fonte || {}, url = safeUrl(f.pagine_programma?.[prog]) || safeUrl(f.url);
    const det = [`<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}</p>`, `<p>${esc(P.periodo || "")}</p>`];
    if (extra)
        det.push(`<p>${esc(extra)}</p>`);
    det.push(`<p>Scaricato il ${dateIt(P.verificato)}.</p>`, `<p><a href="${R.fonti}">Limiti di questi dati</a></p>`);
    return `<p class="src fonte keep"><span>Fonte: ${esc(f.ente || "Roma Capitale")}, pagine progetti ${url ? aLink(url, prog) : esc(prog)}, ${esc(LETTO)}</span>${info(det.join(""), "fonte")}</p>`;
}
const NON_PAG = "Sono fondi del programma assegnati, non pagamenti.";
/* Fette della ciambella "Dove vanno i fondi": i gruppi cittadini e i luoghi più grandi, al massimo cinque,
   gli altri municipi in una sola fetta. Usata qui e nella pagina iniziale (lib/home.ts). */
function fette(prog) {
    const rs = records(prog);
    const byArea = (k) => rs.filter(x => x.area === k);
    const parti = [...GRUPPI.map(([k, l]) => { const g = byArea(k); return { label: l, v: sum(g), n: g.length }; }).filter(g => g.v > 0),
        ...IDS.map(id => { const l = byArea(id); return { label: "Municipio " + ROMANI[id], v: sum(l), n: l.length }; }).filter(m => m.v > 0).sort((a, b) => b.v - a.v)];
    const keep = parti.slice(0, 5), rest = parti.slice(5);
    const slices = keep.map((s, i) => ({ ...s, c: `var(--c${i + 1})`, nota: progetti(s.n) }));
    if (rest.length) {
        const n = rest.reduce((s, x) => s + x.n, 0);
        slices.push({ label: `Altri ${rest.length} municipi`, v: rest.reduce((s, x) => s + x.v, 0), n, c: "var(--c-na)", nota: progetti(n) });
    }
    return slices;
}
const fonteFondo = fonte;
const NON_PAGAMENTI = NON_PAG;
/* ======================= pagina ======================= */
function htmlFondo(prog) {
    if (!P)
        return `<div class="hero"><h1>${esc(prog)}</h1></div>` + `<div class="panel"><p class="na-note">Progetti: dato non disponibile in questa versione.</p></div>`;
    const rs = records(prog);
    const tot = sum(rs), nNull = rs.filter(x => x.v === null).length;
    const byArea = (k) => rs.filter(x => x.area === k);
    const mun = IDS.map(id => { const l = byArea(id); return { id, n: l.length, v: sum(l), nNull: l.filter(x => x.v === null).length, pop: A?.municipi[id]?.popolazione }; });
    const gr = GRUPPI.map(([k, l]) => { const g = byArea(k); return { k, l, n: g.length, v: sum(g) }; });
    const conMun = mun.filter(m => m.n > 0).length, totGr = gr.reduce((s, g) => s + g.v, 0);
    const url = safeUrl(P.fonte?.pagine_programma?.[prog]);
    const chi = prog === "PNRR" ? "i progetti del Piano nazionale di ripresa e resilienza" : "gli interventi finanziati con i fondi per il Giubileo 2025";
    /* --- KPI --- */
    const kpis = `<div class="grid g4">
    ${kpi("Progetti", rs.length, "int", nNull ? `${fInt.format(nNull)} senza importo leggibile` : "tutti con importo", "Roma Capitale, pagine progetti")}
    ${kpi("Fondi del programma", tot, "eur", "assegnati, non pagamenti", "Roma Capitale, pagine progetti. Somma di importo_programma_euro delle schede contate.")}
    ${kpi("Municipi con almeno un progetto", conMun, "int", "su 15")}
    ${kpi("Fondi non attribuiti a un solo municipio", tot > 0 ? totGr / tot * 100 : null, "pct", `${gr.map(g => `${g.l.toLowerCase()}: ${fmt(g.v, "eur")}`).join("; ")}. Sono opere su più municipi o sull'intera città.`)}
  </div>`;
    /* --- ciambella --- */
    const slices = fette(prog);
    const refA = Math.max(0, ...mun.map(m => m.v), ...gr.map(g => g.v));
    const areeTab = datiTab(["Dove", "Progetti", "Fondi del programma", "Quota"], [
        ...mun.map(m => [`<td data-v="${m.id}"><a href="${R.mun(m.id)}">Municipio ${ROMANI[m.id]}</a></td>`, td(m.n, "int"), td(m.v, "eur", refA), `<td class="num" data-v="${tot ? m.v / tot * 100 : ""}">${pct(m.v, tot)}</td>`]),
        ...gr.map((g, i) => [`<td data-v="${16 + i}">${esc(g.l)}</td>`, td(g.n, "int"), td(g.v, "eur", refA), `<td class="num" data-v="${tot ? g.v / tot * 100 : ""}">${pct(g.v, tot)}</td>`]),
    ]);
    const blkDonut = `<section class="block"><div class="head"><div><h2>Dove vanno i fondi</h2><p>Quota dei fondi del programma per luogo del progetto. I progetti su più municipi, intermunicipali o senza municipio indicato restano a parte: i loro importi non sono divisi tra i municipi. Le fette sono al massimo sei; i municipi più piccoli sono raccolti in una sola.</p></div></div>
    <div class="panel">${donut(slices, tot, `Ciambella: fondi ${prog} per luogo`)}${nota(NON_PAG + " Un progetto su più municipi non è diviso tra i municipi.")}${areeTab}</div>${fonte(prog)}</section>`;
    /* --- colonne per municipio: totale e per abitante --- */
    const rowsTot = mun.map(m => ({ label: ROMANI[m.id], tip: `Municipio ${ROMANI[m.id]}: ${fmt(m.v, "eur")} (${progetti(m.n)}${m.nNull ? `, ${m.nNull} senza importo` : ""})`, segs: [{ v: m.v, c: "var(--data)" }] }));
    const ab = (m) => (isNum(m.pop) && m.pop > 0 ? m.v / m.pop : null);
    const rowsAb = mun.map(m => ({ label: ROMANI[m.id], tip: `Municipio ${ROMANI[m.id]}: ${fmt(ab(m), "eur_ab")} per abitante`, segs: [{ v: ab(m), c: "var(--data)" }] }));
    const munTab = datiTab(["Municipio", "Progetti", "Fondi del programma", "Residenti", "Per abitante"], mun.map(m => [`<td data-v="${m.id}"><a href="${R.mun(m.id)}">Municipio ${ROMANI[m.id]}</a></td>`, td(m.n, "int"), td(m.v, "eur", Math.max(...mun.map(x => x.v))), td(m.pop, "int"), td(ab(m), "eur_ab")]));
    const blkCol = `<section class="block"><div class="head"><div><h2>Fondi per municipio</h2><p>Solo i progetti collocati in un municipio. Il valore per abitante divide i fondi per i residenti al 31/12/2025 (Annuario statistico 2025 di Roma Capitale, Tab. 1.2). I progetti sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio.</p></div></div>
    <div class="grid g2">
      <div class="panel"><h3>In totale</h3>${colChart({ rows: rowsTot, unit: "eur", aria: `Colonne: fondi ${prog} per municipio`, stagger: true })}${nota(NON_PAG)}</div>
      <div class="panel"><h3>Per abitante</h3>${colChart({ rows: rowsAb, unit: "eur_ab", aria: `Colonne: fondi ${prog} per abitante, per municipio`, stagger: true })}${nota("Fondi del municipio diviso per i residenti. " + NON_PAG)}</div>
    </div><div class="panel" style="margin-top:14px">${munTab}</div>${fonte(prog, "Residenti: " + POP_SRC + ".")}</section>`;
    /* --- colonne impilate per stato --- */
    const conta = (l, s) => l.filter(x => statoOf(x.r) === s).length;
    const fuori = gr.reduce((s, g) => s + g.n, 0);
    const rowsStato = mun.map(m => { const l = byArea(m.id); return { label: ROMANI[m.id], tip: `Municipio ${ROMANI[m.id]}: ${STATI.map(s => `${s.label.toLowerCase()} ${conta(l, s)}`).join(", ")}`, segs: STATI.map(s => ({ v: conta(l, s), c: s.c })) }; });
    const statoTab = datiTab(["Dove", ...STATI.map(s => s.label), "Totale"], [
        ...mun.map(m => { const l = byArea(m.id); return [`<td data-v="${m.id}"><a href="${R.mun(m.id)}">Municipio ${ROMANI[m.id]}</a></td>`, ...STATI.map(s => td(conta(l, s), "int")), td(l.length, "int")]; }),
        ...gr.map((g, i) => { const l = byArea(g.k); return [`<td data-v="${16 + i}">${esc(g.l)}</td>`, ...STATI.map(s => td(conta(l, s), "int")), td(l.length, "int")]; }),
    ]);
    const blkStato = `<section class="block"><div class="head"><div><h2>A che punto sono</h2><p>Numero di progetti per stato, come scritto nella scheda di ogni progetto. ${prog === "Giubileo 2025" ? "Per il Giubileo la pagina di Roma Capitale rimanda all'Indice Interventi Giubileo per l'aggiornamento dello stato." : "Lo stato della scheda può non essere aggiornato."}</p></div></div>
    <div class="panel">${legend(STATI)}${colChart({ rows: rowsStato, unit: "int", aria: `Colonne impilate: progetti ${prog} per stato, per municipio`, stagger: true })}${nota(`Conta i progetti, non i fondi.${fuori ? ` ${progetti(fuori)} su più municipi, intermunicipali o senza municipio non sono nel grafico: sono nella tabella.` : ""}`)}${statoTab}</div>${fonte(prog)}</section>`;
    /* --- tempo: solo dal campo Periodo della scheda --- */
    const per = rs.map(x => ({ x, p: periodo(x.r.periodo) })).filter(o => o.p);
    let blkTempo;
    if (rs.length && per.length / rs.length >= 0.5) {
        const key = (q) => q[0] * 4 + q[1] - 1;
        const ks = per.flatMap(o => [key(o.p.inizio), key(o.p.fine)]), k0 = Math.min(...ks), k1 = Math.max(...ks);
        const qs = Array.from({ length: k1 - k0 + 1 }, (_, i) => k0 + i), qLab = (k) => `T${(k % 4) + 1} ${Math.floor(k / 4)}`;
        const serie = (which) => qs.map(k => {
            const l = per.filter(o => key(o.p[which]) === k).map(o => o.x);
            return { label: k % 4 === 0 || k === k0 ? String(Math.floor(k / 4)) : "", tip: `${qLab(k)}: ${progetti(l.length)}${l.length ? ` (${STATI.map(s => `${s.label.toLowerCase()} ${conta(l, s)}`).join(", ")})` : ""}`, segs: STATI.map(s => ({ v: conta(l, s), c: s.c })), l };
        });
        const fine = serie("fine"), ini = serie("inizio");
        const tempoTab = datiTab(["Trimestre", "Progetti che iniziano", "Progetti con fine prevista", "Fondi con fine prevista"], qs.map((k, i) => [`<td data-v="${k}">${qLab(k)}</td>`, td(ini[i].l.length, "int"), td(fine[i].l.length, "int"), td(sum(fine[i].l), "eur", Math.max(...fine.map(f => sum(f.l))))]));
        blkTempo = `<section class="block"><div class="head"><div><h2>Quando</h2><p>Progetti per trimestre, secondo il periodo di attuazione scritto nella scheda (dal giorno di inizio al giorno di fine prevista). È il calendario previsto, non la data effettiva di chiusura. ${per.length < rs.length ? `${rs.length - per.length} schede senza periodo leggibile non sono nel grafico.` : `Tutte le ${rs.length} schede indicano il periodo.`}</p></div>
      <div class="seg" role="group" aria-label="Data da mostrare"><button type="button" data-vista="fine" aria-pressed="true">Fine prevista</button><button type="button" data-vista="inizio" aria-pressed="false">Inizio</button></div></div>
      <div class="panel">${legend(STATI)}<div data-pannello="fine">${colChart({ rows: fine, unit: "int", aria: `Colonne impilate: progetti ${prog} per trimestre di fine prevista` })}</div>
      <div data-pannello="inizio" hidden>${colChart({ rows: ini, unit: "int", aria: `Colonne impilate: progetti ${prog} per trimestre di inizio` })}</div>
      ${nota("Ogni colonna è un trimestre; sotto è scritto l'anno del primo trimestre. Lo stato è quello della scheda.")}${tempoTab}</div>${fonte(prog)}</section>`;
    }
    else {
        blkTempo = `<section class="block"><div class="head"><div><h2>Quando</h2></div></div>
      <div class="panel"><p class="na-note">Calendario: dato non disponibile. ${fInt.format(rs.length - per.length)} schede su ${fInt.format(rs.length)} non indicano il periodo di attuazione (il campo Periodo è vuoto), quindi un grafico nel tempo non sarebbe rappresentativo. Le date non vengono stimate.</p></div>${fonte(prog)}</section>`;
    }
    /* --- classifica dei 15 progetti con più fondi --- */
    const top = rs.filter(x => x.v !== null).sort((a, b) => b.v - a.v).slice(0, 15);
    const blkTop = `<section class="block"><div class="head"><div><h2>I 15 progetti con più fondi</h2><p>Ordinati per fondi del programma. Il link apre la scheda ufficiale di Roma Capitale.</p></div></div>
    <div class="panel">${ranking(top.map(x => ({ titolo: x.r.titolo, meta: `${x.luogo} · ${statoOf(x.r).label}`, v: x.v, href: safeUrl(x.r.link), tip: `${x.r.titolo}: ${fmt(x.v, "eur_exact")}` })))}
    ${nota(NON_PAG)}</div>${fonte(prog)}</section>`;
    /* --- tabella completa --- */
    const conPer = per.length / Math.max(1, rs.length) >= 0.5;
    const list = [...rs].sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
    const NO_IMP = { "solo cifre di altre fonti": "altre fonti, non del programma", "importo non leggibile nella fonte": "non leggibile nella fonte" };
    const blkTab = `<section class="block"><div class="head"><div><h2>Tutti i progetti (${fInt.format(rs.length)})</h2><p>Clicca un'intestazione per ordinare. Il titolo apre la scheda ufficiale.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Progetto</th><th>CUP</th><th>Attuatore</th><th>Dove</th><th>Stato</th>${conPer ? "<th>Periodo</th>" : ""}<th class="num">Fondi del programma</th></tr></thead><tbody>
    ${list.map(x => { const u = safeUrl(x.r.link); return `<tr><td>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(x.r.titolo)}</a>` : esc(x.r.titolo)}</td><td><small>${(x.r.cup || []).map(esc).join(", ") || "non indicato"}</small></td><td>${esc(x.r.attuatore || "non indicato")}</td><td data-v="${x.ord}">${esc(x.luogo)}</td><td>${esc(statoOf(x.r).label)}</td>${conPer ? `<td><small>${esc(periodo(x.r.periodo) ? x.r.periodo : "non indicato")}</small></td>` : ""}<td class="num" data-v="${x.v ?? ""}" title="${esc(x.r.importo_testo || "")}">${x.v !== null ? fmt(x.v, "eur_exact") : `<small>${esc(NO_IMP[x.r.importo_programma_metodo] || "non disponibile")}</small>`}</td></tr>`; }).join("")}
    </tbody></table></div>${nota("La colonna conta solo i fondi del programma. Il testo completo dell'importo è nella scheda del progetto.")}${fonte(prog)}</section>`;
    return `<div class="hero"><h1>${esc(prog)}</h1>
    <p class="lede">${esc(chi[0].toUpperCase() + chi.slice(1))} elencati da Roma Capitale, per municipio: quanti sono, quanti fondi hanno e a che punto sono. Li gestiscono per lo più i dipartimenti di Roma Capitale, non i municipi.${url ? ` ${aLink(url, "Pagina ufficiale del programma")}.` : ""}</p></div>
    ${kpis}${blkDonut}${blkCol}${blkStato}${blkTempo}${blkTop}${blkTab}`;
}
/* comportamenti: suggerimento al passaggio e scelta della data (in lib/grafici.ts) */
const wireFondo = wireGrafici;
return { records, periodo, fette, fonteFondo, NON_PAGAMENTI, htmlFondo, wireFondo };
})();

/* ======== lib/home.ts ======== */
MOD["lib/home.ts"] = (() => {
const { donut } = MOD["lib/grafici.ts"];
const { NON_PAGAMENTI, fette, fonteFondo } = MOD["lib/fondi.ts"];
/* Pagina iniziale: le classifiche sotto i numeri principali e le due ciambelle di PNRR e Giubileo 2025.
   Portato nel sito statico da scripts/porta-al-sito-statico.mjs (DAWEB.classificheHome, DAWEB.torteHome):
   un testo si cambia solo qui.
   Classifiche: per ogni indicatore solo il primo dei 15 municipi (a pari merito tutti i primi), con il valore,
   il periodo e, nell'icona info, fonte, limiti e il secondo in classifica. Indicatori diversi non si sommano. */




const CLASSIFICHE = [
    ["peg_spese_ab", "Più stanziamenti per abitante"],
    ["peg_capitale_ab", "Più investimenti per abitante"],
    ["anac_importo_ab", "Più appalti avviati per abitante"],
    ["prog_importo_ab", "Più fondi straordinari per abitante"],
];
const nomeMun = (id) => "Municipio " + ROMANI[id];
function classificheHome() {
    const card = ([mid, titolo]) => {
        const m = metric(mid);
        if (!m)
            return "";
        const vs = IDS.map(id => ({ id, v: m.get(id) })).filter(r => isNum(r.v)).sort((a, b) => b.v - a.v);
        if (!vs.length)
            return "";
        const top = vs.filter(r => r.v === vs[0].v), dopo = vs.find(r => r.v < vs[0].v);
        const f = D[m.snap]?.fonte;
        const det = metricInfo(m) + `<p>Primo su ${vs.length} municipi con il dato.${dopo ? ` Secondo: ${esc(nomeMun(dopo.id))}, ${esc(fmt(dopo.v, m.unit))}.` : ""}</p>` +
            (f ? `<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}</p>` : "");
        return `<div class="kpi primo"><span class="l">${esc(titolo)}${info(det, titolo)}</span>
      <span class="v">${top.map(r => `<a href="${R.mun(r.id)}">${esc(nomeMun(r.id))}</a>`).join(" e ")}</span>
      <span class="x">${esc(fmt(vs[0].v, m.unit))} per abitante, ${esc(m.periodo || "")}</span></div>`;
    };
    const html = CLASSIFICHE.map(card).filter(Boolean);
    if (!html.length)
        return "";
    return `<div class="grid g4 primi">${html.join("")}</div>
  <p class="src primi-src">Il primo dei 15 municipi per ogni indicatore, diviso per i residenti al 31/12/2025. Gli indicatori hanno fonti e periodi diversi e non si sommano: li trovi nelle icone info.</p>`;
}
function torteHome() {
    const pagina = { "PNRR": R.pnrr, "Giubileo 2025": R.giubileo };
    const pannello = (prog) => {
        const slices = fette(prog), tot = slices.reduce((s, x) => s + x.v, 0);
        if (!(tot > 0))
            return naBlock(prog);
        return `<div class="panel torta"><div class="torta-h"><h3>${esc(prog)}</h3><a class="piu" href="${pagina[prog]}">Apri la pagina ${esc(prog)}</a></div>
      ${donut(slices, tot, `Ciambella: fondi ${prog} per luogo`)}${fonteFondo(prog)}</div>`;
    };
    return `<section class="block torte"><div class="head"><div><h2>PNRR e Giubileo 2025: dove vanno i fondi</h2><p>Quota dei fondi di ciascun programma per luogo del progetto. I progetti su più municipi, intermunicipali o senza municipio indicato restano a parte: i loro importi non sono divisi tra i municipi. ${NON_PAGAMENTI} Li gestiscono per lo più i dipartimenti di Roma Capitale, non i municipi.</p></div></div>
    <div class="grid g2">${pannello("PNRR")}${pannello("Giubileo 2025")}</div></section>`;
}
return { classificheHome, torteHome };
})();

/* ======== lib/municipio-grafici.ts ======== */
MOD["lib/municipio-grafici.ts"] = (() => {
const { colChart, datiTab, donut, legend, lineChart, nota, pct, ranking, stackBars, td } = MOD["lib/grafici.ts"];
const { periodo } = MOD["lib/fondi.ts"];
/* Grafici della scheda municipio. Stessi pezzi delle pagine PNRR e Giubileo (lib/grafici.ts).
   Legge solo gli snapshot in data/snapshot (via engine.D): bilancio_peg_2026, appalti_anac, progetti,
   nidi, profilo_annuario e storico (serie 2016-2025 copiate dalla cartella di verifica con le loro conferme).
   Regole: nessuna stima; un valore mancante resta "non disponibile" e non entra nei grafici né nelle somme;
   ogni grafico dice cosa misura e cosa no, e ha la riga della fonte con periodo e data di lettura.
   Unico punto di contatto con il resto del sito: graficiMunicipio(), chiamata da htmlMunicipio (lib/pages.ts). */




const POP = (id) => A?.municipi[id]?.popolazione;
const S = D.storico;
const ser = (id, k) => S?.municipi?.[id]?.[k];
/* ---------- riga della fonte: testo breve in pagina (con periodo e data), dettagli nell'icona info ---------- */
function fonti(items) {
    const ok = items.filter(x => D[x.snap]);
    if (!ok.length)
        return "";
    /* la serie storica non è scaricata in un giorno solo: si scrive la data in cui è stata compilata */
    const quando = (x) => `${x.snap === "storico" ? "serie compilata" : "dati letti"} il ${dateIt(D[x.snap].verificato)}`;
    const dates = [...new Set(ok.map(quando))];
    const vis = ok.map(x => esc(x.testo) + (dates.length > 1 ? ` (${quando(x)})` : "")).join("; ");
    const det = ok.map(x => {
        const s = D[x.snap], f = s.fonte || {};
        return `<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}.${x.extra ? " " + esc(x.extra) : ""} ${x.snap === "storico" ? "Serie compilata" : "Scaricato"} il ${dateIt(s.verificato)}.</p>`;
    }).join("");
    return `<p class="src fonte keep"><span>Fonte: ${vis}${dates.length === 1 ? `, ${dates[0]}` : ""}</span>${info(det + `<p><a href="${R.fonti}">Limiti di questi dati</a></p>`, "fonte")}</p>`;
}
const sez = (h2, intro, body, src) => `<section class="block mg"><div class="head"><div><h2>${esc(h2)}</h2><p>${esc(intro)}</p></div></div>${body}${src}</section>`;
const na = (t) => `<p class="na-note">${esc(t)}</p>`;
const cella = (t, v) => `<td class="num"${v !== undefined ? ` data-v="${v}"` : ""}>${esc(t)}</td>`;
/* ======================= il municipio tra i 15: valori per abitante ======================= */
const CMP = [
    { m: "peg_spese", label: "Stanziamenti del PEG", per: "competenza 2026" },
    { m: "peg_correnti", label: "Spese correnti stanziate", per: "competenza 2026" },
    { m: "peg_capitale", label: "Investimenti stanziati", per: "competenza 2026" },
    { m: "anac_importo", label: "Appalti avviati", per: "CIG 2025, al netto dei doppi conteggi" },
    { m: "prog_importo", label: "Progetti con fondi straordinari", per: "elenco di Roma Capitale" },
];
function blkConfronto(id) {
    if (!A)
        return "";
    const rows = CMP.map(c => {
        const m = metric(c.m);
        if (!m)
            return null;
        const vals = IDS.map(i => { const v = m.get(i), p = POP(i); return { id: i, v: isNum(v) && isNum(p) && p > 0 ? v / p : null, tot: v, p }; });
        const ok = vals.filter(x => isNum(x.v));
        const avg = ok.length ? ok.reduce((s, x) => s + x.tot, 0) / ok.reduce((s, x) => s + x.p, 0) : null;
        const sorted = [...ok].sort((a, b) => b.v - a.v);
        const me = vals.find(x => x.id === id), pos = sorted.findIndex(x => x.id === id) + 1;
        return { ...c, vals, ok, avg, me, pos, max: sorted[0], min: sorted[sorted.length - 1] };
    }).filter(Boolean);
    if (!rows.length)
        return "";
    const X = (v, max) => (max > 0 ? v / max * 100 : 0).toFixed(2);
    const body = rows.map(r => {
        const max = r.max?.v || 0;
        const others = r.ok.filter(x => x.id !== id).map(x => `<i class="cmp-o" style="left:${X(x.v, max)}%" data-tip="${esc(`Municipio ${ROMANI[x.id]}: ${fmt(x.v, "eur_ab")} per abitante`)}"></i>`).join("");
        const avg = isNum(r.avg) ? `<b class="cmp-avg" style="left:${X(r.avg, max)}%" data-tip="${esc(`Media dei ${r.ok.length} municipi: ${fmt(r.avg, "eur_ab")} per abitante`)}"></b>` : "";
        const me = isNum(r.me.v) ? `<i class="cmp-me" style="left:${X(r.me.v, max)}%" data-tip="${esc(`Municipio ${ROMANI[id]}: ${fmt(r.me.v, "eur_ab")} per abitante, ${r.pos}° su ${r.ok.length}`)}"></i>` : "";
        return `<div class="cmp-row"><span class="cmp-n">${esc(r.label)}<small>${esc(r.per)}</small></span><span class="cmp-t"><span class="cmp-line"></span>${others}${avg}${me}</span>
      <span class="cmp-v">${isNum(r.me.v) ? `<b>${fmt(r.me.v, "eur_ab")}</b><small>media ${fmt(r.avg, "eur_ab")} · ${r.pos}° su ${r.ok.length}</small>` : `<small>dato non disponibile</small>`}</span></div>`;
    }).join("");
    const leg = `<div class="legend"><span class="li"><i class="lg-me"></i>Municipio ${ROMANI[id]}</span><span class="li"><i class="lg-o"></i>gli altri municipi</span><span class="li"><i class="lg-avg"></i>media dei 15</span></div>`;
    const tab = datiTab(["Per abitante", `Municipio ${ROMANI[id]}`, "Media dei 15", "Più basso", "Più alto", "Posizione"], rows.map(r => [
        `<td>${esc(r.label)}<br><small>${esc(r.per)}</small></td>`, td(r.me.v, "eur_ab"), td(r.avg, "eur_ab"),
        r.min ? cella(`${fmt(r.min.v, "eur_ab")} (${ROMANI[r.min.id]})`, r.min.v) : cella("non disponibile"),
        r.max ? cella(`${fmt(r.max.v, "eur_ab")} (${ROMANI[r.max.id]})`, r.max.v) : cella("non disponibile"),
        r.pos ? cella(`${r.pos}° su ${r.ok.length}`, r.pos) : cella("non disponibile")
    ]));
    return sez("Il municipio tra i 15", `Ogni riga è un importo diviso per i residenti al 31/12/2025. Il punto pieno è il Municipio ${ROMANI[id]}, i punti chiari gli altri municipi, la linea verticale la media dei 15 (la somma dei 15 municipi divisa per i loro residenti). Ogni riga ha la sua scala, da 0 al municipio più alto. Stanziamenti, appalti e progetti sono contabilità diverse: non si sommano.`, `<div class="panel">${leg}<div class="cmp">${body}</div>${nota("Posizione: 1° è il valore più alto. Un valore alto o basso è un segnale da approfondire, non un giudizio.")}${tab}</div>`, fonti([{ snap: "bilancio_peg_2026", testo: "Roma Capitale, PEG 2026-2028" }, { snap: "appalti_anac", testo: "ANAC, CIG 2025" }, { snap: "progetti", testo: "Roma Capitale, pagine progetti" }, { snap: "profilo_annuario", testo: "residenti al 31/12/2025, Annuario 2025, Tab. 1.2" }]));
}
/* ======================= bilancio: per cosa (missioni) ======================= */
const MISS = [["04", "Istruzione", "var(--c1)"], ["12", "Politiche sociali e famiglia", "var(--c2)"], ["01", "Servizi generali e di gestione", "var(--c3)"], ["10", "Trasporti e mobilità", "var(--c4)"]];
function blkMissioni(id) {
    const s = D.bilancio_peg_2026?.municipi[id]?.spese;
    if (!s)
        return "";
    const ms = (s.per_missione || []).filter((x) => isNum(x.competenza_2026));
    const tot = ms.reduce((a, x) => a + x.competenza_2026, 0);
    if (!(tot > 0))
        return "";
    const slices = MISS.map(([c, l, col]) => ({ label: l, v: ms.find((x) => x.codice === c)?.competenza_2026 || 0, c: col })).filter(x => x.v > 0);
    const rest = ms.filter((x) => !MISS.some(([c]) => c === x.codice) && x.competenza_2026 > 0);
    if (rest.length)
        slices.push({ label: `Altre ${rest.length} missioni`, v: rest.reduce((a, x) => a + x.competenza_2026, 0), c: "var(--c-na)" });
    const diff = Math.abs(tot - s.competenza_2026) > 1;
    const tab = datiTab(["Missione", "Competenza 2026", "Quota"], [...ms].sort((a, b) => b.competenza_2026 - a.competenza_2026)
        .map((x) => [`<td>${esc(x.codice)} ${esc(x.nome)}</td>`, td(x.competenza_2026, "eur", tot), `<td class="num" data-v="${x.competenza_2026 / tot * 100}">${pct(x.competenza_2026, tot)}</td>`]));
    return sez("Per cosa spende il municipio", "Quota degli stanziamenti 2026 per missione, cioè la grande area di spesa del bilancio pubblico. Le quattro missioni con un colore proprio sono le stesse in tutte le schede; le altre sono raccolte in una sola fetta. Sono stanziamenti previsti ad aprile 2026, non pagamenti.", `<div class="panel">${donut(slices, tot, `Ciambella: stanziamenti 2026 del Municipio ${ROMANI[id]} per missione`)}${nota("Stanziamenti di competenza 2026, non pagamenti." + (diff ? ` La somma delle missioni (${fmt(tot, "eur")}) non coincide con il totale stampato (${fmt(s.competenza_2026, "eur")}).` : ""))}${tab}</div>`, fonti([{ snap: "bilancio_peg_2026", testo: "Roma Capitale, PEG 2026-2028, Allegato A, competenza 2026" }]));
}
/* ======================= ieri, oggi, domani: stanziamenti del PEG 2023-2028 =======================
   Un solo dato, gli stanziamenti di spesa del PEG, in tre viste: spese correnti, tutto il bilancio, peso del municipio sui 15.
   Ieri e oggi (2023-2026): il PEG di ogni anno, dalla serie controllata (storico). Domani (2027-2028): il PEG 2026-2028.
   Il 2026 delle due fonti coincide per tutti i municipi (controllato il 14/11/2026). La somma dei 15 si scrive solo
   se tutti e 15 hanno il valore: niente somme parziali. */
const ANNI = ["2023", "2024", "2025", "2026", "2027", "2028"], FUT = new Set(["2027", "2028"]);
const C_PEG = "var(--data)", C_PREV = "color-mix(in srgb, var(--data) 40%, transparent)";
function serieBil(id, k) {
    const st = ser(id, k), sp = D.bilancio_peg_2026?.municipi[id]?.spese;
    const prev = (y) => k === "peg_totale" ? sp?.["competenza_" + y] : (sp?.per_titolo || []).find((t) => t.codice === "U.1")?.["competenza_" + y];
    return ANNI.map(y => { const v = FUT.has(y) ? prev(y) : st?.valori[y]; return isNum(v) ? v : null; });
}
function somma15(k) {
    const tutte = IDS.map(i => serieBil(i, k));
    return ANNI.map((_, j) => { const l = tutte.map(s => s[j]); return l.every(isNum) ? l.reduce((a, b) => a + b, 0) : null; });
}
const tipoAnno = (y) => y === "2024" ? " (PEG aggiornato a dicembre)" : FUT.has(y) ? " (previsione del PEG 2026-2028)" : "";
const attoAnno = (y) => y === "2024" ? "PEG 2024 aggiornato a dicembre" : FUT.has(y) ? "PEG 2026-2028, previsione" : `PEG ${y}`;
const xLab = (y) => y + (y === "2024" ? "*" : "");
const LEG_PEG = legend([{ label: "PEG dell'anno", c: C_PEG }, { label: "Previsione 2027-2028", c: C_PREV }]);
const colTempo = (vals, nome, cosa) => colChart({ rows: ANNI.map((y, i) => ({ label: xLab(y), tip: `${nome}, ${y}${tipoAnno(y)}: ${isNum(vals[i]) ? fmt(vals[i], "eur") : "non disponibile"}`, segs: [{ v: vals[i], c: FUT.has(y) ? C_PREV : C_PEG }] })), unit: "eur", aria: `Colonne: ${cosa.toLowerCase()}, ${nome}, stanziamenti 2023-2028`, stagger: true });
const FONTI_TEMPO = () => fonti([{ snap: "storico", testo: "PEG di Roma Capitale 2023-2026", extra: "Valori confermati da due tabelle o due letture dello stesso atto." }, { snap: "bilancio_peg_2026", testo: "PEG 2026-2028, competenza 2027 e 2028" }]);
/* pagina Tutti i municipi, in cima: lo stesso dato in aggregato, la somma dei 15 municipi per anno */
function tempoTutti() {
    if (!D.bilancio_peg_2026 || !S)
        return "";
    const c = somma15("peg_correnti"), t = somma15("peg_totale");
    if (!c.some(isNum) && !t.some(isNum))
        return "";
    const ref = Math.max(...t.filter(isNum));
    const tab = datiTab(["Anno", "Spese correnti", "Tutto il bilancio", "Atto"], ANNI.map((y, i) => [`<td data-v="${y}">${y}</td>`, td(c[i], "eur", ref), td(t[i], "eur", ref), `<td><small>${esc(attoAnno(y))}</small></td>`]));
    return sez("Ieri, oggi, domani", "Quanto il Piano esecutivo di gestione stanzia per i 15 municipi messi insieme: ieri (2023-2025), oggi (2026) e domani (2027-2028). È la somma dei capitoli dei municipi, non il bilancio di Roma Capitale. Ieri e oggi sono il PEG approvato in ciascun anno; domani sono le previsioni del PEG 2026-2028. Sono previsioni di spesa, non pagamenti. Ogni municipio ha lo stesso grafico nella sua scheda.", `<div class="iod-parte">${LEG_PEG}<div class="grid g2"><div class="panel"><h4>Spese correnti</h4>${colTempo(c, "I 15 municipi insieme", "Spese correnti")}</div><div class="panel"><h4>Tutto il bilancio</h4>${colTempo(t, "I 15 municipi insieme", "Tutto il bilancio")}</div></div>
    ${nota("Spese correnti: personale, servizi e contributi. Tutto il bilancio: anche investimenti e altre spese. Il calo del totale nel 2027 e 2028 è normale: gli investimenti vengono iscritti anno per anno. *2024: PEG aggiornato a dicembre (DGC 510/2024), quindi più alto. Un anno ha la somma solo se tutti e 15 i municipi hanno il valore.")}${tab}</div>`, FONTI_TEMPO());
}
function parteBil(id, k, h3, intro, testoNota) {
    const me = serieBil(id, k), tot = somma15(k), chi = `Municipio ${ROMANI[id]}`;
    if (!me.some(isNum))
        return `<div class="iod-parte"><h3>${esc(h3)}</h3>${na("Dato non disponibile in questa versione.")}</div>`;
    const col = (vals, nome) => colTempo(vals, nome, h3);
    const conf = ser(id, k)?.conferma || {};
    const ref = Math.max(...me.filter(isNum));
    const tab = datiTab(["Anno", chi, "I 15 municipi insieme", "Atto", "Controllo"], ANNI.map((y, i) => [`<td data-v="${y}">${y}</td>`, td(me[i], "eur", ref), td(tot[i], "eur"), `<td><small>${esc(attoAnno(y))}</small></td>`, `<td><small>${esc(FUT.has(y) ? "letto dal PEG 2026-2028" : conf[y] || "")}</small></td>`]));
    return `<div class="iod-parte"><h3>${esc(h3)}</h3><p class="iod-intro">${esc(intro)}</p>${LEG_PEG}
    <div class="grid g2"><div class="panel"><h4>${chi}</h4>${col(me, chi)}</div><div class="panel"><h4>I 15 municipi insieme</h4>${col(tot, "I 15 municipi insieme")}</div></div>
    ${nota(testoNota)}${tab}</div>`;
}
function parteQuota(id) {
    const tot = somma15("peg_correnti");
    const q = IDS.map(i => ({ id: i, v: serieBil(i, "peg_correnti").map((v, j) => isNum(v) && isNum(tot[j]) && tot[j] > 0 ? v / tot[j] * 100 : null) }));
    const me = q.find(x => x.id === id), chi = `Municipio ${ROMANI[id]}`;
    if (!me.v.some(isNum))
        return `<div class="iod-parte"><h3>Il peso del municipio sui 15</h3>${na("Dato non disponibile in questa versione.")}</div>`;
    const p1 = (v) => isNum(v) ? f1.format(v) + "%" : "non disponibile";
    const estremi = (j) => { const l = q.filter(x => isNum(x.v[j])).sort((a, b) => b.v[j] - a.v[j]); return { alto: l[0], basso: l[l.length - 1], pos: l.findIndex(x => x.id === id) + 1, n: l.length }; };
    const ch = lineChart({ x: ANNI, unit: "pct", asse: "percentuale delle spese correnti dei 15 municipi",
        tips: ANNI.map((y, j) => { const e = estremi(j); return `${y}${tipoAnno(y)}: ${chi} ${p1(me.v[j])} delle spese correnti dei 15 municipi${e.pos ? `, ${e.pos}° su ${e.n}` : ""}`; }),
        series: [...q.filter(x => x.id !== id).map(x => ({ label: `Municipio ${ROMANI[x.id]}`, c: "var(--c-na)", vals: x.v })), { label: chi, c: "var(--data-hl)", vals: me.v }],
        aria: `Linee: quota del ${chi} sulle spese correnti dei 15 municipi, 2023-2028, con gli altri 14 municipi` });
    const leg = `<div class="legend"><span class="li"><i class="lg-me"></i>${chi}</span><span class="li"><i class="lg-o"></i>gli altri 14 municipi</span><span class="li"><i class="lg-prev"></i>Previsione 2027-2028</span></div>`;
    const tab = datiTab(["Anno", `Quota del ${chi}`, "Posizione", "Quota più alta", "Quota più bassa"], ANNI.map((y, j) => {
        const e = estremi(j);
        return [`<td data-v="${y}">${y}${y === "2024" ? "*" : ""}</td>`, cella(p1(me.v[j]), me.v[j] ?? ""), e.pos ? cella(`${e.pos}° su ${e.n}`, e.pos) : cella("non disponibile"),
            e.alto ? cella(`${p1(e.alto.v[j])} (${ROMANI[e.alto.id]})`, e.alto.v[j]) : cella("non disponibile"), e.basso ? cella(`${p1(e.basso.v[j])} (${ROMANI[e.basso.id]})`, e.basso.v[j]) : cella("non disponibile")];
    }));
    return `<div class="iod-parte"><h3>Il peso del municipio sui 15</h3><p class="iod-intro">${esc(`Quanta parte delle spese correnti dei 15 municipi va al ${chi}, anno per anno. Non dipende da quanto cresce o cala il bilancio di tutti: dice se il municipio pesa di più o di meno rispetto agli altri.`)}</p>${leg}
    <div class="panel iod-q">${ch}${nota("Spese correnti del municipio divise per la somma dei 15 nello stesso anno e nello stesso PEG. Posizione: 1° è la quota più alta. Non tiene conto dei residenti. Un peso più alto o più basso non è un giudizio.")}${tab}</div></div>`;
}
function blkTempo(id) {
    if (!D.bilancio_peg_2026?.municipi[id]?.spese)
        return "";
    const confini = (S?.confini_cambiati || []).includes(id);
    const corpo = parteBil(id, "peg_correnti", "Spese correnti", "Personale, servizi e contributi: la parte del bilancio che si ripete di anno in anno.", "*2024: PEG aggiornato a dicembre (DGC 510/2024), non quello iniziale, quindi più alto. 2027 e 2028 in colore più tenue: previsioni del PEG 2026-2028, che possono cambiare.")
        + parteBil(id, "peg_totale", "Tutto il bilancio", "Tutti gli stanziamenti di spesa: spese correnti, investimenti (opere e manutenzioni straordinarie) e altre spese (conto terzi e partite di giro).", "Il calo nel 2027 e 2028 è normale: gli investimenti vengono iscritti anno per anno, quindi gli anni futuri ne contengono pochi. Non è una previsione di quanto il municipio spenderà. *2024: PEG aggiornato a dicembre.")
        + parteQuota(id);
    return sez("Ieri, oggi, domani", `Quanto il Piano esecutivo di gestione stanzia per il municipio: ieri (2023-2025), oggi (2026) e domani (2027-2028). Ieri e oggi sono il PEG approvato in ciascun anno; domani sono le previsioni del PEG 2026-2028. Sono previsioni di spesa, non pagamenti. "I 15 municipi insieme" è la somma dei municipi, non il bilancio di Roma Capitale. Gli anni prima del 2023 non sono mostrati: una sola tabella, e fino al 2019 un metodo diverso.${confini ? " " + S.nota_confini : ""}`, corpo, FONTI_TEMPO());
}
/* ======================= appalti ======================= */
const PROC = { affidamento_diretto: ["Affidamento diretto", "var(--c1)"], adesione_accordo_quadro: ["Accordo quadro o convenzione", "var(--c2)"], procedura_aperta_ristretta: ["Procedura aperta o ristretta", "var(--c3)"], procedura_negoziata: ["Procedura negoziata", "var(--c4)"], altro: ["Altre procedure o non indicata", "var(--c-na)"] };
function blkAppalti(id) {
    const a = D.appalti_anac?.municipi[id]?.["2025"];
    if (!a)
        return "";
    const cl = (a.per_scelta_contraente || []);
    const sl = (k) => cl.filter(x => isNum(x[k]) && x[k] > 0).map(x => ({ label: PROC[x.classe]?.[0] || x.etichetta, v: x[k], c: PROC[x.classe]?.[1] || "var(--c-na)", nota: k === "importo" ? `${fInt.format(x.n_cig)} CIG` : fmt(x.importo, "eur") }));
    const totI = cl.reduce((s, x) => s + (isNum(x.importo) ? x.importo : 0), 0), totN = cl.reduce((s, x) => s + (isNum(x.n_cig) ? x.n_cig : 0), 0);
    const dn = `<div class="panel"><div class="mg-h"><h3>Come è scelto il contraente (2025)</h3><div class="seg" role="group" aria-label="Misura da mostrare"><button type="button" data-vista="importo" aria-pressed="true">Importo</button><button type="button" data-vista="numero" aria-pressed="false">Numero di CIG</button></div></div>
    <div data-pannello="importo">${donut(sl("importo"), totI, `Ciambella: importo dei CIG 2025 del Municipio ${ROMANI[id]} per procedura`)}</div>
    <div data-pannello="numero" hidden>${donut(sl("n_cig"), totN, `Ciambella: numero di CIG 2025 del Municipio ${ROMANI[id]} per procedura`, "int")}</div>
    ${nota("Importo lordo, prima di togliere i doppi conteggi. Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria: una quota alta non è da sola un'anomalia.")}
    ${datiTab(["Procedura", "CIG", "Quota CIG", "Importo", "Quota importo"], cl.map(x => [`<td>${esc(x.etichetta)}</td>`, td(x.n_cig, "int"), `<td class="num" data-v="${totN ? x.n_cig / totN * 100 : ""}">${pct(x.n_cig, totN)}</td>`, td(x.importo, "eur", totI), `<td class="num" data-v="${totI ? x.importo / totI * 100 : ""}">${pct(x.importo, totI)}</td>`]))}</div>`;
    const imp = ser(id, "anac_importo_netto"), nc = ser(id, "anac_n_cig");
    let storia;
    if (imp) {
        const ys = Object.keys(imp.valori).sort(), ref = Math.max(...ys.map(y => imp.valori[y]));
        storia = `<div class="panel"><h3>Negli anni: importo dei CIG avviati</h3>${colChart({ rows: ys.map(y => ({ label: y, tip: `${y}: ${fmt(imp.valori[y], "eur")}${isNum(nc?.valori[y]) ? ` (${fInt.format(nc.valori[y])} CIG)` : ""}`, segs: [{ v: imp.valori[y], c: "var(--data)" }] })), unit: "eur", aria: `Colonne: importo dei CIG avviati dal Municipio ${ROMANI[id]}, 2016-2025`, stagger: true })}
      ${nota(`Importo al netto dei doppi conteggi, per anno di pubblicazione del CIG. Fino al 2023 i file ANAC non hanno gli SmartCIG (contratti sotto 40.000 euro): il numero di CIG è mostrato solo per il 2024 e il 2025${isNum(nc?.valori["2024"]) && isNum(nc?.valori["2025"]) ? ` (${fInt.format(nc.valori["2024"])} e ${fInt.format(nc.valori["2025"])})` : ""}.`)}
      ${datiTab(["Anno", "Importo dei CIG", "Numero di CIG", "Controllo"], ys.map(y => [`<td data-v="${y}">${y}</td>`, td(imp.valori[y], "eur", ref), isNum(nc?.valori[y]) ? td(nc.valori[y], "int") : `<td class="num" data-v="">non confrontabile</td>`, `<td><small>${esc(imp.conferma[y] || "")}</small></td>`]))}</div>`;
    }
    else
        storia = `<div class="panel"><h3>Negli anni: importo dei CIG avviati</h3>${na("Serie storica: dato non disponibile in questa versione.")}</div>`;
    return sez("Gli appalti in grafici", "Gare e affidamenti registrati su ANAC dagli uffici del municipio. È il valore a base di gara o di affidamento, non quanto è stato pagato, e può coprire più anni. Non comprende gli appalti dei dipartimenti centrali sul territorio del municipio.", `<div class="grid g2">${dn}${storia}</div>`, fonti([{ snap: "appalti_anac", testo: "ANAC, CIG pubblicati nel 2025" }, { snap: "storico", testo: "ANAC, CIG 2016-2025", extra: "Una sola fonte (ANAC); attribuzione ai municipi controllata con gli oggetti e, per il 2016-2020, con i file L.190 di Roma Capitale." }]));
}
/* ======================= progetti ======================= */
const STATI = [{ key: "In corso", label: "In corso", c: "var(--c1)" }, { key: "Concluso", label: "Concluso", c: "var(--c2)" }, { key: null, label: "Stato non indicato", c: "var(--c-na)" }];
const statoOf = (r) => STATI.find(s => s.key === r.stato) || STATI[2];
const nProg = (n) => `${fInt.format(n)} ${n === 1 ? "progetto" : "progetti"}`;
function blkProgetti(id) {
    const m = D.progetti?.municipi[id];
    if (!m)
        return "";
    const rs = (m.progetti || []).filter((r) => r.contato_nel_totale);
    if (!rs.length)
        return sez("I progetti in grafici", "Progetti con fondi straordinari collocati nel municipio.", `<div class="panel">${na("Nessun progetto collocato in questo municipio nell'elenco di Roma Capitale.")}</div>`, fonti([{ snap: "progetti", testo: "Roma Capitale, pagine progetti" }]));
    const conta = (l, s) => l.filter(r => statoOf(r) === s).length;
    const progs = [...new Set(rs.map(r => r.programma))].map(p => ({ p, l: rs.filter(r => r.programma === p) })).sort((a, b) => b.l.length - a.l.length);
    const bars = stackBars(progs.map(g => ({ label: g.p, tip: `${g.p}: ${nProg(g.l.length)} (${STATI.map(s => `${s.label.toLowerCase()} ${conta(g.l, s)}`).join(", ")})`, segs: STATI.map(s => ({ v: conta(g.l, s), c: s.c })) })), "int", `Barre impilate: progetti del Municipio ${ROMANI[id]} per programma e stato`);
    const tabP = datiTab(["Programma", ...STATI.map(s => s.label), "Totale", "Fondi del programma"], progs.map(g => {
        const v = g.l.filter(r => isNum(r.importo_programma_euro));
        const somma = v.reduce((s, r) => s + r.importo_programma_euro, 0);
        return [`<td>${esc(g.p)}</td>`, ...STATI.map(s => td(conta(g.l, s), "int")), td(g.l.length, "int"), v.length ? `<td class="num" data-v="${somma}">${fmt(somma, "eur")}${v.length < g.l.length ? `<br><small>${g.l.length - v.length} senza importo</small>` : ""}</td>` : td(null, "eur")];
    }));
    /* quando: anno di fine prevista scritto nella scheda */
    const per = rs.map(r => ({ r, p: periodo(r.periodo) })).filter(o => o.p);
    let quando;
    if (per.length / rs.length >= 0.5) {
        const ys = per.map(o => o.p.fine[0]), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const anni = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
        const rows = anni.map(y => { const l = per.filter(o => o.p.fine[0] === y).map(o => o.r); return { y, l }; });
        quando = `<div class="panel"><h3>Quando finiscono</h3>${legend(STATI)}${colChart({ rows: rows.map(x => ({ label: String(x.y), tip: `${x.y}: ${nProg(x.l.length)} con fine prevista${x.l.length ? ` (${STATI.map(s => `${s.label.toLowerCase()} ${conta(x.l, s)}`).join(", ")})` : ""}`, segs: STATI.map(s => ({ v: conta(x.l, s), c: s.c })) })), unit: "int", aria: `Colonne impilate: progetti del Municipio ${ROMANI[id]} per anno di fine prevista` })}
      ${nota(`Anno di fine prevista scritto nella scheda (campo Periodo): è il calendario previsto, non la data effettiva di chiusura. ${per.length < rs.length ? `${rs.length - per.length} ${rs.length - per.length === 1 ? "scheda" : "schede"} su ${rs.length} senza periodo leggibile non sono nel grafico.` : `Tutte le ${rs.length} schede indicano il periodo.`}`)}
      ${datiTab(["Anno di fine prevista", ...STATI.map(s => s.label), "Totale"], rows.map(x => [`<td data-v="${x.y}">${x.y}</td>`, ...STATI.map(s => td(conta(x.l, s), "int")), td(x.l.length, "int")]))}</div>`;
    }
    else
        quando = `<div class="panel"><h3>Quando finiscono</h3>${na(`Calendario: dato non disponibile. ${rs.length - per.length} schede su ${rs.length} non indicano il periodo di attuazione, quindi un grafico nel tempo non sarebbe rappresentativo. Le date non vengono stimate.`)}</div>`;
    const conImp = rs.filter(r => isNum(r.importo_programma_euro)).sort((a, b) => b.importo_programma_euro - a.importo_programma_euro);
    const top = conImp.slice(0, 10);
    const rk = top.length ? ranking(top.map(r => ({ titolo: r.titolo, meta: `${r.programma} · ${statoOf(r).label}`, v: r.importo_programma_euro, href: safeUrl(r.link), tip: `${r.titolo}: ${fmt(r.importo_programma_euro, "eur_exact")}` }))) : na("Importi: dato non disponibile.");
    const senza = rs.length - conImp.length;
    return sez("I progetti in grafici", "Progetti PNRR, Giubileo 2025 e altri fondi straordinari collocati nel municipio, come scritto nelle schede di Roma Capitale. Li gestiscono per lo più i dipartimenti di Roma Capitale, non il municipio. Un CUP ripetuto con lo stesso importo è contato una volta. I progetti su più municipi o su tutta la città non sono qui: sono nelle pagine PNRR e Giubileo 2025.", `<div class="grid g2"><div class="panel"><h3>Per programma e stato</h3>${legend(STATI)}${bars}${nota("Conta i progetti, non i fondi. Lo stato è quello scritto nella scheda e può non essere aggiornato.")}${tabP}</div>${quando}</div>
    <div class="panel" style="margin-top:14px"><h3>${top.length < conImp.length ? `I ${top.length} progetti con più fondi` : top.length === 1 ? "Il progetto con importo" : `I ${top.length} progetti, per fondi`}</h3>${rk}${nota(`Fondi del programma assegnati, non pagamenti. Il link apre la scheda ufficiale.${senza ? ` ${senza} ${senza === 1 ? "progetto" : "progetti"} senza importo del programma ${senza === 1 ? "non è" : "non sono"} in classifica.` : ""}`)}</div>`, fonti([{ snap: "progetti", testo: "Roma Capitale, pagine progetti PNRR e altri fondi straordinari" }]));
}
/* ======================= nidi negli anni ======================= */
function blkNidi(id) {
    const m = D.nidi?.municipi[id], ss = m?.serie_storica;
    if (!ss)
        return "";
    const ys = Object.keys(ss).sort();
    /* iscritti che due pubblicazioni riportano diversi (Annuario contro file della Dashboard): non confermati, fuori dalla linea */
    const disc = (S?.discordanze || []).filter((d) => d.indicatore === "nidi_iscritti" && d.municipio === id && !/conferma/.test(d.nota || ""));
    const dOf = (y) => disc.find((d) => d.anno.replace("/", "-") === y);
    const val = (y, k) => { const v = ss[y]?.[k]; return isNum(v) && !(k === "iscritti" && dOf(y)) ? v : null; };
    const SER = [{ k: "posti", label: "Posti", c: "var(--c1)" }, { k: "iscritti", label: "Iscritti", c: "var(--c2)" }, { k: "domande_valide", label: "Domande valide", c: "var(--c3)" }];
    const lab = (y) => y.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1/$2");
    const ch = lineChart({ x: ys.map(lab), every: 2, unit: "int", asse: "numero di posti, bambini o domande",
        tips: ys.map(y => `${lab(y)}: ${SER.map(s => `${s.label.toLowerCase()} ${isNum(val(y, s.k)) ? fInt.format(val(y, s.k)) : "non disponibile"}`).join(", ")}`),
        series: SER.map(s => ({ label: s.label, c: s.c, vals: ys.map(y => val(y, s.k)) })), aria: `Linee: posti, iscritti e domande valide nei nidi del Municipio ${ROMANI[id]}, dal ${lab(ys[0])} al ${lab(ys[ys.length - 1])}` });
    const tab = datiTab(["Anno educativo", ...SER.map(s => s.label), "Lista d'attesa a fine anno"], ys.map(y => [`<td data-v="${y.slice(0, 4)}">${lab(y)}</td>`,
        ...SER.map(s => { const d = s.k === "iscritti" ? dOf(y) : null; return d ? `<td class="num" data-v=""><small>non confermato: ${fInt.format(d.valore)} nel file, ${fInt.format(d.valore_seconda_fonte)} nell'Annuario</small></td>` : td(val(y, s.k), "int"); }),
        td(ss[y]?.lista_attesa_finale, "int")]));
    return sez("Asili nido negli anni", "Posti, bambini iscritti e domande valide nei nidi comunali e convenzionati del municipio, anno educativo per anno educativo. Se le domande superano i posti, una parte dei bambini resta in lista d'attesa. Il grafico non dice quanti bambini abitano nel municipio.", `<div class="panel">${legend(SER)}${ch}${nota(`Totale di nidi comunali e privati convenzionati: dal 2023/24 i nidi in appalto passano dai comunali ai privati, quindi la divisione tra i due non è costante.${disc.length ? ` Iscritti ${disc.map((d) => d.anno).join(", ")}: il file della Dashboard e l'Annuario riportano numeri diversi, quindi il punto non è nel grafico.` : ""}`)}${tab}</div>`, fonti([{ snap: "nidi", testo: `Roma Capitale, Dashboard Nidi 2025, anni educativi dal ${lab(ys[0])} al ${lab(ys[ys.length - 1])}` }]));
}
/* ======================= residenti negli anni ======================= */
function blkResidenti(id) {
    const r = ser(id, "residenti");
    if (!r)
        return "";
    const ys = Object.keys(r.valori).sort(), ref = Math.max(...ys.map(y => r.valori[y]));
    const confini = (S.confini_cambiati || []).includes(id);
    const v0 = r.valori[ys[0]], v1 = r.valori[ys[ys.length - 1]];
    return sez("Residenti negli anni", `Persone iscritte all'anagrafe del municipio al 31 dicembre di ogni anno. È la base di tutti i valori per abitante della scheda (che usano il 2025). Non conta chi vive nel municipio senza esservi residente.`, `<div class="panel">${colChart({ rows: ys.map(y => ({ label: y, tip: `31/12/${y}: ${fInt.format(r.valori[y])} residenti`, segs: [{ v: r.valori[y], c: "var(--data)" }] })), unit: "int", asse: "numero di residenti", aria: `Colonne: residenti del Municipio ${ROMANI[id]} dal ${ys[0]} al ${ys[ys.length - 1]}`, stagger: true })}
    ${nota(`Dal ${ys[0]} al ${ys[ys.length - 1]}: da ${fInt.format(v0)} a ${fInt.format(v1)} residenti (${v1 >= v0 ? "+" : ""}${f1.format((v1 - v0) / v0 * 100)}%).${confini ? " " + S.nota_confini : ""}`)}
    ${datiTab(["Anno (31 dicembre)", "Residenti", "Controllo"], ys.map(y => [`<td data-v="${y}">${y}</td>`, td(r.valori[y], "int"), `<td><small>${esc(r.conferma[y] || "")}</small></td>`]))}</div>`, fonti([{ snap: "storico", testo: `Roma Capitale, tavole anagrafe al 31/12, ${ys[0]}-${ys[ys.length - 1]}`, extra: "Ogni anno confrontato con l'Annuario statistico: valori uguali." }]));
}
/* ======================= montaggio ======================= */
/* blocks: l'HTML dei blocchi della scheda (MUN_BLOCKS). Ogni gruppo di grafici va dopo il blocco con lo stesso tema;
   se un titolo cambia e il blocco non si trova, i grafici vanno in fondo, prima del profilo. */
const DOPO = [
    ["Il bilancio del municipio", [blkMissioni, blkTempo]],
    ["Appalti avviati dal municipio", [blkAppalti]],
    ["Progetti sul territorio", [blkProgetti]],
    ["Asili nido", [blkNidi]],
];
function graficiMunicipio(id, blocks) {
    const usati = new Set();
    const out = blocks.map(b => {
        const h = /<h2>([^<]+)<\/h2>/.exec(b)?.[1];
        const i = DOPO.findIndex(([t]) => t === h);
        if (i < 0)
            return b;
        usati.add(i);
        return b + DOPO[i][1].map(f => f(id)).join("");
    });
    const resto = DOPO.filter((_, i) => !usati.has(i)).flatMap(([, fs]) => fs.map(f => f(id))).join("");
    return blkConfronto(id) + out.join("") + resto + blkResidenti(id);
}
return { tempoTutti, graficiMunicipio };
})();

/* ======== lib/confronto.ts ======== */
MOD["lib/confronto.ts"] = (() => {

/* Confronta: due municipi fianco a fianco.
   - In alto: dove ciascuno dei due è sul podio (1°, 2° o 3° su 15) negli indicatori per abitante, quote e medie.
   - Poi: per ogni indicatore due barre affiancate, sulla scala dei 15 municipi, con la differenza scritta.
   - Verde e rosso solo dove il verso dell'indicatore è difendibile da solo (tabella DIREZIONE).
     Tutto il resto è neutro. Il colore non è mai da solo: c'è sempre la parola (meglio, peggio) e la differenza. */



const SPESA = "Spendere di più non è di per sé meglio o peggio: dipende dai bisogni del territorio e da come si spende.";
const TOTALE = "È un totale: cresce con le dimensioni del municipio, quindi non lo coloriamo.";
const DESCRIVE = "Descrive chi vive nel municipio, non quello che il municipio fa.";
const DIREZIONE = {
    /* Bilancio */
    peg_spese_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti di spesa per abitante" },
    peg_spese: { dir: "neutro", rel: false, perche: TOTALE },
    peg_correnti: { dir: "neutro", rel: false, perche: TOTALE },
    peg_capitale: { dir: "neutro", rel: false, perche: TOTALE },
    peg_correnti_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "spese correnti per abitante" },
    peg_capitale_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "investimenti per abitante" },
    peg_mis_04_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti per l'istruzione per abitante" },
    peg_mis_12_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti per politiche sociali e famiglia per abitante" },
    peg_mis_10_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti per strade e mobilità per abitante" },
    peg_mis_06_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti per sport e giovani per abitante" },
    peg_mis_05_ab: { dir: "neutro", rel: true, perche: SPESA, pod: "stanziamenti per la cultura per abitante" },
    /* Appalti */
    anac_importo: { dir: "neutro", rel: false, perche: TOTALE },
    anac_n: { dir: "neutro", rel: false, perche: TOTALE },
    anac_importo_ab: { dir: "neutro", rel: true, perche: "Più appalti avviati non sono di per sé meglio o peggio: dipende da cosa si compra e quando.", pod: "importo degli appalti avviati per abitante" },
    anac_diretti: { dir: "neutro", rel: true, diff: "pp", perche: "Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria: una quota alta non è da sola un'anomalia.", pod: "quota di CIG con affidamento diretto" },
    /* Progetti */
    prog_importo: { dir: "neutro", rel: false, perche: TOTALE },
    prog_n: { dir: "neutro", rel: false, perche: TOTALE },
    prog_importo_ab: { dir: "neutro", rel: true, perche: "I progetti sono gestiti per lo più dai dipartimenti di Roma Capitale, non dal municipio: l'importo non misura il suo operato.", pod: "fondi straordinari (PNRR, Giubileo, fondi UE) per abitante" },
    /* Servizi */
    ann_asili_nido_comunali: { dir: "neutro", rel: false, perche: TOTALE },
    ann_anziani_assistiti: { dir: "neutro", rel: false, perche: TOTALE },
    cf_anziani_1000: { dir: "neutro", rel: true, diff: "abs", suffix: "per 1.000 anziani", perche: "Più anziani assistiti può voler dire più servizio ma anche più bisogno: non lo coloriamo.", pod: "anziani assistiti per 1.000 residenti con 65 anni e più" },
    nidi_posti: { dir: "neutro", rel: false, perche: TOTALE },
    nidi_iscritti: { dir: "neutro", rel: false, perche: TOTALE },
    nidi_domande_valide: { dir: "neutro", rel: false, perche: TOTALE },
    nidi_lista_attesa_finale: { dir: "neutro", rel: false, perche: "Conta i bambini, quindi cresce con le dimensioni del municipio: il colore è sulla versione per 100 domande." },
    nidi_copertura: { dir: "su", rel: true, diff: "abs", suffix: "per 100 domande", perche: "Più bambini iscritti per ogni domanda valida: la richiesta di nido è coperta di più.", pod: "iscritti al nido per 100 domande valide" },
    cf_nidi_attesa: { dir: "giu", rel: true, diff: "abs", suffix: "per 100 domande", perche: "Più bambini rimasti in lista d'attesa a fine anno per ogni 100 domande valide: più richiesta di nido non soddisfatta." },
    /* Redditi */
    ann_reddito_imponibile_medio_eur: { dir: "neutro", rel: true, perche: DESCRIVE, pod: "reddito imponibile medio" },
    ann_reddito_imponibile_totale_eur: { dir: "neutro", rel: false, perche: TOTALE },
    ann_contribuenti: { dir: "neutro", rel: false, perche: TOTALE },
    ann_addizionale_comunale_totale_eur: { dir: "neutro", rel: false, perche: TOTALE },
    ann_addizionale_comunale_media_eur: { dir: "neutro", rel: true, perche: DESCRIVE, pod: "addizionale comunale IRPEF media per contribuente" },
    /* Imprese */
    ann_unita_locali_attive: { dir: "neutro", rel: false, perche: TOTALE },
    cf_ul_1000: { dir: "neutro", rel: true, perche: "Descrive l'economia del territorio, non quello che il municipio fa.", pod: "unità locali di imprese per 1.000 residenti" },
    ann_unita_locali_attive_commercio: { dir: "neutro", rel: false, perche: TOTALE },
    ann_unita_locali_attive_alloggio_ristorazione: { dir: "neutro", rel: false, perche: TOTALE },
    ann_unita_locali_attive_costruzioni: { dir: "neutro", rel: false, perche: TOTALE },
    ann_unita_locali_attive_professionali_tecniche: { dir: "neutro", rel: false, perche: TOTALE },
    /* Profilo */
    ann_popolazione: { dir: "neutro", rel: false, perche: TOTALE },
    ann_superficie_kmq: { dir: "neutro", rel: false, perche: TOTALE },
    ann_densita_ab_kmq: { dir: "neutro", rel: true, perche: DESCRIVE, pod: "densità abitativa" },
    ann_quota_65_e_oltre_pct: { dir: "neutro", rel: true, diff: "pp", perche: DESCRIVE, pod: "quota di residenti con 65 anni e più" },
    ann_quota_stranieri_pct: { dir: "neutro", rel: true, diff: "pp", perche: DESCRIVE, pod: "quota di residenti stranieri" },
};
/* indicatore nuovo, non ancora in tabella: neutro; relativo se è per abitante o una quota */
const confOf = (m) => DIREZIONE[m.id] || { dir: "neutro", rel: !!m.per || m.unit === "pct", perche: "Indicatore senza un verso stabilito: lo trattiamo come neutro.", diff: m.unit === "pct" ? "pp" : "rel" };
/* ---------- indicatori calcolati qui, solo per il confronto (rapporti fra campi dello stesso snapshot) ---------- */
function derivati() {
    const out = [];
    const N = D.nidi;
    if (N)
        out.push({ after: "nidi_copertura", m: { id: "cf_nidi_attesa", label: "Lista d'attesa a fine anno per 100 domande valide", unit: "dec", group: "Servizi", snap: "nidi",
                periodo: "anno educativo " + (N.municipi["1"]?.anno_educativo || ""), src: "Dashboard Nidi 2025, calcolo: bambini in lista d'attesa a fine anno / domande valide x 100",
                note: "Quanti bambini restano in lista d'attesa alla fine dell'anno educativo per ogni 100 domande valide.",
                get: id => { const m = N.municipi[id]; return m && m.domande_valide > 0 && isNum(m.lista_attesa_finale) ? m.lista_attesa_finale / m.domande_valide * 100 : null; } } });
    if (A?.indicatori?.anziani_assistiti && A.indicatori.residenti_65_e_oltre) {
        const ia = A.indicatori.anziani_assistiti, ir = A.indicatori.residenti_65_e_oltre;
        out.push({ after: "ann_anziani_assistiti", m: { id: "cf_anziani_1000", label: "Anziani assistiti per 1.000 residenti con 65 anni e più", unit: "dec", group: "Servizi", snap: "profilo_annuario",
                periodo: ia.periodo, src: `Annuario statistico, ${ia.tabella} / ${ir.tabella} (residenti al ${ir.periodo}), calcolo: assistiti / residenti con 65 anni e più x 1.000`,
                note: ia.misura, get: id => { const x = A.municipi[id]; return x && isNum(x.anziani_assistiti) && x.residenti_65_e_oltre > 0 ? x.anziani_assistiti / x.residenti_65_e_oltre * 1000 : null; } } });
    }
    if (A?.indicatori?.unita_locali_attive) {
        const iu = A.indicatori.unita_locali_attive;
        out.push({ after: "ann_unita_locali_attive", m: { id: "cf_ul_1000", label: "Unità locali di imprese attive per 1.000 residenti", unit: "dec", group: "Imprese", snap: "profilo_annuario",
                periodo: iu.periodo, src: `Annuario statistico, ${iu.tabella} / ${POP_SRC}`, note: iu.misura,
                get: id => { const x = A.municipi[id]; return x && isNum(x.unita_locali_attive) && x.popolazione > 0 ? x.unita_locali_attive / x.popolazione * 1000 : null; } } });
    }
    return out;
}
const LISTA = (() => {
    const list = [...M];
    for (const { after, m } of derivati()) {
        const i = list.findIndex(x => x.id === after);
        list.splice(i >= 0 ? i + 1 : list.length, 0, m);
    }
    return list;
})();
/* ---------- numeri ---------- */
const NA = "dato non disponibile";
/* come fmt(), ma gli euro per abitante sotto i 10 € tengono i centesimi: mai "0 €" per 0,24 € */
function fmtC(v, unit, ref) {
    if (!isNum(v))
        return NA;
    if (unit === "eur_ab")
        return Math.abs(v) < 10 && v !== 0 ? f2.format(v) + " €" : fEur.format(v);
    return fmt(v, unit, ref);
}
/* differenza nella stessa unità, sempre positiva (il verso lo dice la frase) */
function fmtDelta(d, unit, ref) {
    if (unit === "eur_ab" || unit === "eur_exact")
        return Math.abs(d) < 10 ? f2.format(d) + " €" : fEur.format(d);
    if (unit === "eur")
        return fmt(d, "eur", ref);
    if (unit === "dec")
        return Math.abs(d) < 10 ? f1.format(d) : fInt.format(d);
    return fInt.format(d);
}
/* sotto queste soglie una differenza in % ingannerebbe (es. 0,24 € contro 2 € = +733%): scriviamo la differenza assoluta */
const PICCOLO = { eur_ab: 5, eur_exact: 50, eur: 250000, int: 30, dec: 5, pct: 1 };
const nome = (id) => "Municipio " + ROMANI[id];
const al = (id) => "al " + nome(id);
const del = (id) => "del " + nome(id);
/* Chi è più alto e di quanto, in una frase. a e b sono gli id dei municipi. */
function diffInfo(m, a, b) {
    const x = m.get(a), y = m.get(b), c = confOf(m);
    if (!isNum(x) || !isNum(y)) {
        const manca = [!isNum(x) ? a : null, !isNum(y) ? b : null].filter(Boolean);
        return { hi: null, lo: null, na: true, testo: `Confronto non possibile: ${NA} per ${manca.length === 2 ? "entrambi i municipi" : "il " + nome(manca[0])}.` };
    }
    if (x === y)
        return { hi: null, lo: null, uguali: true, testo: "Stesso valore nei due municipi." };
    const [hi, lo, vh, vl] = x > y ? [a, b, x, y] : [b, a, y, x];
    const d = vh - vl, mode = c.diff || (m.unit === "pct" ? "pp" : "rel");
    const suf = c.suffix ? " " + c.suffix : "";
    let quanto;
    if (mode === "pp")
        quanto = `di ${f1.format(d)} punti percentuali`;
    else if (mode === "abs")
        quanto = `di ${fmtDelta(d, m.unit)}${suf}`;
    else if (vl <= 0 || Math.abs(vl) < (PICCOLO[m.unit] ?? 0))
        quanto = `di ${fmtDelta(d, m.unit, vh)}${suf}`;
    else if (vh / vl >= 3)
        quanto = `: ${f1.format(vh / vl)} volte il valore ${del(lo)}`;
    else {
        const pc = d / vl * 100;
        quanto = `: +${pc < 1 ? f1.format(pc) : fInt.format(pc)}% rispetto ${al(lo)}`;
    }
    const testo = quanto.startsWith(":") ? `${nome(hi)} più alto${quanto}` : `${nome(hi)} più alto ${quanto} rispetto ${al(lo)}`;
    return { hi, lo, testo };
}
function rankOf(m, id) {
    const v = m.get(id);
    if (!isNum(v))
        return null;
    const all = IDS.map(i => m.get(i)).filter(isNum);
    return { pos: 1 + all.filter(w => w > v).length, n: all.length, pari: all.filter(w => w === v).length > 1 };
}
const median = (arr) => { const s = [...arr].sort((p, q) => p - q), k = s.length; return k ? (k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2) : null; };
function podiOf(id) {
    const all = [];
    LISTA.forEach(m => { const c = confOf(m); if (!c.rel || c.dir === "giu")
        return; const r = rankOf(m, id); if (r && r.pos <= 3)
        all.push({ m, r, v: m.get(id) }); });
    /* a parità di posto: prima i temi dei soldi (ordine dei temi della pagina), poi l'ordine del registro */
    const g = groupsOf(LISTA), gi = (p) => g.indexOf(p.m.group), li = (p) => LISTA.indexOf(p.m);
    return all.sort((p, q) => p.r.pos - q.r.pos || gi(p) - gi(q) || li(p) - li(q));
}
function podioTop(all, k = 3) {
    const out = [], left = [...all];
    while (out.length < k && left.length) {
        const best = left[0].r.pos, used = new Set(out.map(p => p.m.group));
        const i = Math.max(0, left.findIndex(p => p.r.pos === best && !used.has(p.m.group)));
        out.push(left.splice(i, 1)[0]);
    }
    return out;
}
const podLabel = (m) => confOf(m).pod || m.label.charAt(0).toLowerCase() + m.label.slice(1);
const posTxt = (r) => `${r.pos}°${r.pari ? " a pari merito" : ""}`;
function podioInfo(p) {
    return `<p><b>${esc(p.m.label)}</b>${p.m.note ? `: ${esc(p.m.note)}` : "."}</p>
    <p>Valore: <b>${esc(fmtC(p.v, p.m.unit))}</b>. Posizione: ${esc(posTxt(p.r))} su ${p.r.n} municipi con il dato, dal valore più alto al più basso.</p>
    <p>Fonte: ${esc(p.m.src || "")}${p.m.periodo ? `. Periodo: ${esc(p.m.periodo)}` : ""}.</p>`;
}
function podioCard(id, side) {
    const all = podiOf(id), top = podioTop(all), rest = all.filter(p => !top.includes(p));
    const item = (p) => `<li class="cf-pod-i"><span class="cf-pos" aria-hidden="true">${p.r.pos}°</span>
    <span class="cf-pod-t"><span class="cf-pod-l"><span class="sr">${p.r.pos}° </span>${p.r.pari ? `<span class="cf-pari">a pari merito</span> ` : ""}per ${esc(podLabel(p.m))}${info(podioInfo(p), p.m.label)}</span>
    <span class="cf-pod-v">${esc(fmtC(p.v, p.m.unit))}${p.m.periodo ? ` · ${esc(p.m.periodo)}` : ""}</span></span></li>`;
    return `<div class="panel cf-pod"><h3><span class="dot ${side}"></span>&nbsp;${nome(id)}</h3>
    ${top.length ? `<ol class="cf-pod-l0">${top.map(item).join("")}</ol>` : ""}
    ${top.length < 3 ? `<p class="cf-none">${top.length ? "Nessun altro podio." : "Nessun podio negli indicatori per abitante, quote e medie."}</p>` : ""}
    ${rest.length ? `<details class="cf-more"><summary>Altri ${rest.length} podi</summary><ol class="cf-pod-l0">${rest.map(item).join("")}</ol></details>` : ""}</div>`;
}
const SIMILE = 0.05;
/* ---------- una riga per indicatore: due barre sulla scala dei 15 municipi ---------- */
const ICON_OK = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.7l4.6-5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_KO = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.6v4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="6" cy="9.3" r="1.1" fill="currentColor"/></svg>`;
const badge = (ok) => `<span class="cf-badge ${ok ? "ok" : "ko"}">${ok ? ICON_OK : ICON_KO}${ok ? "meglio" : "peggio"}</span>`;
function indicatore(m, a, b) {
    const c = confOf(m), vals = IDS.map(i => m.get(i)).filter(isNum), max = Math.max(0, ...vals), med = median(vals);
    const d = diffInfo(m, a, b), x = m.get(a), y = m.get(b);
    /* differenze sotto il 5% del valore più alto: valori simili, niente verde o rosso */
    const simile = isNum(x) && isNum(y) && Math.abs(x - y) < SIMILE * Math.max(Math.abs(x), Math.abs(y));
    const colore = c.dir !== "neutro" && d.hi && !simile;
    const better = colore ? (c.dir === "su" ? d.hi : d.lo) : null;
    const riga = (id, side) => {
        const v = m.get(id), r = rankOf(m, id), w = isNum(v) && max > 0 ? Math.max(0, v / max * 100) : 0;
        const tip = `${nome(id)}: ${fmtC(v, m.unit, max)}${r ? `, ${r.pos}° su ${r.n}` : ""}`;
        return `<div class="cf-r ${side}${better ? (better === id ? " is-ok" : " is-ko") : ""}" title="${esc(tip)}">
      <span class="cf-n"><span class="dot ${side}"></span>${ROMANI[id]}</span>
      <span class="cf-t">${isNum(v) && v > 0 ? `<i style="width:${w.toFixed(2)}%"></i>` : ""}${isNum(med) && max > 0 ? `<b class="cf-med" style="left:${(med / max * 100).toFixed(2)}%"></b>` : ""}</span>
      <span class="cf-v${isNum(v) ? "" : " na"}"><span class="cf-num">${esc(fmtC(v, m.unit, max))}</span>${r ? `<small>${r.pos}° su ${r.n}${r.pari ? " (pari)" : ""}</small>` : ""}${better ? badge(better === id) : ""}</span></div>`;
    };
    const freccia = d.hi ? `<span aria-hidden="true">▲ </span>` : "";
    const inf = `${m.note || m.src ? `<p>${esc(m.note || "")}</p>` : ""}<p>Fonte: ${esc(m.src || "")}${m.periodo ? `, ${esc(m.periodo)}` : ""}.</p><p><b>Colore:</b> ${c.dir === "su" ? "un valore più alto è meglio. " : c.dir === "giu" ? "un valore più alto è peggio. " : "neutro. "}${esc(c.perche)}</p>${isNum(med) ? `<p>La tacca sulla barra è la mediana dei 15 municipi: ${esc(fmtC(med, m.unit, max))}.</p>` : ""}`;
    return `<div class="panel cf-ind${c.dir !== "neutro" ? " dir" : ""}">
    <div class="cf-h"><h3>${esc(m.label)}${info(inf, m.label)}</h3>${m.periodo ? `<span class="cf-per">${esc(m.periodo)}</span>` : ""}</div>
    <div class="cf-pair">${riga(a, "a")}${riga(b, "b")}</div>
    <p class="cf-d${d.na ? " na" : ""}">${freccia}${esc(d.testo)}${c.dir !== "neutro" && d.hi && simile ? ". Valori simili: non lo coloriamo" : ""}</p></div>`;
}
/* totali: tabella compatta, sempre neutra */
function totali(list, a, b) {
    if (!list.length)
        return "";
    return `<details class="cf-abs"><summary>Totali (${list.length}): crescono con le dimensioni del municipio</summary>
    <div class="table-wrap"><table><thead><tr><th>Indicatore</th><th class="num"><span class="dot a"></span> ${ROMANI[a]}</th><th class="num"><span class="dot b"></span> ${ROMANI[b]}</th><th>Differenza</th></tr></thead><tbody>
    ${list.map(m => {
        const x = m.get(a), y = m.get(b), ref = Math.max(Math.abs(x || 0), Math.abs(y || 0));
        return `<tr><td>${esc(m.label)}${info(`<p>${esc(m.note || "")}</p><p>Fonte: ${esc(m.src || "")}${m.periodo ? `, ${esc(m.periodo)}` : ""}.</p>`, m.label)}${m.periodo ? `<br><small class="cf-per">${esc(m.periodo)}</small>` : ""}</td><td class="num" data-v="${isNum(x) ? x : ""}">${esc(fmtC(x, m.unit, ref))}</td><td class="num" data-v="${isNum(y) ? y : ""}">${esc(fmtC(y, m.unit, ref))}</td><td>${esc(diffInfo(m, a, b).testo)}</td></tr>`;
    }).join("")}
    </tbody></table></div></details>`;
}
/* "Come leggiamo i colori": la tabella DIREZIONE, in pagina */
function legenda() {
    const rel = LISTA.filter(m => confOf(m).rel);
    const col = rel.filter(m => confOf(m).dir !== "neutro"), neu = rel.filter(m => confOf(m).dir === "neutro");
    const motivi = new Map();
    neu.forEach(m => { const k = confOf(m).perche; motivi.set(k, [...(motivi.get(k) || []), m.label]); });
    return `<details class="panel cf-leg"><summary><b>Come leggiamo i colori</b><span class="cf-leg-s">${badge(true)} ${badge(false)} <span class="cf-neu">grigio = neutro</span></span></summary>
    <p>Coloriamo solo gli indicatori in cui un valore più alto è chiaramente meglio o peggio. Tutti gli altri restano neutri: diciamo solo quale municipio è più alto e di quanto. Accanto al colore c'è sempre la parola, meglio o peggio, e la differenza.</p>
    <p>Confrontiamo valori per abitante, quote e medie, perché i municipi hanno dimensioni diverse. I totali sono in fondo a ogni tema, senza colore.</p>
    <div class="table-wrap"><table><thead><tr><th>Indicatore</th><th>Come lo leggiamo</th><th>Perché</th></tr></thead><tbody>
      ${col.map(m => `<tr><td>${esc(m.label)}</td><td>${confOf(m).dir === "su" ? "più alto è meglio" : "più alto è peggio"}</td><td>${esc(confOf(m).perche)}</td></tr>`).join("")}
      ${[...motivi].map(([why, labels]) => `<tr><td>${labels.map(esc).join("<br>")}</td><td>neutro</td><td>${esc(why)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src keep">La tacca su ogni barra è la mediana dei 15 municipi. "3° su 15" è la posizione dal valore più alto al più basso. Quando un valore è molto piccolo scriviamo la differenza in euro o in unità, non in percentuale. Se i due valori differiscono meno del 5% non coloriamo: sono simili.</p></details>`;
}
/* ---------- pagina ---------- */
function confrontaIds(a, b) {
    if (!IDS.includes(a))
        a = "1";
    if (!IDS.includes(b) || b === a)
        b = a === "1" ? "2" : "1";
    return [a, b];
}
const SWAP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M4 8h14m0 0-3.5-3.5M18 8l-3.5 3.5M20 16H6m0 0 3.5-3.5M6 16l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function htmlConfronto(a0, b0) {
    const [a, b] = confrontaIds(a0, b0);
    const sel = (id, cur, other, lab) => `<select id="${id}" aria-label="${lab}">${IDS.map(i => `<option value="${i}"${i === cur ? " selected" : ""}${i === other ? " disabled" : ""}>Municipio ${ROMANI[i]}</option>`).join("")}</select>`;
    const pres = (id) => D.politica?.municipi[id]?.presidente;
    const pop = (id) => A?.municipi[id]?.popolazione;
    const G = D.mappa;
    const fill = (id) => id === a ? "var(--cmp-a)" : id === b ? "var(--cmp-b)" : "var(--map-na)";
    const who = (id, side) => `<div class="cf-who"><span class="dot ${side}"></span><div><b>${nome(id)}</b>
    <span>Presidente: ${esc(pres(id) || "non indicato")}</span><span>Residenti: ${fmt(pop(id), "int")}</span><a href="${R.mun(id)}">Apri la scheda</a></div></div>`;
    const pa = pop(a), pb = pop(b);
    const ratio = isNum(pa) && isNum(pb) && Math.min(pa, pb) > 0 ? Math.max(pa, pb) / Math.min(pa, pb) : null;
    const scala = isNum(ratio) && ratio >= 1.1
        ? (ratio >= 2 ? `Il ${nome(pa >= pb ? a : b)} ha ${f1.format(ratio)} volte i residenti ${del(pa >= pb ? b : a)}` : `Il ${nome(pa >= pb ? a : b)} ha il ${fInt.format((ratio - 1) * 100)}% di residenti in più rispetto ${al(pa >= pb ? b : a)}`) + ": per questo confrontiamo valori per abitante, quote e medie."
        : "Confrontiamo valori per abitante, quote e medie, perché i municipi hanno dimensioni diverse.";
    const groups = groupsOf(LISTA);
    return `<div class="cf">
  <div class="hero"><h1>Confronta due municipi</h1>
    <p class="lede">Scegli due municipi. Puoi anche cliccare la mappa per cambiare il secondo.</p>
    <div class="pick2"><label><span class="dot a"></span>${sel("ca", a, b, "Primo municipio")}</label>
      <button class="btn cf-swap" type="button" id="swap" aria-label="Scambia i municipi" title="Scambia i municipi">${SWAP_SVG}</button>
      <label><span class="dot b"></span>${sel("cb", b, a, "Secondo municipio")}</label></div></div>

  <section class="block cf-top"><div class="head"><div><h2>Dove sono sul podio${info(`<p>Per ognuno dei due municipi, fino a 3 indicatori in cui è 1°, 2° o 3° fra i 15 municipi, dal valore più alto. Prima i posti più alti; a parità di posto, temi diversi.</p><p>Contano solo valori per abitante, quote e medie, non i totali. Non contano gli indicatori in cui un valore alto è peggio, come la lista d'attesa dei nidi: un primo posto lì non è un risultato.</p><p>È una posizione in classifica, non un giudizio.</p>`, "Dove sono sul podio")}</h2></div></div>
    <div class="grid g2">${podioCard(a, "a")}${podioCard(b, "b")}</div></section>

  <div class="map-layout cf-ml">
    ${G ? `<div class="panel map"><svg viewBox="${G.viewBox}" role="img" aria-label="Mappa: ${nome(a)} e ${nome(b)}">${G.municipi.map((x) => { const id = String(x.municipio); return `<path d="${x.path}" fill="${fill(id)}" data-id="${id}"><title>Municipio ${x.romano}</title></path>`; }).join("")}${mapLabels(G)}</svg></div>` : naBlock("Mappa")}
    <div class="panel cf-whos">${who(a, "a")}${who(b, "b")}<p class="cf-scala">${esc(scala)}</p></div></div>

  <div class="cf-legwrap">${legenda()}</div>

  ${groups.map(g => {
        const gl = LISTA.filter(m => m.group === g), rel = gl.filter(m => confOf(m).rel), tot = gl.filter(m => !confOf(m).rel);
        return `<section class="block cf-g"><div class="head"><div><h2>${esc(g)}</h2></div></div>
    ${rel.length ? `<div class="cf-grid">${rel.map(m => indicatore(m, a, b)).join("")}</div>` : ""}
    ${totali(tot, a, b)}
    ${[...new Set(gl.map(m => m.snap))].map(s => srcLine(s)).join("")}</section>`;
    }).join("")}
  </div>`;
}
function wireConfronto(root, signal, a0, b0, nav) {
    const [a, b] = confrontaIds(a0, b0);
    const go = (x, y) => nav(R.conf(x, y));
    root.querySelector("#ca")?.addEventListener("change", e => go(e.target.value, b), { signal });
    root.querySelector("#cb")?.addEventListener("change", e => go(a, e.target.value), { signal });
    root.querySelector("#swap")?.addEventListener("click", () => go(b, a), { signal });
    wireMap(root, signal, id => { if (id !== a)
        go(a, id); });
    afterRender(root);
}
return { DIREZIONE, confOf, LISTA, fmtC, diffInfo, rankOf, podiOf, podioTop, confrontaIds, htmlConfronto, wireConfronto };
})();

/* ======== lib/mappa.ts ======== */
MOD["lib/mappa.ts"] = (() => {

/* Mappa della pagina iniziale: indirizzi, mappa di base e testo del credito.
   La mappa è adattata da Quartieri di Roma 2026 di Urbe Hub (github.com/urbe-hub/quartieri-roma-2026,
   codice MIT, vedi THIRD_PARTY.md): stessa libreria (Leaflet), stessa mappa di base (OpenStreetMap)
   e stesso file dei confini delle aree. Questo modulo non carica Leaflet: lo fa lib/mappa-leaflet.ts,
   solo nel browser. */

const QR_SITO = "https://romaquartieri.it/";
const QR_REPO = "https://github.com/urbe-hub/quartieri-roma-2026";
const QR_LICENZA = QR_REPO + "/blob/main/LICENSE";
const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";
const OSM_SEGNALA = "https://www.openstreetmap.org/fixthemap";
/* Mappa di base: le tile di OpenStreetMap, come in Quartieri di Roma 2026, con la policy d'uso di
   OpenStreetMap Foundation (operations.osmfoundation.org/policies/tiles/): attribuzione visibile sulla
   mappa, nessun prefetch, nessun uso offline, Referer del browser lasciato com'è. Se il traffico cresce
   si passa a un fornitore con un piano adatto cambiando NEXT_PUBLIC_MAPPA_TILE_URL al build
   (e l'attribuzione qui sotto, se cambia il fornitore). */
const TILE_URL = "" || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUZIONE = `© <a href="${OSM_COPYRIGHT}" target="_blank" rel="noopener">OpenStreetMap</a> contributors`;
/* Riga sotto la mappa */
function creditoMappa() {
    return `<p class="map-credit">Mappa adattata da Quartieri di Roma (Urbe Hub): ${aLink(QR_SITO, "romaquartieri.it")} e ${aLink(QR_REPO, "codice su GitHub")} (licenza ${aLink(QR_LICENZA, "MIT")}). Confini dei municipi e mappa di base © ${aLink(OSM_COPYRIGHT, "OpenStreetMap contributors")}, ${aLink(ODBL, "ODbL")}. Quartieri: Roma Capitale, GeoRoma (deliberazione n. 150/2026).</p>`;
}
/* Riquadro della pagina Fonti */
function fontiMappa() {
    return `<div class="panel"><h3>Mappa della pagina iniziale</h3>
    ${creditoMappa().replace('class="map-credit"', 'class="src" style="margin-top:0"')}
    <ul>
      <li>Da ${aLink(QR_REPO, "Quartieri di Roma 2026")} di Urbe Hub riprendiamo l'impostazione della mappa (Leaflet, mappa di base di OpenStreetMap, i confini delle 457 aree della deliberazione n. 150/2026 dentro i municipi, il nome dell'area al passaggio del mouse o con un tocco) e il file dei confini delle aree, che semplifichiamo ancora per il sito.</li>
      <li>Il codice di Quartieri di Roma 2026 è sotto licenza MIT, compatibile con la AGPL-3.0 di questo sito. I confini delle aree sono dati aperti di Roma Capitale (art. 52, c. 2, del CAD), con fonte Roma Capitale. I confini dei municipi e la mappa di base sono © OpenStreetMap contributors, sotto ${aLink(ODBL, "ODbL 1.0")}.</li>
      <li>I colori dei municipi vengono dagli indicatori del sito, non da Quartieri di Roma.</li>
      <li>La mappa di base arriva dai server di OpenStreetMap (tile.openstreetmap.org): il browser li contatta direttamente, quindi ricevono l'indirizzo IP di chi visita. Un errore nella mappa di base si segnala a OpenStreetMap: ${aLink(OSM_SEGNALA, "segnala un errore")}.</li>
      <li>Libreria della mappa: ${aLink("https://leafletjs.com/", "Leaflet")} 1.9.4, licenza BSD 2-Clause.</li>
    </ul></div>`;
}
return { QR_SITO, QR_REPO, QR_LICENZA, OSM_COPYRIGHT, ODBL, OSM_SEGNALA, TILE_URL, TILE_ATTRIBUZIONE, creditoMappa, fontiMappa };
})();

/* ======== lib/mappa-leaflet.ts ======== */
MOD["lib/mappa-leaflet.ts"] = (() => {
const { TILE_ATTRIBUZIONE, TILE_URL } = MOD["lib/mappa.ts"];
let S = null;
let P = null;
let cur = null;
let vivi = 0, kill = 0;
const TIPO = { quartiere: "quartiere", rione: "rione", "zona funzionale": "zona funzionale" };
function montaMappa(root, signal, m, onClick) {
    const panel = root.querySelector(".panel.map");
    if (!panel)
        return;
    const req = { panel, m, onClick };
    cur = req;
    vivi++;
    clearTimeout(kill);
    /* cambiando indicatore la pagina si ridisegna: la mappa resta la stessa (zoom compreso) e passa nel nuovo riquadro */
    signal.addEventListener("abort", () => {
        vivi = Math.max(0, vivi - 1);
        if (cur === req)
            cur = null;
        if (!vivi)
            kill = window.setTimeout(distruggi, 0);
    }, { once: true });
    if (S) {
        applica(S, req);
        return;
    }
    if (!P)
        P = carica().then(([L, Q, Mu]) => { P = null; if (cur && !S) {
            S = crea(L, Q, Mu, cur);
            applica(S, cur);
        } })
            .catch(() => { P = null; /* resta la mappa SVG */ });
}
function distruggi() { if (vivi || !S)
    return; S.map.remove(); S.el.remove(); S = null; }
async function carica() {
    const [L, q, mu] = await Promise.all([window.L ? Promise.resolve(window.L) : Promise.reject(new Error("Leaflet assente")), jsonDa("mappa-quartieri"), jsonDa("mappa-municipi")]);
    return [(L.default || L), q.default?.aree || q.aree, mu.default?.municipi || mu.municipi];
}
const conMouse = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const latlngs = (g) => g;
function crea(L, Q, Mu, req) {
    const el = document.createElement("div");
    el.className = "mq-map";
    req.panel.querySelector(":scope > svg")?.replaceWith(el);
    if (!el.isConnected)
        req.panel.prepend(el);
    const mouse = conMouse();
    const map = L.map(el, {
        zoomControl: false, attributionControl: false, zoomSnap: 0.25, zoomDelta: 1, maxZoom: 17,
        dragging: mouse, touchZoom: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90, keyboard: true,
    });
    L.control.zoom({ position: "topleft", zoomInTitle: "Ingrandisci", zoomOutTitle: "Riduci" }).addTo(map);
    L.control.attribution({ prefix: `<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>` }).addTo(map);
    /* nessun prefetch: solo le tile della vista (policy d'uso delle tile di OpenStreetMap) */
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUZIONE, keepBuffer: 1 }).addTo(map);
    const st = { L, map, el, mun: {}, m: req.m, byId: {}, onClick: req.onClick };
    const pop = st.pop = L.popup({ closeButton: true, autoPanPadding: [16, 16], className: "mq-pop", maxWidth: 260 });
    const evidenzia = (id, on) => { const p = st.mun[id]?.getElement(); if (p)
        p.classList.toggle("on", on); };
    const testo = (id, area) => {
        const v = st.byId[id];
        return `${area ? `<b>${esc(area.n)}</b> <span class="mq-t">${esc(TIPO[area.t] || area.t)}</span><br>` : ""}<b>Municipio ${ROMANI[id]}</b>: ${esc(fmt(v, st.m.unit))}`;
    };
    const tocco = (id, area, ll) => {
        Object.keys(st.mun).forEach(k => evidenzia(k, k === id));
        const box = document.createElement("div");
        box.innerHTML = `<p>${testo(id, area)}</p><a class="mq-apri" href="${R.mun(id)}">Apri la scheda del Municipio ${ROMANI[id]}</a>`;
        box.querySelector("a").addEventListener("click", e => { if (e.metaKey || e.ctrlKey || e.shiftKey)
            return; e.preventDefault(); st.onClick(id); });
        pop.setLatLng(ll).setContent(box).openOn(map);
    };
    pop.on("remove", () => Object.keys(st.mun).forEach(k => evidenzia(k, false)));
    const collega = (layer, id, area) => {
        if (mouse) {
            layer.bindTooltip(() => testo(id, area), { sticky: true, direction: "top", offset: [0, -12], className: "mq-tip", opacity: 1 });
            layer.on("mouseover", () => evidenzia(id, true));
            layer.on("mouseout", () => evidenzia(id, false));
            layer.on("click", () => st.onClick(id));
        }
        else
            layer.on("click", e => { L.DomEvent.stopPropagation(e); tocco(id, area, e.latlng); });
    };
    /* municipi: il colore dell'indicatore */
    const bounds = L.latLngBounds([]);
    for (const x of Mu) {
        const id = String(x.m);
        const layer = L.polygon(latlngs(x.g), { className: "mq-mun", weight: 1.6, fillOpacity: 1, smoothFactor: 0.5 }).addTo(map);
        st.mun[id] = layer;
        bounds.extend(layer.getBounds());
        collega(layer, id);
    }
    /* quartieri, rioni e zone funzionali: solo il confine, il nome al passaggio o col tocco */
    for (const a of Q) {
        const layer = L.polygon(latlngs(a.g), { className: "mq-q" + (a.t === "zona funzionale" ? " mq-zf" : ""), weight: 0.7, fillOpacity: 0, smoothFactor: 0.5 }).addTo(map);
        collega(layer, String(a.m), a);
    }
    /* etichette: i numeri dei municipi da lontano, i nomi delle aree da vicino */
    const lab = (ll, html, cls) => L.marker(ll, { icon: L.divIcon({ className: cls, html, iconSize: null }), interactive: false, keyboard: false });
    st.labM = L.layerGroup(Mu.map(x => lab(x.l, `<span>${ROMANI[x.m]}</span>`, "mq-lab mq-lab-m"))).addTo(map);
    st.labQ = L.layerGroup(Q.map(a => lab(a.l, `<span>${esc(a.n)}</span>`, "mq-lab mq-lab-q")));
    const perZoom = () => {
        const z = map.getZoom(), vicino = z >= 14;
        el.classList.toggle("mq-medio", z >= 12.5 && !vicino);
        el.classList.toggle("mq-vicino", vicino);
        if (vicino) {
            map.removeLayer(st.labM);
            map.addLayer(st.labQ);
        }
        else {
            map.removeLayer(st.labQ);
            map.addLayer(st.labM);
        }
    };
    map.on("zoomend", perZoom);
    map.fitBounds(bounds, { padding: [8, 8], animate: false });
    map.setMinZoom(Math.max(9, map.getZoom() - 0.5));
    map.setMaxBounds(bounds.pad(0.35));
    perZoom();
    /* suggerimenti: rotella senza Ctrl o ⌘ e un dito sul telefono scorrono la pagina */
    const hint = st.hint = document.createElement("div");
    hint.className = "mq-hint";
    hint.setAttribute("aria-hidden", "true");
    el.appendChild(hint);
    let hintT = 0;
    const mostra = (t) => { hint.textContent = t; hint.classList.add("on"); clearTimeout(hintT); hintT = window.setTimeout(() => hint.classList.remove("on"), 1400); };
    el.addEventListener("wheel", e => {
        if (e.ctrlKey || e.metaKey)
            return;
        e.stopPropagation(); /* Leaflet non la riceve: scorre la pagina */
        mostra(/Mac|iPhone|iPad/.test(navigator.platform) ? "Per ingrandire: ⌘ + rotella o i tasti + e −" : "Per ingrandire: Ctrl + rotella o i tasti + e −");
    }, { capture: true, passive: true });
    if (!mouse)
        el.addEventListener("touchmove", e => { if (e.touches.length === 1 && !pop.isOpen())
            mostra("Usa due dita per spostare la mappa"); }, { passive: true });
    return st;
}
function applica(st, req) {
    const svg = req.panel.querySelector(":scope > svg");
    if (svg)
        svg.replaceWith(st.el);
    else if (st.el.parentElement !== req.panel)
        req.panel.prepend(st.el);
    st.onClick = req.onClick;
    st.m = req.m;
    const vals = values(req.m), br = breaks(vals.map(r => r.v));
    st.byId = Object.fromEntries(vals.map(r => [r.id, r.v]));
    for (const id of IDS) {
        const v = st.byId[id], p = st.mun[id]?.getElement();
        if (p)
            p.setAttribute("data-c", isNum(v) ? String(1 + br.filter(b => v >= b).length) : "na");
    }
    st.el.setAttribute("aria-label", `Mappa interattiva dei 15 municipi e dei loro quartieri: ${req.m.label}`);
    st.el.setAttribute("role", "region");
    st.map.closePopup();
    st.map.invalidateSize({ animate: false });
}
return { montaMappa };
})();

  const tutto = Object.assign({}, ...Object.values(MOD));
  for (const k of ["wireGrafici","htmlFondo","wireFondo","classificheHome","torteHome","graficiMunicipio","tempoTutti","htmlConfronto","wireConfronto","creditoMappa","fontiMappa","montaMappa"]) if (typeof tutto[k] !== "function") throw new Error("da-web.js: manca " + k);
  return { ...tutto, wireMap };
})();
