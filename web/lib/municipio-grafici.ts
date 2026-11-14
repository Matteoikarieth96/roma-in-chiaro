/* Grafici della scheda municipio. Stessi pezzi delle pagine PNRR e Giubileo (lib/grafici.ts).
   Legge solo gli snapshot in data/snapshot (via engine.D): bilancio_peg_2026, appalti_anac, progetti,
   nidi, profilo_annuario e storico (serie 2016-2025 copiate dalla cartella di verifica con le loro conferme).
   Regole: nessuna stima; un valore mancante resta "non disponibile" e non entra nei grafici né nelle somme;
   ogni grafico dice cosa misura e cosa no, e ha la riga della fonte con periodo e data di lettura.
   Unico punto di contatto con il resto del sito: graficiMunicipio(), chiamata da htmlMunicipio (lib/pages.ts). */
import { A, D, IDS, ROMANI, dateIt, esc, f1, fInt, fmt, fonteHtml, info, isNum, metric, safeUrl } from "./engine";
import { R } from "./routes";
import { colChart, datiTab, donut, legend, lineChart, nota, pct, ranking, stackBars, td, type Slice } from "./grafici";
import { periodo } from "./fondi";

const POP = (id: string) => A?.municipi[id]?.popolazione;
const S = D.storico;
const ser = (id: string, k: string): { valori: Record<string, number>; conferma: Record<string, string> } | undefined => S?.municipi?.[id]?.[k];

/* ---------- riga della fonte: testo breve in pagina (con periodo e data), dettagli nell'icona info ---------- */
function fonti(items: { snap: string; testo: string; extra?: string }[]) {
  const ok = items.filter(x => D[x.snap]);
  if (!ok.length) return "";
  /* la serie storica non è scaricata in un giorno solo: si scrive la data in cui è stata compilata */
  const quando = (x: { snap: string }) => `${x.snap === "storico" ? "serie compilata" : "dati letti"} il ${dateIt(D[x.snap].verificato)}`;
  const dates = [...new Set(ok.map(quando))];
  const vis = ok.map(x => esc(x.testo) + (dates.length > 1 ? ` (${quando(x)})` : "")).join("; ");
  const det = ok.map(x => { const s = D[x.snap], f = s.fonte || {};
    return `<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}.${x.extra ? " " + esc(x.extra) : ""} ${x.snap === "storico" ? "Serie compilata" : "Scaricato"} il ${dateIt(s.verificato)}.</p>`; }).join("");
  return `<p class="src fonte keep"><span>Fonte: ${vis}${dates.length === 1 ? `, ${dates[0]}` : ""}</span>${info(det + `<p><a href="${R.fonti}">Limiti di questi dati</a></p>`, "fonte")}</p>`;
}
const sez = (h2: string, intro: string, body: string, src: string) => `<section class="block mg"><div class="head"><div><h2>${esc(h2)}</h2><p>${esc(intro)}</p></div></div>${body}${src}</section>`;
const na = (t: string) => `<p class="na-note">${esc(t)}</p>`;
const cella = (t: string, v?: number | string) => `<td class="num"${v !== undefined ? ` data-v="${v}"` : ""}>${esc(t)}</td>`;

