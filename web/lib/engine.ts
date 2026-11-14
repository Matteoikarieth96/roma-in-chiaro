/* Nucleo del sito: formato dei numeri, fonti, registro degli indicatori e sezioni con dati propri.
   Porting di scripts/template.html (script) e scripts/sections.js: stessa logica e stessi testi,
   cambiano solo gli indirizzi (pagine vere al posto di #/...). Nessun dato viene calcolato qui
   oltre a quanto faceva il sito statico: le pagine leggono gli snapshot così come sono.
   Finché il sito statico resta in uso, un testo cambiato in uno dei due va cambiato anche nell'altro
   (il controllo è scripts/compare-text.mjs, vedi README). */
import { D as DATA } from "../generated/snapshots";
import { R } from "./routes";

export const D: Record<string, any> = DATA;
/* Indirizzo pubblico del codice sorgente (AGPL-3.0). Vuoto finché il repository non è pubblico. */
export const REPO_URL = "https://github.com/Matteoikarieth96/roma-in-chiaro";
export const ROMANI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
export const IDS = Array.from({ length: 15 }, (_, i) => String(i + 1));
export const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
export const isNum = (v: any): v is number => typeof v === "number" && Number.isFinite(v);

/* ---------- formato (regole di DoveVannoINostriSoldi: migliaia sempre raggruppate, unità coerente in colonna) ---------- */
const NF = (min: number, max: number) => new Intl.NumberFormat("it-IT", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: "always" } as any);
export const fInt = NF(0, 0), f1 = NF(1, 1), f2 = NF(2, 2), fEur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" } as any);
/* le cifre piccole in una colonna in milioni (es. 36.027 € accanto a 50 mln) restano in euro: mai "0,0 mln" */
export function euroLike(v, ref?) {
  if (!isNum(v)) return "n.d."; const s = Math.abs(ref ?? v), a = Math.abs(v);
  if (s >= 1e9 && a >= 5e6) return f2.format(v / 1e9) + " mld €"; if (s >= 1e6 && a >= 5e4) return f1.format(v / 1e6) + " mln €"; return fEur.format(v);
}
export function fmt(v, unit?, ref?) {
  if (!isNum(v)) return "n.d.";
  switch (unit) {
    case "eur": return euroLike(v, ref);
    case "eur_exact": return fEur.format(v);
    case "eur_ab": return fEur.format(v);
    case "pct": return f1.format(v) + "%";
    case "dec": return f1.format(v);
    default: return fInt.format(v);
  }
}
function exact(v, unit) { if (!isNum(v)) return ""; return unit && unit.startsWith("eur") ? fEur.format(v) : fInt.format(v); }
export const dateIt = s => { if (!s) return "n.d."; const d = new Date(s); return isNaN(d as any) ? s : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }); };

