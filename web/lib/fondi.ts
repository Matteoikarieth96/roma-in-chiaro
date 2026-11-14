/* Pagine dei fondi straordinari: PNRR e Giubileo 2025. Stesso codice, in JavaScript semplice, in fondo a
   scripts/sections.js (sito statico, #/pnrr e #/giubileo-2025): un testo o un grafico si cambia in tutti e due.
   Legge solo data/snapshot/progetti.json (via engine.D) e i residenti di profilo_annuario.json.
   Regole: si contano solo le schede con contato_nel_totale; l'importo è importo_programma_euro
   (fondi del programma assegnati, non pagamenti); un importo mancante resta "non disponibile" e
   non entra nelle somme; le date sono solo quelle scritte nel campo Periodo della scheda.
   Grafici in HTML e SVG in linea, senza librerie. Colori: token --c1…--c5 e --c-na in globals.css,
   controllati con lo script della skill dataviz (validate_palette.js) su chiaro e scuro. */
import { A, D, IDS, POP_SRC, ROMANI, aLink, dateIt, esc, f1, fInt, fmt, fonteHtml, info, isNum, kpi, safeUrl } from "./engine";
import { R } from "./routes";
import { colChart, datiTab, donut, legend, nota, pct, ranking, td, wireGrafici } from "./grafici";

export type Programma = "PNRR" | "Giubileo 2025";
const P = D.progetti;
const LETTO = P ? "elenco letto il " + dateIt(P.verificato) : "";

/* gruppi cittadini, con le stesse etichette del blocco della pagina iniziale */
const GRUPPI: [string, string][] = [["senza_municipio", "Senza municipio indicato"], ["intermunicipale", "Intermunicipali"], ["piu_municipi", "Su più municipi"]];

type Rec = { r: any; area: string; ord: number; luogo: string; v: number | null };

export function records(prog: Programma): Rec[] {
  if (!P) return [];
  const out: Rec[] = [];
  const push = (r: any, area: string, ord: number, luogo: string) => {
    if (r.programma !== prog || !r.contato_nel_totale) return;
    out.push({ r, area, ord, luogo, v: isNum(r.importo_programma_euro) ? r.importo_programma_euro : null });
  };
  IDS.forEach(id => (P.municipi[id]?.progetti || []).forEach(r => push(r, id, +id, "Municipio " + ROMANI[id])));
  GRUPPI.forEach(([k, l], i) => (P.cittadino?.[k]?.progetti || []).forEach(r => {
    const tags = (r.municipio_tag || []).filter(t => ROMANI[t]);
    push(r, k, 16 + i, k === "piu_municipi" && tags.length > 1 ? `${l} (${tags.map(t => ROMANI[t]).join(", ")})` : l);
  }));
  return out;
}

const sum = (rs: Rec[]) => rs.reduce((s, x) => s + (x.v ?? 0), 0);
const STATI: { key: string | null; label: string; c: string }[] = [
  { key: "In corso", label: "In corso", c: "var(--c1)" },
  { key: "Concluso", label: "Concluso", c: "var(--c2)" },
  { key: null, label: "Stato non indicato", c: "var(--c-na)" },
];
const statoOf = (r: any) => STATI.find(s => s.key === r.stato) || STATI[2];
const progetti = (n: number) => `${fInt.format(n)} ${n === 1 ? "progetto" : "progetti"}`;

/* ---------- date: solo "dal G mese AAAA al G mese AAAA" scritto nella scheda ---------- */
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const RX_PER = /^dal (\d{1,2}) (\p{L}+) (\d{4}) al (\d{1,2}) (\p{L}+) (\d{4})$/u;
export function periodo(s: any): { inizio: [number, number]; fine: [number, number] } | null {
  const m = RX_PER.exec(String(s || "").trim()); if (!m) return null;
  const mi = MESI.indexOf(m[2].toLowerCase()), mf = MESI.indexOf(m[5].toLowerCase());
  if (mi < 0 || mf < 0) return null;
  return { inizio: [+m[3], Math.floor(mi / 3) + 1], fine: [+m[6], Math.floor(mf / 3) + 1] };
}

/* riga della fonte: in pagina ente, pagina del programma e data di lettura; dettagli nell'icona info */
function fonte(prog: Programma, extra?: string) {
  const f = P.fonte || {}, url = safeUrl(f.pagine_programma?.[prog]) || safeUrl(f.url);
  const det = [`<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}</p>`, `<p>${esc(P.periodo || "")}</p>`];
  if (extra) det.push(`<p>${esc(extra)}</p>`);
  det.push(`<p>Scaricato il ${dateIt(P.verificato)}.</p>`, `<p><a href="${R.fonti}">Limiti di questi dati</a></p>`);
  return `<p class="src fonte keep"><span>Fonte: ${esc(f.ente || "Roma Capitale")}, pagine progetti ${url ? aLink(url, prog) : esc(prog)}, ${esc(LETTO)}</span>${info(det.join(""), "fonte")}</p>`;
}
const NON_PAG = "Sono fondi del programma assegnati, non pagamenti.";