/* ======================= il municipio tra i 15: valori per abitante ======================= */
const CMP = [
  { m: "peg_spese", label: "Stanziamenti del PEG", per: "competenza 2026" },
  { m: "peg_correnti", label: "Spese correnti stanziate", per: "competenza 2026" },
  { m: "peg_capitale", label: "Investimenti stanziati", per: "competenza 2026" },
  { m: "anac_importo", label: "Appalti avviati", per: "CIG 2025, al netto dei doppi conteggi" },
  { m: "prog_importo", label: "Progetti con fondi straordinari", per: "elenco di Roma Capitale" },
];
function blkConfronto(id: string) {
  if (!A) return "";
  const rows = CMP.map(c => {
    const m = metric(c.m); if (!m) return null;
    const vals = IDS.map(i => { const v = m.get(i), p = POP(i); return { id: i, v: isNum(v) && isNum(p) && p > 0 ? v / p : null, tot: v, p }; });
    const ok = vals.filter(x => isNum(x.v));
    const avg = ok.length ? ok.reduce((s, x) => s + x.tot, 0) / ok.reduce((s, x) => s + x.p, 0) : null;
    const sorted = [...ok].sort((a, b) => b.v! - a.v!);
    const me = vals.find(x => x.id === id)!, pos = sorted.findIndex(x => x.id === id) + 1;
    return { ...c, vals, ok, avg, me, pos, max: sorted[0], min: sorted[sorted.length - 1] };
  }).filter(Boolean) as any[];
  if (!rows.length) return "";
  const X = (v: number, max: number) => (max > 0 ? v / max * 100 : 0).toFixed(2);
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
    r.pos ? cella(`${r.pos}° su ${r.ok.length}`, r.pos) : cella("non disponibile")]));
  return sez("Il municipio tra i 15", `Ogni riga è un importo diviso per i residenti al 31/12/2025. Il punto pieno è il Municipio ${ROMANI[id]}, i punti chiari gli altri municipi, la linea verticale la media dei 15 (la somma dei 15 municipi divisa per i loro residenti). Ogni riga ha la sua scala, da 0 al municipio più alto. Stanziamenti, appalti e progetti sono contabilità diverse: non si sommano.`,
    `<div class="panel">${leg}<div class="cmp">${body}</div>${nota("Posizione: 1° è il valore più alto. Un valore alto o basso è un segnale da approfondire, non un giudizio.")}${tab}</div>`,
    fonti([{ snap: "bilancio_peg_2026", testo: "Roma Capitale, PEG 2026-2028" }, { snap: "appalti_anac", testo: "ANAC, CIG 2025" }, { snap: "progetti", testo: "Roma Capitale, pagine progetti" }, { snap: "profilo_annuario", testo: "residenti al 31/12/2025, Annuario 2025, Tab. 1.2" }]));
}

/* ======================= bilancio: per cosa (missioni) ======================= */
const MISS: [string, string, string][] = [["04", "Istruzione", "var(--c1)"], ["12", "Politiche sociali e famiglia", "var(--c2)"], ["01", "Servizi generali e di gestione", "var(--c3)"], ["10", "Trasporti e mobilità", "var(--c4)"]];
function blkMissioni(id: string) {
  const s = D.bilancio_peg_2026?.municipi[id]?.spese; if (!s) return "";
  const ms = (s.per_missione || []).filter((x: any) => isNum(x.competenza_2026));
  const tot = ms.reduce((a: number, x: any) => a + x.competenza_2026, 0);
  if (!(tot > 0)) return "";
  const slices: Slice[] = MISS.map(([c, l, col]) => ({ label: l, v: ms.find((x: any) => x.codice === c)?.competenza_2026 || 0, c: col })).filter(x => x.v > 0);
  const rest = ms.filter((x: any) => !MISS.some(([c]) => c === x.codice) && x.competenza_2026 > 0);
  if (rest.length) slices.push({ label: `Altre ${rest.length} missioni`, v: rest.reduce((a: number, x: any) => a + x.competenza_2026, 0), c: "var(--c-na)" });
  const diff = Math.abs(tot - s.competenza_2026) > 1;
  const tab = datiTab(["Missione", "Competenza 2026", "Quota"], [...ms].sort((a: any, b: any) => b.competenza_2026 - a.competenza_2026)
    .map((x: any) => [`<td>${esc(x.codice)} ${esc(x.nome)}</td>`, td(x.competenza_2026, "eur", tot), `<td class="num" data-v="${x.competenza_2026 / tot * 100}">${pct(x.competenza_2026, tot)}</td>`]));
  return sez("Per cosa spende il municipio", "Quota degli stanziamenti 2026 per missione, cioè la grande area di spesa del bilancio pubblico. Le quattro missioni con un colore proprio sono le stesse in tutte le schede; le altre sono raccolte in una sola fetta. Sono stanziamenti previsti ad aprile 2026, non pagamenti.",
    `<div class="panel">${donut(slices, tot, `Ciambella: stanziamenti 2026 del Municipio ${ROMANI[id]} per missione`)}${nota("Stanziamenti di competenza 2026, non pagamenti." + (diff ? ` La somma delle missioni (${fmt(tot, "eur")}) non coincide con il totale stampato (${fmt(s.competenza_2026, "eur")}).` : ""))}${tab}</div>`,
    fonti([{ snap: "bilancio_peg_2026", testo: "Roma Capitale, PEG 2026-2028, Allegato A, competenza 2026" }]));
}