/* ---------- icona info: il testo di approfondimento si apre passando sopra, con un tocco o con la tastiera ---------- */
const INFO_SVG = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="10" cy="6.2" r="1.05" fill="currentColor"/></svg>`;
/* html: markup già sicuro, costruito da questo modulo con esc() */
export const info = (html: string, label?: string) => `<button type="button" class="info" aria-label="${esc("Più informazioni" + (label ? ": " + label : ""))}" aria-expanded="false" aria-controls="pop" data-info="${esc(html)}">${INFO_SVG}</button>`;
export function addInfo(el: HTMLElement, html: string, label?: string) {
  const b = el.querySelector<HTMLElement>(":scope > .info, :scope > .info-g > .info"); /* .info-g: icona attaccata all'ultima parola (pages.ts) */
  if (b) b.dataset.info += html; else el.insertAdjacentHTML("beforeend", info(html, label));
}

/* ---------- fonti ---------- */
export const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "";
/* Link della fonte: fonte.link [{nome,url}] se c'è; altrimenti fonte.url, che può contenere più indirizzi separati da ";". */
function fonteLinks(f) {
  if (Array.isArray(f?.link) && f.link.length) return f.link.map(l => ({ nome: l.nome || l.url, url: safeUrl(l.url) })).filter(l => l.url);
  const urls = String(f?.url || "").split(/\s*;\s*/).map(safeUrl).filter(Boolean);
  return urls.map(u => ({ nome: urls.length > 1 ? u.replace(/^https?:\/\//, "").replace(/\/+$/, "").split("/").pop() : "", url: u }));
}
export const aLink = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
/* nome della fonte, linkato se c'è un solo indirizzo; con più indirizzi, i link seguono tra parentesi */
export function fonteHtml(f) {
  const L = fonteLinks(f);
  if (L.length === 1) return aLink(L[0].url, f.nome || L[0].nome);
  return esc(f.nome || "") + (L.length ? ` (${L.map(l => aLink(l.url, l.nome)).join(", ")})` : "");
}
/* Fonti di Roma Capitale: base giuridica del riuso, se lo snapshot non la riporta già */
export const LIC_ANAC_URL = "https://creativecommons.org/licenses/by-sa/4.0/deed.it";
const LICENZA_ROMA = "Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).";
export function licenzaTesto(f) {
  const t = String(f?.licenza || "");
  if (/^Roma Capitale/.test(f?.ente || "") && !/33\/2013/.test(t)) return LICENZA_ROMA;
  return t || "non indicata";
}
/* Riga della fonte: in pagina solo l'ente; documento, periodo, data di download e limiti nell'icona info */
export function srcLine(snapId, extra?) {
  const s = D[snapId]; if (!s) return "";
  const f = s.fonte || {};
  const per = typeof s.periodo === "string" ? s.periodo : "";
  const det = [`<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}</p>`];
  if (extra) det.push(`<p>${esc(extra)}</p>`); else if (per) det.push(`<p>${esc(per)}</p>`);
  if (s.verificato) det.push(`<p>Scaricato il ${dateIt(s.verificato)}.</p>`);
  det.push(`<p><a href="${R.fonti}">Limiti di questi dati</a></p>`);
  return `<p class="src fonte">Fonte: ${esc(f.ente || f.nome || "dettagli")}${info(det.join(""), "fonte")}</p>`;
}
export const naBlock = what => `<div class="panel"><p class="na-note">${esc(what)}: dato non disponibile in questa versione.</p></div>`;

/* ---------- indicatori (registro unico usato da mappa, schede e confronto) ---------- */
export type Metric = { id: string; label: string; unit: string; group: string; snap: string; periodo?: string; src?: string; note?: string; non?: any;
  get: (id: string) => any; per?: boolean; home?: boolean; roma?: any; romaLabel?: string };
export const A = D.profilo_annuario;
export const M: Metric[] = [];
const ROMA_LABEL_DEFAULT = "Roma";
export const romaLabelOf = (m: Metric) => m.romaLabel || ROMA_LABEL_DEFAULT;
function addAnnuario(key, opts: any = {}) {
  if (!A || !A.indicatori[key]) return;
  const ind = A.indicatori[key];
  const unitMap = { "€": "eur", "%": "pct", "km²": "dec", "abitanti per km²": "int" };
  M.push({ id: "ann_" + key, label: opts.label || ind.etichetta, unit: opts.unit || unitMap[ind.unita] || "int", group: opts.group || "Profilo",
    snap: "profilo_annuario", periodo: ind.periodo, src: `${ind.tabella}, p. ${ind.pagina}`,
    note: ind.misura, non: ind.non_misura || [], get: id => A.municipi[id]?.[key],
    roma: A.roma?.[key + "__somma_municipi"] ?? A.roma?.[key],
    romaLabel: isNum(A.roma?.[key + "__somma_municipi"]) ? "somma dei municipi" : "Roma (totale)" });
}

addAnnuario("popolazione", { group: "Profilo" });
addAnnuario("superficie_kmq", { group: "Profilo" });
addAnnuario("densita_ab_kmq", { group: "Profilo" });
addAnnuario("quota_65_e_oltre_pct", { group: "Profilo" });
addAnnuario("quota_stranieri_pct", { group: "Profilo" });
addAnnuario("reddito_imponibile_medio_eur", { group: "Redditi", unit: "eur_exact" });
addAnnuario("reddito_imponibile_totale_eur", { group: "Redditi" });
addAnnuario("contribuenti", { group: "Redditi" });
addAnnuario("addizionale_comunale_totale_eur", { group: "Redditi" });
addAnnuario("addizionale_comunale_media_eur", { group: "Redditi", unit: "eur_exact" });
addAnnuario("unita_locali_attive", { group: "Imprese" });
addAnnuario("unita_locali_attive_commercio", { group: "Imprese", label: "Unità locali attive: commercio" });
addAnnuario("unita_locali_attive_alloggio_ristorazione", { group: "Imprese", label: "Unità locali attive: alloggio e ristorazione" });
addAnnuario("unita_locali_attive_costruzioni", { group: "Imprese", label: "Unità locali attive: costruzioni" });
addAnnuario("unita_locali_attive_professionali_tecniche", { group: "Imprese", label: "Unità locali attive: professioni tecniche" });
addAnnuario("asili_nido_comunali", { group: "Servizi" });
addAnnuario("nido_lista_attesa_finale", { group: "Servizi" });
addAnnuario("anziani_assistiti", { group: "Servizi" });

/* ======================= sezioni con dati propri (scripts/sections.js) =======================
   Ognuna registra indicatori (M), KPI e blocchi della scheda municipio.
   Se uno snapshot manca, la sezione non registra nulla e la pagina lo dice. */
type F0 = () => string; type F1 = (id: string) => string;
export const HERO_KPIS: F0[] = [], HOME_BLOCKS: F0[] = [], MUN_HEAD: F1[] = [], MUN_KPIS: F1[] = [], MUN_BLOCKS: F1[] = [];

/* l'Annuario ripete la lista d'attesa dei nidi: teniamo quella del file Dashboard Nidi, più completa */
{ const i = M.findIndex(m => m.id === "ann_nido_lista_attesa_finale"); if (i >= 0 && D.nidi) M.splice(i, 1); }

/* ---------------- popolazione per gli indicatori per abitante ---------------- */
const POP = id => A?.municipi[id]?.popolazione;
export const POP_SRC = "residenti al 31/12/2025, Annuario 2025 Tab. 1.2";

/* ---------------- bilancio: PEG 2026 ---------------- */
if (D.bilancio_peg_2026) {
  const B = D.bilancio_peg_2026, sp = id => B.municipi[id]?.spese;
  const tit = (s, c) => (s?.per_titolo || []).find(t => t.codice === c)?.competenza_2026;
  const mis = (s, c) => (s?.per_missione || []).find(t => t.codice === c)?.competenza_2026;
  const PER = "competenza 2026", SRC = "PEG 2026-2028, Allegato A (DGC 110/2026)";
  const ab = (base, label, opts: any = {}) => M.push({ ...base, id: base.id + "_ab", label, unit: "eur_ab", per: true, src: base.src + " / " + POP_SRC, ...opts,
    get: id => { const v = base.get(id), p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });
  const tot = { id: "peg_spese", label: "Stanziamenti di spesa del municipio", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC,
    note: B.misura, get: id => sp(id)?.competenza_2026, roma: null };
  ab(tot, "Stanziamenti di spesa per abitante", { home: true, note: "Quanto il PEG 2026 assegna ai capitoli del municipio, diviso per i residenti. Non comprende la spesa dei dipartimenti centrali sul territorio." });
  M.push(tot);
  const corr = { id: "peg_correnti", label: "Spese correnti stanziate", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC, get: id => tit(sp(id), "U.1"), roma: null };
  const cap = { id: "peg_capitale", label: "Spese in conto capitale stanziate", unit: "eur", group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, src: SRC, get: id => tit(sp(id), "U.2"), roma: null };
  M.push(corr, cap); ab(corr, "Spese correnti per abitante"); ab(cap, "Investimenti (conto capitale) per abitante");
  [["04", "Istruzione"], ["12", "Politiche sociali e famiglia"], ["10", "Strade e mobilità"], ["06", "Sport e giovani"], ["05", "Cultura"]].forEach(([c, l]) =>
    ab({ id: "peg_mis_" + c, src: SRC + ", missione " + c, group: "Bilancio", snap: "bilancio_peg_2026", periodo: PER, get: id => mis(sp(id), c) }, `${l}: stanziamenti per abitante`));

  HERO_KPIS.unshift(() => {
    const s = B.roma?.somma_15_municipi?.spese, r = B.roma?.spese;
    const m12 = s ? (tit(s, "U.1") || 0) + (tit(s, "U.2") || 0) : null, r12 = r ? (tit(r, "U.1") || 0) + (tit(r, "U.2") || 0) : null;
    return kpi("Stanziamenti 2026 dei 15 municipi", s?.competenza_2026, "eur", isNum(m12) && r12 ? `${f1.format(m12 / r12 * 100)}% delle spese correnti e d'investimento di Roma Capitale` : "", `<a href="${R.fonti}">PEG 2026-2028</a>`);
  });
  HERO_KPIS.unshift(() => kpi("Residenti", A?.roma?.popolazione, "int", "al 31/12/2025", "Annuario statistico 2025"));
  MUN_KPIS.unshift(id => { const v = sp(id)?.competenza_2026, p = POP(id);
    return kpi("Stanziamenti 2026", v, "eur", isNum(v) && p ? `${fEur.format(v / p)} per abitante` : "", "PEG 2026-2028"); });
  MUN_KPIS.unshift(id => kpi("Residenti", POP(id), "int", "al 31/12/2025", "Annuario 2025, Tab. 1.2"));

  MUN_BLOCKS.unshift(id => {
    const s = sp(id), e = B.municipi[id]?.entrate; if (!s) return "";
    const altri = s.di_cui_budget_gestito_da_altre_strutture?.competenza_2026;
    const top = (arr, n) => (arr || []).filter(x => x.competenza_2026 > 0).slice(0, n);
    return `<section class="block"><div class="head"><div><h2>Il bilancio del municipio</h2><p>Quanto il Piano esecutivo di gestione 2026 stanzia sui capitoli del municipio, e per cosa. Sono previsioni di spesa, non pagamenti.</p></div></div>
    <div class="grid g4">${kpi("Competenza 2026", s.competenza_2026, "eur", "spese che si possono impegnare nel 2026")}${kpi("Cassa 2026", s.cassa_2026, "eur", "pagamenti previsti nel 2026, anche di anni passati")}${kpi("Spese correnti", tit(s, "U.1"), "eur", "personale, servizi, contributi")}${kpi("Investimenti", tit(s, "U.2"), "eur", "opere e manutenzioni straordinarie")}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Per missione (competenza 2026)</h3>${barsList(top(s.per_missione, 10).map(x => ({ label: x.nome, v: x.competenza_2026 })), "eur")}</div>
      <div class="panel"><h3>Per tipo di spesa</h3>${barsList(top(s.per_macroaggregato, 8).map(x => ({ label: x.nome, v: x.competenza_2026 })), "eur")}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Programma</th><th class="num">Competenza 2026</th><th class="num">Cassa 2026</th><th class="num">Competenza 2027</th><th class="num">Competenza 2028</th></tr></thead><tbody>
      ${top(s.per_programma, 12).map(x => `<tr><td>${esc(x.codice)} ${esc(x.nome)}</td><td class="num">${fmt(x.competenza_2026, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.cassa_2026, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.competenza_2027, "eur", s.competenza_2026)}</td><td class="num">${fmt(x.competenza_2028, "eur", s.competenza_2026)}</td></tr>`).join("")}
      <tr class="tot"><td>Totale municipio</td><td class="num">${fmt(s.competenza_2026, "eur")}</td><td class="num">${fmt(s.cassa_2026, "eur")}</td><td class="num">${fmt(s.competenza_2027, "eur")}</td><td class="num">${fmt(s.competenza_2028, "eur")}</td></tr>
    </tbody></table></div><p class="src">I 12 programmi con più risorse. Il calo nel 2027 e 2028 è normale: gli investimenti vengono iscritti anno per anno.</p>
    ${isNum(altri) ? `<div class="caveat"><b>Da sapere.</b> ${fmt(altri, "eur")} (${f1.format(altri / s.competenza_2026 * 100)}%) di questi stanziamenti sono su capitoli del municipio ma gestiti da altre strutture, soprattutto Risorse umane (stipendi) e Scuola. Le entrate assegnate al municipio sono ${fmt(e?.competenza_2026, "eur")}.</div>` : ""}
    ${srcLine("bilancio_peg_2026", "competenza e cassa 2026, risorse al 16/04/2026")}</section>`;
  });
}
/* ---------------- appalti ANAC ---------------- */
if (D.appalti_anac) {
  const P = D.appalti_anac, Y = "2025";
  const y = (id, yr = Y) => P.municipi[id]?.[yr];
  const cls = (o, c) => (o?.per_scelta_contraente || []).find(x => x.classe === c);
  /* importo netto (lordo meno i doppi conteggi) se lo snapshot lo ha; altrimenti l'importo lordo */
  const imp = o => isNum(o?.importo_netto) ? o.importo_netto : o?.importo_totale;
  const NETTO = IDS.some(id => isNum(y(id)?.importo_netto));
  const NOTA_NETTO = NETTO ? "Importo al netto dei doppi conteggi: accordi quadro e loro contratti attuativi nello stesso periodo, gare rilanciate. " : "";
  M.push({ id: "anac_importo", label: "Appalti avviati: importo dei CIG", unit: "eur", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, CIG del centro di costo del municipio", note: NOTA_NETTO + (P.misura || ""), get: id => imp(y(id)), roma: null });
  M.push({ id: "anac_n", label: "Appalti avviati: numero di CIG", unit: "int", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, CIG del centro di costo del municipio", get: id => y(id)?.n_cig, roma: null });
  M.push({ id: "anac_importo_ab", label: "Appalti avviati per abitante", unit: "eur_ab", per: true, group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC CIG / " + POP_SRC, note: NOTA_NETTO || undefined, get: id => { const v = imp(y(id)), p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });
  /* riferimento: la somma dei 15 municipi, calcolata dai dati dei municipi (non il totale di Roma Capitale, che comprende i dipartimenti) */
  const dirSum = (() => { let d = 0, n = 0; for (const id of IDS) { const o = y(id), c = cls(o, "affidamento_diretto"); if (!o || !c) return null; d += c.n_cig; n += o.n_cig; } return n > 0 ? d / n * 100 : null; })();
  M.push({ id: "anac_diretti", label: "Quota di CIG con affidamento diretto", unit: "pct", group: "Appalti", snap: "appalti_anac", periodo: Y,
    src: "ANAC, campo scelta del contraente", get: id => { const c = cls(y(id), "affidamento_diretto"); return c ? c.quota_n * 100 : null; },
    roma: dirSum, romaLabel: "somma dei municipi",
    note: "Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria: una quota alta non è da sola un'anomalia." });

  HERO_KPIS.push(() => {
    const tot = IDS.reduce((s, id) => s + (imp(y(id)) || 0), 0), R0 = P.roma?.[Y], r = imp(R0), sm = R0?.somma_municipi || {};
    const qImp = isNum(sm.quota_importo_netto) ? sm.quota_importo_netto * 100 : (isNum(r) && r > 0 ? tot / r * 100 : null);
    const qN = isNum(sm.quota_n) ? sm.quota_n * 100 : null;
    const sub = isNum(qImp) ? `${f1.format(qImp)}% dell'importo dei CIG di Roma Capitale (${euroLike(r)})${isNum(qN) ? `; il ${f1.format(qN)}% per numero di CIG` : ""}` : "";
    return kpi("Appalti avviati dai 15 municipi nel 2025", tot, "eur", sub + (NETTO ? ". Importi al netto dei doppi conteggi." : ""), `<a href="${R.fonti}">ANAC, CIG 2025</a>`);
  });
  MUN_KPIS.push(id => kpi("Appalti avviati nel 2025", imp(y(id)), "eur", `${fmt(y(id)?.n_cig, "int")} CIG`, "ANAC"));
  MUN_BLOCKS.push(id => {
    const a = y(id), b = y(id, "2026"); if (!a) return "";
    const proc = a.per_scelta_contraente.filter(x => x.n_cig > 0);
    const sv = a.sovrapposizioni, aq = sv?.attuativi_aq, gr = sv?.gare_rilanciate;
    const parti = [aq?.importo > 0 ? `accordi quadro e loro contratti attuativi nello stesso periodo (${fmt(aq.n_cig, "int")} CIG, ${euroLike(aq.importo)})` : "",
      gr?.importo > 0 ? `gare rilanciate (${fmt(gr.n_cig, "int")} CIG, ${euroLike(gr.importo)})` : ""].filter(Boolean);
    const doppi = sv?.importo > 0 ? `<p class="src">Doppi conteggi: ${euroLike(sv.importo)} dei ${euroLike(a.importo_totale)} lordi del 2025 sono contati due volte${parti.length ? `: ${parti.join("; ")}` : ""}. Li togliamo dall'importo. I grafici sotto usano l'importo lordo.</p>` : "";
    return `<section class="block"><div class="head"><div><h2>Appalti avviati dal municipio</h2><p>Gare e affidamenti registrati su ANAC dagli uffici del municipio. È il valore a base di gara o di aggiudicazione, non quanto è stato pagato, e può coprire più anni.</p></div></div>
    <div class="grid g4">${kpi("CIG nel 2025", a.n_cig, "int")}${kpi("Importo 2025", imp(a), "eur", isNum(a.importo_netto) ? "al netto dei doppi conteggi" : "")}${kpi("CIG nel 2026", b?.n_cig, "int", "1 gennaio - 30 settembre")}${kpi("Importo 2026", imp(b), "eur", "anno non concluso" + (isNum(b?.importo_netto) ? ", al netto dei doppi conteggi" : ""))}</div>
    ${doppi}
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Come è stato scelto il contraente (2025, importo)</h3>${barsList(proc.map(x => ({ label: x.etichetta, v: x.importo })), "eur")}
        <p class="src">Per numero di CIG: ${proc.map(x => `${esc(x.etichetta.split(" (")[0])} ${f1.format(x.quota_n * 100)}%`).join(" · ")}. Sotto le soglie di legge l'affidamento diretto è la procedura ordinaria.</p></div>
      <div class="panel"><h3>Cosa si compra (2025, prime 5 categorie CPV)</h3>${barsList((a.top5_cpv_divisioni_per_importo || []).map(x => ({ label: x.etichetta, v: x.importo })), "eur")}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>CIG</th><th>Oggetto</th><th>Procedura</th><th>Data</th><th class="num">Importo</th></tr></thead><tbody>
      ${(a.top10_cig_per_importo || []).map(t => `<tr><td style="font-family:var(--mono)">${esc(t.cig)}</td><td>${esc(t.oggetto)}</td><td>${esc(String(t.scelta_contraente || "").toLowerCase())}</td><td style="white-space:nowrap">${esc(t.data_pubblicazione)}</td><td class="num">${fmt(Number(t.importo), "eur_exact")}</td></tr>`).join("")}
    </tbody></table></div><p class="src">I 10 CIG più grandi del 2025. Il sito non mostra le imprese che hanno vinto: il dataset dei CIG non le contiene.</p>
    ${srcLine("appalti_anac", "CIG con data di pubblicazione nel 2025 e dal 1/1 al 30/9/2026")}</section>`;
  });
}
/* ---------------- progetti PNRR, Giubileo e altri fondi ---------------- */
/* Progetti mostrati per luogo: sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio. */
if (D.progetti) {
  const P = D.progetti, pm = id => P.municipi[id];
  /* snapshot nuovo: importo_totale_euro conta solo i fondi del programma (CUP con lo stesso importo contato una volta) */
  const SOLO_PROG = IDS.some(id => isNum(pm(id)?.importo_schede_lordo_euro));
  const NOTA_IMP = SOLO_PROG ? " L'importo conta solo i fondi del programma; un CUP con lo stesso importo è contato una volta." : "";
  const GESTIONE = "I progetti sono per lo più gestiti dai dipartimenti di Roma Capitale, non dal municipio.";
  M.push({ id: "prog_importo", label: "Progetti con fondi straordinari: importo", unit: "eur", group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti di Roma Capitale (PNRR, Giubileo, PN Metro, fondi UE)",
    note: "Progetti collocati in un solo municipio; quelli di più municipi o di tutta la città restano a parte. " + GESTIONE + NOTA_IMP, get: id => pm(id)?.importo_totale_euro, roma: null });
  M.push({ id: "prog_n", label: "Progetti con fondi straordinari: numero", unit: "int", group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti di Roma Capitale", note: GESTIONE, get: id => pm(id)?.n_progetti, roma: null });
  M.push({ id: "prog_importo_ab", label: "Progetti con fondi straordinari per abitante", unit: "eur_ab", per: true, group: "Progetti", snap: "progetti",
    periodo: "elenco al " + dateIt(P.verificato), src: "pagine progetti / " + POP_SRC, note: GESTIONE + NOTA_IMP,
    get: id => { const v = pm(id)?.importo_totale_euro, p = POP(id); return isNum(v) && p ? v / p : null; }, roma: null });

  HERO_KPIS.push(() => {
    const c = P.cittadino || {}, sum = IDS.reduce((s, id) => s + (pm(id)?.importo_totale_euro || 0), 0);
    const all = sum + ["piu_municipi", "intermunicipale", "senza_municipio"].reduce((s, k) => s + (c[k]?.importo_totale_euro || 0), 0);
    return kpi("Progetti PNRR, Giubileo e fondi UE sul territorio dei municipi", sum, "eur", `su ${euroLike(all)} di progetti elencati da Roma Capitale. Li gestiscono per lo più i dipartimenti centrali.`, `<a href="${R.fonti}">pagine progetti</a>`);
  });
  /* nella pagina iniziale, al posto delle barre "Dove finiscono i fondi straordinari", le ciambelle di PNRR e Giubileo 2025 (lib/home.ts) */
  MUN_KPIS.push(id => kpi("Progetti PNRR, Giubileo e fondi UE sul territorio", pm(id)?.importo_totale_euro, "eur", `${fmt(pm(id)?.n_progetti, "int")} progetti collocati nel municipio`, "Roma Capitale, pagine progetti"));
  const FONTE_MUN = { testo_scheda: "municipio indicato nel testo della scheda", testo_programma: "municipio indicato nel testo del programma", cup_per_municipio: "scheda unica per più municipi, con un CUP e un importo per ciascuno" };
  MUN_BLOCKS.push(id => {
    const m = pm(id); if (!m) return "";
    const progs = Object.entries<any>(m.per_programma || {}).map(([k, v]) => ({ label: `${k} (${v.n_progetti})`, v: v.importo_totale_euro }));
    const hasProgImp = (m.progetti || []).some(p => isNum(p.importo_programma_euro));
    const impP = p => hasProgImp ? p.importo_programma_euro : p.importo;
    const NO_IMP = { "solo cifre di altre fonti": "altre fonti, non del programma", "importo non leggibile nella fonte": "non leggibile nella fonte" };
    const impCell = p => isNum(impP(p)) ? fmt(impP(p), "eur_exact") : `<small>${esc(NO_IMP[p.importo_programma_metodo] || "non disponibile")}</small>`;
    const list = [...(m.progetti || [])].sort((a, b) => (impP(b) ?? -1) - (impP(a) ?? -1));
    const intro = `Opere e servizi finanziati da PNRR, Giubileo 2025 e altri fondi straordinari che si trovano sul territorio del municipio. ${GESTIONE} ${hasProgImp ? "È la quota finanziata dal programma" : "È l'importo indicato nella scheda"}, non quanto è già stato pagato.` +
      (SOLO_PROG ? NOTA_IMP : " Alcuni importi sommano più fonti di finanziamento.");
    return `<section class="block"><div class="head"><div><h2>Progetti sul territorio</h2><p>${intro}</p></div></div>
    <div class="panel"><h3>Importo per programma</h3>${barsList(progs, "eur")}</div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Progetto</th><th>Programma</th><th>Stato</th><th class="num">${hasProgImp ? "Fondi del programma" : "Importo"}</th></tr></thead><tbody>
    ${list.map(p => { const note = [p.attuatore ? "Attuatore: " + p.attuatore : "", p.municipio_fonte && p.municipio_fonte !== "campo_scheda" ? (FONTE_MUN[p.municipio_fonte] || "municipio non indicato nel campo della scheda") : "", p.nota || ""].filter(Boolean);
      return `<tr><td><a href="${esc(safeUrl(p.link) || "#")}" target="_blank" rel="noopener">${esc(p.titolo)}</a>${p.cup?.length ? `<br><small class="src" style="margin:0">CUP ${p.cup.map(esc).join(", ")}</small>` : ""}${note.length ? `<br><small class="src" style="margin:0">${note.map(esc).join(" · ")}</small>` : ""}</td><td>${esc(p.programma)}</td><td>${esc(p.stato || "")}</td><td class="num" title="${esc(p.importo_testo || "")}">${impCell(p)}</td></tr>`; }).join("")}
    </tbody></table></div>${hasProgImp ? `<p class="src">La colonna conta solo i fondi del programma. Il testo completo dell'importo è nella scheda del progetto.</p>` : ""}${srcLine("progetti", "elenco letto il " + dateIt(P.verificato))}</section>`;
  });
}

/* ---------------- nidi ---------------- */
if (D.nidi) {
  const N = D.nidi, per = N.municipi["1"]?.anno_educativo || "";
  const add = (key, label, extra = {}) => M.push({ id: "nidi_" + key, label, unit: "int", group: "Servizi", snap: "nidi",
    periodo: "anno educativo " + per, src: "Dashboard Nidi 2025", note: N.misura, non: N.non_misura,
    get: id => N.municipi[id]?.[key], roma: N.roma?.[key], romaLabel: "somma dei municipi", ...extra });
  add("posti", "Posti nei nidi (comunali e convenzionati)");
  add("iscritti", "Bambini iscritti al nido");
  add("domande_valide", "Domande valide per il nido");
  add("lista_attesa_finale", "Bambini in lista d'attesa a fine anno");
  M.push({ id: "nidi_copertura", label: "Iscritti per 100 domande valide", unit: "dec", group: "Servizi", snap: "nidi",
    periodo: "anno educativo " + per, src: "Dashboard Nidi 2025, calcolo: iscritti / domande valide x 100",
    get: id => { const m = N.municipi[id]; return m && m.domande_valide > 0 ? m.iscritti / m.domande_valide * 100 : null; },
    roma: N.roma && N.roma.domande_valide > 0 ? N.roma.iscritti / N.roma.domande_valide * 100 : null, romaLabel: "somma dei municipi" });

  MUN_BLOCKS.push(id => {
    const m = N.municipi[id]; if (!m) return "";
    const years = Object.entries<any>(m.serie_storica || {});
    const tip = Object.entries<any>(m.posti_per_tipologia || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k.replace(" - ", ": "), v }));
    return `<section class="block"><div class="head"><div><h2>Asili nido</h2><p>Posti, iscritti e liste d'attesa del servizio comunale e dei nidi convenzionati nel municipio.</p></div></div>
    <div class="grid g4">${kpi("Strutture", m.n_strutture, "int")}${kpi("Posti", m.posti, "int")}${kpi("Iscritti", m.iscritti, "int")}${kpi("Lista d'attesa a fine anno", m.lista_attesa_finale, "int", `iniziale: ${fmt(m.lista_attesa_iniziale, "int")}`)}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h3>Posti per tipo di gestione</h3>${barsList(tip, "int")}</div>
      <div class="panel"><h3>Lista d'attesa a fine anno, negli anni</h3>${barsList(years.map(([y, v]) => ({ label: y, v: v.lista_attesa_finale })), "int")}</div>
    </div>${srcLine("nidi")}</section>`;
  });
}

/* ---------------- politica ---------------- */
if (D.politica) {
  const P = D.politica;
  MUN_HEAD.push(id => {
    const m = P.municipi[id]; if (!m) return "";
    return `<p class="lede">Presidente: <b>${esc(m.presidente || "non indicato sulla pagina")}</b>${m.pagina ? ` · <a href="${esc(m.pagina)}" target="_blank" rel="noopener">pagina ufficiale</a>` : ""}</p>`;
  });
  MUN_BLOCKS.push(id => {
    const m = P.municipi[id]; if (!m) return "";
    const cons = m.consiglio?.consiglieri || [];
    const byGroup = {}; cons.forEach(c => { const g = c.gruppo || c.gruppo_da_simbolo || "Gruppo non indicato"; (byGroup[g] = byGroup[g] || []).push(c); });
    const groups = Object.entries<any>(byGroup).sort((a, b) => b[1].length - a[1].length);
    return `<section class="block"><div class="head"><div><h2>Chi governa il municipio</h2><p>Presidente, giunta e consiglio come pubblicati da Roma Capitale. Consiliatura iniziata nell'ottobre 2021.</p></div></div>
    <div class="grid g2">
      <div class="panel"><h3>Giunta</h3><ul class="people">
        <li><b>${esc(m.presidente || "n.d.")}</b> · Presidente${m.presidente_deleghe ? `<br><small>${esc(m.presidente_deleghe)}</small>` : ""}</li>
        ${(m.giunta || []).map(g => `<li><b>${esc(g.nome)}</b> · ${esc(g.ruolo || "")}${g.deleghe ? `<br><small>${esc(g.deleghe)}</small>` : ""}</li>`).join("")}</ul></div>
      <div class="panel"><h3>Consiglio: ${cons.length} consiglieri più il presidente, per gruppo</h3>
        ${barsList(groups.map(([g, l]) => ({ label: g, v: l.length })), "int")}
        <details><summary>Elenco dei consiglieri</summary><ul class="people">${cons.map(c => `<li>${esc(c.nome)}${c.ruolo ? ` · ${esc(c.ruolo)}` : ""}<br><small>${esc(c.gruppo || c.gruppo_da_simbolo || "")}</small></li>`).join("")}</ul></details></div>
    </div>${srcLine("politica", "composizione pubblicata al " + dateIt(P.verificato))}</section>`;
  });
}

/* ---------------- quartieri: i nomi delle aree del municipio, sotto il presidente ----------------
   Ogni nome apre la sua area su Quartieri di Roma (romaquartieri.it/#<codice>): la mappa usa gli stessi
   codici della deliberazione 150/2026 (controllati tutti e 457 il 14/11/2026). */
const MAPPA_ROMA = "https://romaquartieri.it/";
if (D.quartieri?.aree?.length) {
  const Q = D.quartieri;
  MUN_HEAD.push(id => {
    const aree = Q.aree.filter(a => String(a.municipio) === id).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    if (!aree.length) return "";
    const nomeTipo = a => a.tipo[0].toUpperCase() + a.tipo.slice(1);
    const link = a => `<a href="${esc(MAPPA_ROMA + "#" + encodeURIComponent(a.codice))}" target="_blank" rel="noopener" title="${esc(`${nomeTipo(a)} ${a.nome}: apri sulla mappa`)}">${esc(a.nome)}</a>`;
    const riga = (l, xs, cls = "") => xs.length ? `<p${cls ? ` class="${cls}"` : ""}><span class="mq-l">${l} (${xs.length})</span> ${xs.map(link).join(", ")}</p>` : "";
    const rq = aree.filter(a => a.tipo !== "zona funzionale"), zf = aree.filter(a => a.tipo === "zona funzionale");
    const nR = rq.filter(a => a.tipo === "rione").length;
    const conta = [nR ? `${nR} ${nR === 1 ? "rione" : "rioni"}` : "", rq.length - nR ? `${rq.length - nR} ${rq.length - nR === 1 ? "quartiere" : "quartieri"}` : "", zf.length ? `${zf.length} ${zf.length === 1 ? "zona funzionale" : "zone funzionali"}` : ""].filter(Boolean).join(", ");
    const nm = Array.isArray(Q.non_misura) ? Q.non_misura : (Q.non_misura ? [Q.non_misura] : []);
    const det = `<p>Le ${aree.length} aree del municipio secondo la deliberazione A.C. n. 150/2026: ${conta}. Le zone funzionali non sono né quartieri né rioni: per esempio parchi, riserve, aree militari, industriali o cimiteriali.</p>`
      + `<p>Fonte: ${fonteHtml(Q.fonte)}${Q.fonte?.ente ? ", " + esc(Q.fonte.ente) : ""}. File scaricati il ${dateIt(Q.verificato)}.</p>`
      + (nm.length ? `<p>Cosa non dice: ${nm.map(esc).join(" ")}</p>` : "")
      + `<p>Ogni nome apre la sua area sulla mappa Quartieri di Roma di Urbe Hub, che usa gli stessi codici.</p>`;
    return `<div class="mun-q">${riga(nR ? "Rioni e quartieri" : "Quartieri", rq)}${riga("Zone funzionali", zf, "mq-zf")}
      <p class="mq-map"><a class="btn" href="${MAPPA_ROMA}" target="_blank" rel="noopener">Apri la mappa dei quartieri di Roma<span aria-hidden="true">↗</span></a><span class="src">Nomi: Roma Capitale, deliberazione 150/2026${info(det, "quartieri")}</span></p></div>`;
  });
}
/* ======================= fine sezioni ======================= */

export const metric = (id: string | null) => M.find(m => m.id === id);
const GROUP_ORDER = ["Bilancio", "Appalti", "Progetti", "Servizi", "Redditi", "Imprese", "Profilo"];
export const groupsOf = (list: Metric[]) => [...new Set(list.map(m => m.group))].sort((a, b) => (GROUP_ORDER.indexOf(a) + 99) % 99 - (GROUP_ORDER.indexOf(b) + 99) % 99);
export function values(m: Metric) { return IDS.map(id => ({ id, v: m.get(id) })); }
export const metricInfo = (m: Metric) => `<p>${esc(m.src || "")}${m.periodo ? `, ${esc(m.periodo)}` : ""}.</p>${m.note ? `<p>${esc(m.note)}</p>` : ""}`;

/* ---------- componenti ---------- */
/* In pagina: etichetta, valore e una nota breve. Valore esatto, spiegazioni lunghe e fonte nell'icona info. */
export function kpi(label, v, unit, sub?, src?) {
  const na = !isNum(v);
  const ex = !na && unit && unit.startsWith("eur") && unit !== "eur_ab" && unit !== "eur_exact" ? exact(v, unit) : "";
  const short = sub && String(sub).length <= 34;
  const more = [ex ? `Valore esatto: ${ex}` : "", sub && !short ? esc(sub) : "", src ? `Fonte: ${src}` : ""].filter(Boolean);
  return `<div class="kpi${na ? " na" : ""}"><span class="l">${esc(label)}${more.length ? info(more.map(x => `<p>${x}</p>`).join(""), label) : ""}</span><span class="v">${na ? "Non disponibile" : fmt(v, unit)}</span>${short ? `<span class="x">${esc(sub)}</span>` : ""}</div>`;
}
export function barsRanking(m: Metric, hl?: string) {
  const rows = values(m).filter(r => isNum(r.v)).sort((a, b) => b.v - a.v);
  if (!rows.length) return `<p class="na-note">Dato non disponibile.</p>`;
  const max = Math.max(...rows.map(r => r.v)), ref = max;
  const avg = m.roma && !m.per && m.unit !== "eur" && m.unit !== "int" ? m.roma : null;
  const line = isNum(avg) && avg <= max;
  return `<div class="bars">${rows.map(r => `<a class="bar-row${r.id === hl ? " hl" : ""}" href="${R.mun(r.id)}"><span class="n">Municipio ${ROMANI[r.id]}</span><span class="t"><i style="width:${(r.v / max * 100).toFixed(2)}%"></i>${line ? `<b style="left:${(avg / max * 100).toFixed(2)}%" title="${esc(romaLabelOf(m))}"></b>` : ""}</span><span class="val">${fmt(r.v, m.unit, ref)}</span></a>`).join("")}</div>
  ${isNum(avg) ? `<p class="src keep">${line ? "La linea scura è il valore di riferimento" : "Valore di riferimento"}, ${esc(romaLabelOf(m))}: ${fmt(avg, m.unit)}.</p>` : ""}`;
}
export function barsList(rows: { label: string; v: any; href?: string; hl?: boolean }[], unit) {
  rows = rows.filter(r => isNum(r.v)); if (!rows.length) return `<p class="na-note">Dato non disponibile.</p>`;
  const max = Math.max(...rows.map(r => r.v));
  return `<div class="bars">${rows.map(r => `<${r.href ? `a href="${r.href}"` : "div"} class="bar-row${r.hl ? " hl" : ""}"><span class="n" title="${esc(r.label)}">${esc(r.label)}</span><span class="t"><i style="width:${max > 0 ? (r.v / max * 100).toFixed(2) : 0}%"></i></span><span class="val">${fmt(r.v, unit, max)}</span></${r.href ? "a" : "div"}>`).join("")}</div>`;
}
export function breaks(vals) { /* usata anche da lib/mappa-leaflet.ts: stesse classi della legenda */
  const s = vals.filter(isNum).sort((a, b) => a - b); if (!s.length) return [];
  return [0.2, 0.4, 0.6, 0.8].map(q => s[Math.min(s.length - 1, Math.floor(q * s.length))]);
}
export const mapLabels = G => G.municipi.map(x => `<text x="${x.label[0]}" y="${x.label[1]}" text-anchor="middle" dominant-baseline="middle">${x.romano}</text>`).join("");
export function mapSvg(m: Metric, hl?: string) {
  const G = D.mappa; if (!G) return naBlock("Mappa");
  const vals = values(m), br = breaks(vals.map(r => r.v));
  const cls = v => !isNum(v) ? "var(--map-na)" : `var(--map-${1 + br.filter(b => v >= b).length})`;
  const byId = Object.fromEntries(vals.map(r => [r.id, r.v]));
  const li = (c, t) => `<span class="li"><i style="background:${c}"></i>${t}</span>`;
  return `<svg viewBox="${G.viewBox}" role="img" aria-label="Mappa dei 15 municipi: ${esc(m.label)}">${G.municipi.map(x => { const id = String(x.municipio); return `<path d="${x.path}" fill="${cls(byId[id])}" data-id="${id}" class="${id === hl ? "on" : ""}"><title>Municipio ${x.romano}: ${fmt(byId[id], m.unit)}</title></path>`; }).join("")}${mapLabels(G)}</svg>
  <div class="legend">${br.length ? [`meno di ${fmt(br[0], m.unit)}`, ...br.map(b => `da ${fmt(b, m.unit)}`)].map((t, i) => li(`var(--map-${i + 1})`, t)).join("") : ""}${vals.some(r => !isNum(r.v)) ? li("var(--map-na)", "non disponibile") : ""}</div>`;
}
export function metricSrc(m: Metric) { return srcLine(m.snap, [m.src, m.periodo].filter(Boolean).join(", ")); }
export function metricSelect(cur: string, id = "pick") {
  const groups = groupsOf(M);
  return `<select id="${id}" aria-label="Indicatore">${groups.map(g => `<optgroup label="${esc(g)}">${M.filter(m => m.group === g).map(m => `<option value="${m.id}"${m.id === cur ? " selected" : ""}>${esc(m.label)}${m.periodo ? ` (${esc(m.periodo)})` : ""}</option>`).join("")}</optgroup>`).join("")}</select>`;
}