/* ======================= pagina ======================= */
export function htmlFondo(prog: Programma) {
  if (!P) return `<div class="hero"><h1>${esc(prog)}</h1></div>` + `<div class="panel"><p class="na-note">Progetti: dato non disponibile in questa versione.</p></div>`;
  const rs = records(prog);
  const tot = sum(rs), nNull = rs.filter(x => x.v === null).length;
  const byArea = (k: string) => rs.filter(x => x.area === k);
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
  const parti = [...gr.filter(g => g.v > 0).map(g => ({ label: g.l, v: g.v, n: g.n })),
    ...[...mun].filter(m => m.v > 0).sort((a, b) => b.v - a.v).map(m => ({ label: "Municipio " + ROMANI[m.id], v: m.v, n: m.n }))];
  const keep = parti.slice(0, 5), rest = parti.slice(5);
  const slices = keep.map((s, i) => ({ ...s, c: `var(--c${i + 1})`, nota: progetti(s.n) }));
  if (rest.length) { const n = rest.reduce((s, x) => s + x.n, 0); slices.push({ label: `Altri ${rest.length} municipi`, v: rest.reduce((s, x) => s + x.v, 0), n, c: "var(--c-na)", nota: progetti(n) }); }
  const refA = Math.max(0, ...mun.map(m => m.v), ...gr.map(g => g.v));
  const areeTab = datiTab(["Dove", "Progetti", "Fondi del programma", "Quota"], [
    ...mun.map(m => [`<td data-v="${m.id}"><a href="${R.mun(m.id)}">Municipio ${ROMANI[m.id]}</a></td>`, td(m.n, "int"), td(m.v, "eur", refA), `<td class="num" data-v="${tot ? m.v / tot * 100 : ""}">${pct(m.v, tot)}</td>`]),
    ...gr.map((g, i) => [`<td data-v="${16 + i}">${esc(g.l)}</td>`, td(g.n, "int"), td(g.v, "eur", refA), `<td class="num" data-v="${tot ? g.v / tot * 100 : ""}">${pct(g.v, tot)}</td>`]),
  ]);
  const blkDonut = `<section class="block"><div class="head"><div><h2>Dove vanno i fondi</h2><p>Quota dei fondi del programma per luogo del progetto. I progetti su più municipi, intermunicipali o senza municipio indicato restano a parte: i loro importi non sono divisi tra i municipi. Le fette sono al massimo sei; i municipi più piccoli sono raccolti in una sola.</p></div></div>
    <div class="panel">${donut(slices, tot, `Ciambella: fondi ${prog} per luogo`)}${nota(NON_PAG + " Un progetto su più municipi non è diviso tra i municipi.")}${areeTab}</div>${fonte(prog)}</section>`;

  /* --- colonne per municipio: totale e per abitante --- */
  const rowsTot = mun.map(m => ({ label: ROMANI[m.id], tip: `Municipio ${ROMANI[m.id]}: ${fmt(m.v, "eur")} (${progetti(m.n)}${m.nNull ? `, ${m.nNull} senza importo` : ""})`, segs: [{ v: m.v, c: "var(--data)" }] }));
  const ab = (m: typeof mun[number]) => (isNum(m.pop) && m.pop > 0 ? m.v / m.pop : null);
  const rowsAb = mun.map(m => ({ label: ROMANI[m.id], tip: `Municipio ${ROMANI[m.id]}: ${fmt(ab(m), "eur_ab")} per abitante`, segs: [{ v: ab(m), c: "var(--data)" }] }));
  const munTab = datiTab(["Municipio", "Progetti", "Fondi del programma", "Residenti", "Per abitante"],
    mun.map(m => [`<td data-v="${m.id}"><a href="${R.mun(m.id)}">Municipio ${ROMANI[m.id]}</a></td>`, td(m.n, "int"), td(m.v, "eur", Math.max(...mun.map(x => x.v))), td(m.pop, "int"), td(ab(m), "eur_ab")]));
  const blkCol = `<section class="block"><div class="head"><div><h2>Fondi per municipio</h2><p>Solo i progetti collocati in un municipio. Il valore per abitante divide i fondi per i residenti al 31/12/2025 (Annuario statistico 2025 di Roma Capitale, Tab. 1.2). I progetti sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio.</p></div></div>
    <div class="grid g2">
      <div class="panel"><h3>In totale</h3>${colChart({ rows: rowsTot, unit: "eur", aria: `Colonne: fondi ${prog} per municipio`, stagger: true })}${nota(NON_PAG)}</div>
      <div class="panel"><h3>Per abitante</h3>${colChart({ rows: rowsAb, unit: "eur_ab", aria: `Colonne: fondi ${prog} per abitante, per municipio`, stagger: true })}${nota("Fondi del municipio diviso per i residenti. " + NON_PAG)}</div>
    </div><div class="panel" style="margin-top:14px">${munTab}</div>${fonte(prog, "Residenti: " + POP_SRC + ".")}</section>`;

  /* --- colonne impilate per stato --- */
  const conta = (l: Rec[], s: typeof STATI[number]) => l.filter(x => statoOf(x.r) === s).length;
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
  let blkTempo: string;
  if (rs.length && per.length / rs.length >= 0.5) {
    const key = (q: [number, number]) => q[0] * 4 + q[1] - 1;
    const ks = per.flatMap(o => [key(o.p!.inizio), key(o.p!.fine)]), k0 = Math.min(...ks), k1 = Math.max(...ks);
    const qs = Array.from({ length: k1 - k0 + 1 }, (_, i) => k0 + i), qLab = (k: number) => `T${(k % 4) + 1} ${Math.floor(k / 4)}`;
    const serie = (which: "inizio" | "fine") => qs.map(k => {
      const l = per.filter(o => key(o.p![which]) === k).map(o => o.x);
      return { label: k % 4 === 0 || k === k0 ? String(Math.floor(k / 4)) : "", tip: `${qLab(k)}: ${progetti(l.length)}${l.length ? ` (${STATI.map(s => `${s.label.toLowerCase()} ${conta(l, s)}`).join(", ")})` : ""}`, segs: STATI.map(s => ({ v: conta(l, s), c: s.c })), l };
    });
    const fine = serie("fine"), ini = serie("inizio");
    const tempoTab = datiTab(["Trimestre", "Progetti che iniziano", "Progetti con fine prevista", "Fondi con fine prevista"],
      qs.map((k, i) => [`<td data-v="${k}">${qLab(k)}</td>`, td(ini[i].l.length, "int"), td(fine[i].l.length, "int"), td(sum(fine[i].l), "eur", Math.max(...fine.map(f => sum(f.l))))]));
    blkTempo = `<section class="block"><div class="head"><div><h2>Quando</h2><p>Progetti per trimestre, secondo il periodo di attuazione scritto nella scheda (dal giorno di inizio al giorno di fine prevista). È il calendario previsto, non la data effettiva di chiusura. ${per.length < rs.length ? `${rs.length - per.length} schede senza periodo leggibile non sono nel grafico.` : `Tutte le ${rs.length} schede indicano il periodo.`}</p></div>
      <div class="seg" role="group" aria-label="Data da mostrare"><button type="button" data-vista="fine" aria-pressed="true">Fine prevista</button><button type="button" data-vista="inizio" aria-pressed="false">Inizio</button></div></div>
      <div class="panel">${legend(STATI)}<div data-pannello="fine">${colChart({ rows: fine, unit: "int", aria: `Colonne impilate: progetti ${prog} per trimestre di fine prevista` })}</div>
      <div data-pannello="inizio" hidden>${colChart({ rows: ini, unit: "int", aria: `Colonne impilate: progetti ${prog} per trimestre di inizio` })}</div>
      ${nota("Ogni colonna è un trimestre; sotto è scritto l'anno del primo trimestre. Lo stato è quello della scheda.")}${tempoTab}</div>${fonte(prog)}</section>`;
  } else {
    blkTempo = `<section class="block"><div class="head"><div><h2>Quando</h2></div></div>
      <div class="panel"><p class="na-note">Calendario: dato non disponibile. ${fInt.format(rs.length - per.length)} schede su ${fInt.format(rs.length)} non indicano il periodo di attuazione (il campo Periodo è vuoto), quindi un grafico nel tempo non sarebbe rappresentativo. Le date non vengono stimate.</p></div>${fonte(prog)}</section>`;
  }

  /* --- classifica dei 15 progetti con più fondi --- */
  const top = rs.filter(x => x.v !== null).sort((a, b) => b.v! - a.v!).slice(0, 15);
  const blkTop = `<section class="block"><div class="head"><div><h2>I 15 progetti con più fondi</h2><p>Ordinati per fondi del programma. Il link apre la scheda ufficiale di Roma Capitale.</p></div></div>
    <div class="panel">${ranking(top.map(x => ({ titolo: x.r.titolo, meta: `${x.luogo} · ${statoOf(x.r).label}`, v: x.v!, href: safeUrl(x.r.link), tip: `${x.r.titolo}: ${fmt(x.v, "eur_exact")}` })))}
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
export const wireFondo = wireGrafici;