/* ======================= bilancio: negli anni e nei prossimi anni ======================= */
const TIT = [{ label: "Spese correnti", c: "var(--c1)" }, { label: "Investimenti (conto capitale)", c: "var(--c2)" }, { label: "Altre spese (conto terzi e partite di giro)", c: "var(--c-na)" }];
function blkBilancioAnni(id: string) {
  const s = D.bilancio_peg_2026?.municipi[id]?.spese; if (!s) return "";
  /* previsioni: PEG 2026-2028, per titolo */
  const tit = s.per_titolo || [], get = (c: string, y: string) => tit.find((t: any) => t.codice === c)?.["competenza_" + y];
  const altre = (y: string) => { const l = tit.filter((t: any) => t.codice !== "U.1" && t.codice !== "U.2").map((t: any) => t["competenza_" + y]); return l.length && l.every(isNum) ? l.reduce((a: number, b: number) => a + b, 0) : null; };
  const YP = ["2026", "2027", "2028"];
  const prev = YP.map(y => ({ y, c: get("U.1", y), k: get("U.2", y), a: altre(y), t: s["competenza_" + y] }));
  const tipP = (r: typeof prev[number]) => `${r.y}: ${fmt(r.t, "eur")} (correnti ${fmt(r.c, "eur")}, investimenti ${fmt(r.k, "eur")}${isNum(r.a) && r.a > 0 ? `, altre ${fmt(r.a, "eur")}` : ""})`;
  const chPrev = colChart({ rows: prev.map(r => ({ label: r.y, tip: tipP(r), segs: [{ v: r.c, c: TIT[0].c }, { v: r.k, c: TIT[1].c }, { v: r.a, c: TIT[2].c }] })), unit: "eur", aria: `Colonne impilate: stanziamenti previsti 2026-2028 del Municipio ${ROMANI[id]}` });
  const ref = Math.max(...prev.map(r => r.t).filter(isNum));
  const tabPrev = datiTab(["Anno", "Spese correnti", "Investimenti", "Altre spese", "Totale"], prev.map(r => [`<td data-v="${r.y}">${r.y}</td>`, td(r.c, "eur", ref), td(r.k, "eur", ref), td(r.a, "eur", ref), td(r.t, "eur", ref)]));

  /* negli anni: PEG di ogni anno, dalla serie controllata (solo anni confermati) */
  const tot = ser(id, "peg_totale"), u1 = ser(id, "peg_correnti"), u2 = ser(id, "peg_capitale");
  let storia = "";
  if (tot && u1 && u2) {
    const ys = Object.keys(tot.valori).sort();
    const rows = ys.map(y => { const t = tot.valori[y], c = u1.valori[y], k = u2.valori[y];
      const a = isNum(t) && isNum(c) && isNum(k) && t - c - k > -0.5 ? Math.max(0, Math.round((t - c - k) * 100) / 100) : null;
      return { y, t, c, k, a, conf: tot.conferma[y] }; });
    const refS = Math.max(...rows.map(r => r.t).filter(isNum));
    storia = `<div class="panel"><h3>Negli anni: il PEG di ogni anno</h3>${legend(TIT)}${colChart({ rows: rows.map(r => ({ label: r.y + (r.y === "2024" ? "*" : ""), tip: `${r.y}${r.y === "2024" ? " (PEG aggiornato a dicembre)" : ""}: ${fmt(r.t, "eur")} (correnti ${fmt(r.c, "eur")}, investimenti ${fmt(r.k, "eur")})`, segs: [{ v: r.c, c: TIT[0].c }, { v: r.k, c: TIT[1].c }, { v: r.a, c: TIT[2].c }] })), unit: "eur", aria: `Colonne impilate: stanziamenti del PEG 2023-2026 del Municipio ${ROMANI[id]}` })}
      ${nota("Ogni colonna è la competenza dell'anno scritta nel PEG di quell'anno. *2024: PEG aggiornato a dicembre (DGC 510/2024), non quello iniziale, quindi più alto. Gli anni prima del 2023 non sono mostrati: una sola tabella, e fino al 2019 un metodo diverso.")}
      ${datiTab(["Anno", "Spese correnti", "Investimenti", "Altre spese", "Totale", "Controllo"], rows.map(r => [`<td data-v="${r.y}">${r.y}</td>`, td(r.c, "eur", refS), td(r.k, "eur", refS), td(r.a, "eur", refS), td(r.t, "eur", refS), `<td><small>${esc(r.conf || "")}</small></td>`]))}</div>`;
  } else storia = `<div class="panel"><h3>Negli anni: il PEG di ogni anno</h3>${na("Serie storica: dato non disponibile in questa versione.")}</div>`;

  return sez("Il bilancio negli anni", "Stanziamenti di spesa del municipio per anno, divisi tra spese correnti (personale, servizi, contributi), investimenti (opere e manutenzioni straordinarie) e altre spese (conto terzi e partite di giro). A sinistra quanto ha previsto il PEG di ogni anno; a destra quanto prevede il PEG 2026-2028 per i prossimi due anni. Sono previsioni di spesa, non pagamenti.",
    `<div class="grid g2">${storia}
    <div class="panel"><h3>Prossimi anni: il PEG 2026-2028</h3>${legend(TIT)}${chPrev}${nota("Il calo nel 2027 e 2028 è normale: gli investimenti vengono iscritti anno per anno. Non è una previsione di quanto il municipio spenderà.")}${tabPrev}</div></div>`,
    fonti([{ snap: "storico", testo: "PEG di Roma Capitale 2023-2026", extra: "Valori confermati da due tabelle o due letture dello stesso atto." }, { snap: "bilancio_peg_2026", testo: "PEG 2026-2028, competenza 2026, 2027 e 2028" }]));
}

/* ======================= appalti ======================= */
const PROC: Record<string, [string, string]> = { affidamento_diretto: ["Affidamento diretto", "var(--c1)"], adesione_accordo_quadro: ["Accordo quadro o convenzione", "var(--c2)"], procedura_aperta_ristretta: ["Procedura aperta o ristretta", "var(--c3)"], procedura_negoziata: ["Procedura negoziata", "var(--c4)"], altro: ["Altre procedure o non indicata", "var(--c-na)"] };
function blkAppalti(id: string) {
  const a = D.appalti_anac?.municipi[id]?.["2025"]; if (!a) return "";
  const cl = (a.per_scelta_contraente || []) as any[];
  const sl = (k: "importo" | "n_cig"): Slice[] => cl.filter(x => isNum(x[k]) && x[k] > 0).map(x => ({ label: PROC[x.classe]?.[0] || x.etichetta, v: x[k], c: PROC[x.classe]?.[1] || "var(--c-na)", nota: k === "importo" ? `${fInt.format(x.n_cig)} CIG` : fmt(x.importo, "eur") }));
  const totI = cl.reduce((s, x) => s + (isNum(x.importo) ? x.importo : 0), 0), totN = cl.reduce((s, x) => s + (isNum(x.n_cig) ? x.n_cig : 0), 0);
  const dn = `<div class="panel"><div class="mg-h"><h3>Come è scelto il contraente (2025)</h3><div class="seg" role="group" aria-label="Misura da mostrare"><button type="button" data-vista="importo" aria-pressed="true">Importo</button><button type="button" data-vista="numero" aria-pressed="false">Numero di CIG</button></div></div>
    <div data-pannello="importo">${donut(sl("importo"), totI, `Ciambella: importo dei CIG 2025 del Municipio ${ROMANI[id]} per procedura`)}</div>
    <div data-pannello="numero" hidden>${donut(sl("n_cig"), totN, `Ciambella: numero di CIG 2025 del Municipio ${ROMANI[id]} per procedura`, "int")}</div>
    ${nota("Importo lordo, prima di togliere i doppi conteggi. Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria: una quota alta non è da sola un'anomalia.")}
    ${datiTab(["Procedura", "CIG", "Quota CIG", "Importo", "Quota importo"], cl.map(x => [`<td>${esc(x.etichetta)}</td>`, td(x.n_cig, "int"), `<td class="num" data-v="${totN ? x.n_cig / totN * 100 : ""}">${pct(x.n_cig, totN)}</td>`, td(x.importo, "eur", totI), `<td class="num" data-v="${totI ? x.importo / totI * 100 : ""}">${pct(x.importo, totI)}</td>`]))}</div>`;

  const imp = ser(id, "anac_importo_netto"), nc = ser(id, "anac_n_cig");
  let storia: string;
  if (imp) {
    const ys = Object.keys(imp.valori).sort(), ref = Math.max(...ys.map(y => imp.valori[y]));
    storia = `<div class="panel"><h3>Negli anni: importo dei CIG avviati</h3>${colChart({ rows: ys.map(y => ({ label: y, tip: `${y}: ${fmt(imp.valori[y], "eur")}${isNum(nc?.valori[y]) ? ` (${fInt.format(nc!.valori[y])} CIG)` : ""}`, segs: [{ v: imp.valori[y], c: "var(--data)" }] })), unit: "eur", aria: `Colonne: importo dei CIG avviati dal Municipio ${ROMANI[id]}, 2016-2025`, stagger: true })}
      ${nota(`Importo al netto dei doppi conteggi, per anno di pubblicazione del CIG. Fino al 2023 i file ANAC non hanno gli SmartCIG (contratti sotto 40.000 euro): il numero di CIG è mostrato solo per il 2024 e il 2025${isNum(nc?.valori["2024"]) && isNum(nc?.valori["2025"]) ? ` (${fInt.format(nc!.valori["2024"])} e ${fInt.format(nc!.valori["2025"])})` : ""}.`)}
      ${datiTab(["Anno", "Importo dei CIG", "Numero di CIG", "Controllo"], ys.map(y => [`<td data-v="${y}">${y}</td>`, td(imp.valori[y], "eur", ref), isNum(nc?.valori[y]) ? td(nc!.valori[y], "int") : `<td class="num" data-v="">non confrontabile</td>`, `<td><small>${esc(imp.conferma[y] || "")}</small></td>`]))}</div>`;
  } else storia = `<div class="panel"><h3>Negli anni: importo dei CIG avviati</h3>${na("Serie storica: dato non disponibile in questa versione.")}</div>`;

  return sez("Gli appalti in grafici", "Gare e affidamenti registrati su ANAC dagli uffici del municipio. È il valore a base di gara o di affidamento, non quanto è stato pagato, e può coprire più anni. Non comprende gli appalti dei dipartimenti centrali sul territorio del municipio.",
    `<div class="grid g2">${dn}${storia}</div>`,
    fonti([{ snap: "appalti_anac", testo: "ANAC, CIG pubblicati nel 2025" }, { snap: "storico", testo: "ANAC, CIG 2016-2025", extra: "Una sola fonte (ANAC); attribuzione ai municipi controllata con gli oggetti e, per il 2016-2020, con i file L.190 di Roma Capitale." }]));
}

/* ======================= progetti ======================= */
const STATI = [{ key: "In corso", label: "In corso", c: "var(--c1)" }, { key: "Concluso", label: "Concluso", c: "var(--c2)" }, { key: null as string | null, label: "Stato non indicato", c: "var(--c-na)" }];
const statoOf = (r: any) => STATI.find(s => s.key === r.stato) || STATI[2];
const nProg = (n: number) => `${fInt.format(n)} ${n === 1 ? "progetto" : "progetti"}`;
function blkProgetti(id: string) {
  const m = D.progetti?.municipi[id]; if (!m) return "";
  const rs = (m.progetti || []).filter((r: any) => r.contato_nel_totale) as any[];
  if (!rs.length) return sez("I progetti in grafici", "Progetti con fondi straordinari collocati nel municipio.", `<div class="panel">${na("Nessun progetto collocato in questo municipio nell'elenco di Roma Capitale.")}</div>`, fonti([{ snap: "progetti", testo: "Roma Capitale, pagine progetti" }]));
  const conta = (l: any[], s: typeof STATI[number]) => l.filter(r => statoOf(r) === s).length;
  const progs = [...new Set(rs.map(r => r.programma as string))].map(p => ({ p, l: rs.filter(r => r.programma === p) })).sort((a, b) => b.l.length - a.l.length);
  const bars = stackBars(progs.map(g => ({ label: g.p, tip: `${g.p}: ${nProg(g.l.length)} (${STATI.map(s => `${s.label.toLowerCase()} ${conta(g.l, s)}`).join(", ")})`, segs: STATI.map(s => ({ v: conta(g.l, s), c: s.c })) })), "int", `Barre impilate: progetti del Municipio ${ROMANI[id]} per programma e stato`);
  const tabP = datiTab(["Programma", ...STATI.map(s => s.label), "Totale", "Fondi del programma"], progs.map(g => { const v = g.l.filter(r => isNum(r.importo_programma_euro)); const somma = v.reduce((s, r) => s + r.importo_programma_euro, 0);
    return [`<td>${esc(g.p)}</td>`, ...STATI.map(s => td(conta(g.l, s), "int")), td(g.l.length, "int"), v.length ? `<td class="num" data-v="${somma}">${fmt(somma, "eur")}${v.length < g.l.length ? `<br><small>${g.l.length - v.length} senza importo</small>` : ""}</td>` : td(null, "eur")]; }));

  /* quando: anno di fine prevista scritto nella scheda */
  const per = rs.map(r => ({ r, p: periodo(r.periodo) })).filter(o => o.p);
  let quando: string;
  if (per.length / rs.length >= 0.5) {
    const ys = per.map(o => o.p!.fine[0]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const anni = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
    const rows = anni.map(y => { const l = per.filter(o => o.p!.fine[0] === y).map(o => o.r); return { y, l }; });
    quando = `<div class="panel"><h3>Quando finiscono</h3>${legend(STATI)}${colChart({ rows: rows.map(x => ({ label: String(x.y), tip: `${x.y}: ${nProg(x.l.length)} con fine prevista${x.l.length ? ` (${STATI.map(s => `${s.label.toLowerCase()} ${conta(x.l, s)}`).join(", ")})` : ""}`, segs: STATI.map(s => ({ v: conta(x.l, s), c: s.c })) })), unit: "int", aria: `Colonne impilate: progetti del Municipio ${ROMANI[id]} per anno di fine prevista` })}
      ${nota(`Anno di fine prevista scritto nella scheda (campo Periodo): è il calendario previsto, non la data effettiva di chiusura. ${per.length < rs.length ? `${rs.length - per.length} ${rs.length - per.length === 1 ? "scheda" : "schede"} su ${rs.length} senza periodo leggibile non sono nel grafico.` : `Tutte le ${rs.length} schede indicano il periodo.`}`)}
      ${datiTab(["Anno di fine prevista", ...STATI.map(s => s.label), "Totale"], rows.map(x => [`<td data-v="${x.y}">${x.y}</td>`, ...STATI.map(s => td(conta(x.l, s), "int")), td(x.l.length, "int")]))}</div>`;
  } else quando = `<div class="panel"><h3>Quando finiscono</h3>${na(`Calendario: dato non disponibile. ${rs.length - per.length} schede su ${rs.length} non indicano il periodo di attuazione, quindi un grafico nel tempo non sarebbe rappresentativo. Le date non vengono stimate.`)}</div>`;

  const conImp = rs.filter(r => isNum(r.importo_programma_euro)).sort((a, b) => b.importo_programma_euro - a.importo_programma_euro);
  const top = conImp.slice(0, 10);
  const rk = top.length ? ranking(top.map(r => ({ titolo: r.titolo, meta: `${r.programma} · ${statoOf(r).label}`, v: r.importo_programma_euro, href: safeUrl(r.link), tip: `${r.titolo}: ${fmt(r.importo_programma_euro, "eur_exact")}` }))) : na("Importi: dato non disponibile.");
  const senza = rs.length - conImp.length;

  return sez("I progetti in grafici", "Progetti PNRR, Giubileo 2025 e altri fondi straordinari collocati nel municipio, come scritto nelle schede di Roma Capitale. Li gestiscono per lo più i dipartimenti di Roma Capitale, non il municipio. Un CUP ripetuto con lo stesso importo è contato una volta. I progetti su più municipi o su tutta la città non sono qui: sono nelle pagine PNRR e Giubileo 2025.",
    `<div class="grid g2"><div class="panel"><h3>Per programma e stato</h3>${legend(STATI)}${bars}${nota("Conta i progetti, non i fondi. Lo stato è quello scritto nella scheda e può non essere aggiornato.")}${tabP}</div>${quando}</div>
    <div class="panel" style="margin-top:14px"><h3>${top.length < conImp.length ? `I ${top.length} progetti con più fondi` : top.length === 1 ? "Il progetto con importo" : `I ${top.length} progetti, per fondi`}</h3>${rk}${nota(`Fondi del programma assegnati, non pagamenti. Il link apre la scheda ufficiale.${senza ? ` ${senza} ${senza === 1 ? "progetto" : "progetti"} senza importo del programma ${senza === 1 ? "non è" : "non sono"} in classifica.` : ""}`)}</div>`,
    fonti([{ snap: "progetti", testo: "Roma Capitale, pagine progetti PNRR e altri fondi straordinari" }]));
}

/* ======================= nidi negli anni ======================= */
function blkNidi(id: string) {
  const m = D.nidi?.municipi[id], ss = m?.serie_storica; if (!ss) return "";
  const ys = Object.keys(ss).sort();
  /* iscritti che due pubblicazioni riportano diversi (Annuario contro file della Dashboard): non confermati, fuori dalla linea */
  const disc = (S?.discordanze || []).filter((d: any) => d.indicatore === "nidi_iscritti" && d.municipio === id && !/conferma/.test(d.nota || ""));
  const dOf = (y: string) => disc.find((d: any) => d.anno.replace("/", "-") === y);
  const val = (y: string, k: string) => { const v = ss[y]?.[k]; return isNum(v) && !(k === "iscritti" && dOf(y)) ? v : null; };
  const SER = [{ k: "posti", label: "Posti", c: "var(--c1)" }, { k: "iscritti", label: "Iscritti", c: "var(--c2)" }, { k: "domande_valide", label: "Domande valide", c: "var(--c3)" }];
  const lab = (y: string) => y.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1/$2");
  const ch = lineChart({ x: ys.map(lab), every: 2, unit: "int", asse: "numero di posti, bambini o domande",
    tips: ys.map(y => `${lab(y)}: ${SER.map(s => `${s.label.toLowerCase()} ${isNum(val(y, s.k)) ? fInt.format(val(y, s.k)!) : "non disponibile"}`).join(", ")}`),
    series: SER.map(s => ({ label: s.label, c: s.c, vals: ys.map(y => val(y, s.k)) })), aria: `Linee: posti, iscritti e domande valide nei nidi del Municipio ${ROMANI[id]}, dal ${lab(ys[0])} al ${lab(ys[ys.length - 1])}` });
  const tab = datiTab(["Anno educativo", ...SER.map(s => s.label), "Lista d'attesa a fine anno"], ys.map(y => [`<td data-v="${y.slice(0, 4)}">${lab(y)}</td>`,
    ...SER.map(s => { const d = s.k === "iscritti" ? dOf(y) : null; return d ? `<td class="num" data-v=""><small>non confermato: ${fInt.format(d.valore)} nel file, ${fInt.format(d.valore_seconda_fonte)} nell'Annuario</small></td>` : td(val(y, s.k), "int"); }),
    td(ss[y]?.lista_attesa_finale, "int")]));
  return sez("Asili nido negli anni", "Posti, bambini iscritti e domande valide nei nidi comunali e convenzionati del municipio, anno educativo per anno educativo. Se le domande superano i posti, una parte dei bambini resta in lista d'attesa. Il grafico non dice quanti bambini abitano nel municipio.",
    `<div class="panel">${legend(SER)}${ch}${nota(`Totale di nidi comunali e privati convenzionati: dal 2023/24 i nidi in appalto passano dai comunali ai privati, quindi la divisione tra i due non è costante.${disc.length ? ` Iscritti ${disc.map((d: any) => d.anno).join(", ")}: il file della Dashboard e l'Annuario riportano numeri diversi, quindi il punto non è nel grafico.` : ""}`)}${tab}</div>`,
    fonti([{ snap: "nidi", testo: `Roma Capitale, Dashboard Nidi 2025, anni educativi dal ${lab(ys[0])} al ${lab(ys[ys.length - 1])}` }]));
}

/* ======================= residenti negli anni ======================= */
function blkResidenti(id: string) {
  const r = ser(id, "residenti"); if (!r) return "";
  const ys = Object.keys(r.valori).sort(), ref = Math.max(...ys.map(y => r.valori[y]));
  const confini = (S.confini_cambiati || []).includes(id);
  const v0 = r.valori[ys[0]], v1 = r.valori[ys[ys.length - 1]];
  return sez("Residenti negli anni", `Persone iscritte all'anagrafe del municipio al 31 dicembre di ogni anno. È la base di tutti i valori per abitante della scheda (che usano il 2025). Non conta chi vive nel municipio senza esservi residente.`,
    `<div class="panel">${colChart({ rows: ys.map(y => ({ label: y, tip: `31/12/${y}: ${fInt.format(r.valori[y])} residenti`, segs: [{ v: r.valori[y], c: "var(--data)" }] })), unit: "int", asse: "numero di residenti", aria: `Colonne: residenti del Municipio ${ROMANI[id]} dal ${ys[0]} al ${ys[ys.length - 1]}`, stagger: true })}
    ${nota(`Dal ${ys[0]} al ${ys[ys.length - 1]}: da ${fInt.format(v0)} a ${fInt.format(v1)} residenti (${v1 >= v0 ? "+" : ""}${f1.format((v1 - v0) / v0 * 100)}%).${confini ? " " + S.nota_confini : ""}`)}
    ${datiTab(["Anno (31 dicembre)", "Residenti", "Controllo"], ys.map(y => [`<td data-v="${y}">${y}</td>`, td(r.valori[y], "int"), `<td><small>${esc(r.conferma[y] || "")}</small></td>`]))}</div>`,
    fonti([{ snap: "storico", testo: `Roma Capitale, tavole anagrafe al 31/12, ${ys[0]}-${ys[ys.length - 1]}`, extra: "Ogni anno confrontato con l'Annuario statistico: valori uguali." }]));
}

/* ======================= montaggio ======================= */
/* blocks: l'HTML dei blocchi della scheda (MUN_BLOCKS). Ogni gruppo di grafici va dopo il blocco con lo stesso tema;
   se un titolo cambia e il blocco non si trova, i grafici vanno in fondo, prima del profilo. */
const DOPO: [string, ((id: string) => string)[]][] = [
  ["Il bilancio del municipio", [blkMissioni, blkBilancioAnni]],
  ["Appalti avviati dal municipio", [blkAppalti]],
  ["Progetti sul territorio", [blkProgetti]],
  ["Asili nido", [blkNidi]],
];
export function graficiMunicipio(id: string, blocks: string[]) {
  const usati = new Set<number>();
  const out = blocks.map(b => {
    const h = /<h2>([^<]+)<\/h2>/.exec(b)?.[1];
    const i = DOPO.findIndex(([t]) => t === h);
    if (i < 0) return b;
    usati.add(i);
    return b + DOPO[i][1].map(f => f(id)).join("");
  });
  const resto = DOPO.filter((_, i) => !usati.has(i)).flatMap(([, fs]) => fs.map(f => f(id))).join("");
  return blkConfronto(id) + out.join("") + resto + blkResidenti(id);
}
