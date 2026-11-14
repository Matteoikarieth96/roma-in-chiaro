/* Confronta: due municipi fianco a fianco.
   - In alto: dove ciascuno dei due è sul podio (1°, 2° o 3° su 15) negli indicatori per abitante, quote e medie.
   - Poi: per ogni indicatore due barre affiancate, sulla scala dei 15 municipi, con la differenza scritta.
   - Verde e rosso solo dove il verso dell'indicatore è difendibile da solo (tabella DIREZIONE).
     Tutto il resto è neutro. Il colore non è mai da solo: c'è sempre la parola (meglio, peggio) e la differenza. */
import { A, D, IDS, M, POP_SRC, ROMANI, esc, f1, f2, fEur, fInt, fmt, groupsOf, info, isNum, mapLabels, naBlock, srcLine, type Metric } from "./engine";
import { afterRender, wireMap, type Nav } from "./pages";
import { R } from "./routes";

/* ---------- direzione di ogni indicatore ----------
   su     = un valore più alto è meglio
   giu    = un valore più alto è peggio
   neutro = né meglio né peggio: lo diciamo solo più alto o più basso
   rel    = per abitante, quota o media: confrontabile fra municipi di dimensioni diverse.
            I totali (rel: false) restano neutri e vanno in fondo a ogni tema.
   diff   = come scrivere la differenza: "rel" in percentuale (con le protezioni sotto), "pp" in punti
            percentuali, "abs" come differenza nella stessa unità (per i valori "per 100").
   pod    = come si legge nel podio ("1° per ..."). */
export type Dir = "su" | "giu" | "neutro";
type Conf = { dir: Dir; rel: boolean; perche: string; diff?: "rel" | "pp" | "abs"; pod?: string; suffix?: string };

const SPESA = "Spendere di più non è di per sé meglio o peggio: dipende dai bisogni del territorio e da come si spende.";
const TOTALE = "È un totale: cresce con le dimensioni del municipio, quindi non lo coloriamo.";
const DESCRIVE = "Descrive chi vive nel municipio, non quello che il municipio fa.";
export const DIREZIONE: Record<string, Conf> = {
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
export const confOf = (m: Metric): Conf => DIREZIONE[m.id] || { dir: "neutro", rel: !!m.per || m.unit === "pct", perche: "Indicatore senza un verso stabilito: lo trattiamo come neutro.", diff: m.unit === "pct" ? "pp" : "rel" };

/* ---------- indicatori calcolati qui, solo per il confronto (rapporti fra campi dello stesso snapshot) ---------- */
function derivati(): { after: string; m: Metric }[] {
  const out: { after: string; m: Metric }[] = [];
  const N = D.nidi;
  if (N) out.push({ after: "nidi_copertura", m: { id: "cf_nidi_attesa", label: "Lista d'attesa a fine anno per 100 domande valide", unit: "dec", group: "Servizi", snap: "nidi",
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
export const LISTA: Metric[] = (() => {
  const list = [...M];
  for (const { after, m } of derivati()) { const i = list.findIndex(x => x.id === after); list.splice(i >= 0 ? i + 1 : list.length, 0, m); }
  return list;
})();

/* ---------- numeri ---------- */
const NA = "dato non disponibile";
/* come fmt(), ma gli euro per abitante sotto i 10 € tengono i centesimi: mai "0 €" per 0,24 € */
export function fmtC(v: any, unit: string, ref?: number) {
  if (!isNum(v)) return NA;
  if (unit === "eur_ab") return Math.abs(v) < 10 && v !== 0 ? f2.format(v) + " €" : fEur.format(v);
  return fmt(v, unit, ref);
}
/* differenza nella stessa unità, sempre positiva (il verso lo dice la frase) */
function fmtDelta(d: number, unit: string, ref?: number) {
  if (unit === "eur_ab" || unit === "eur_exact") return Math.abs(d) < 10 ? f2.format(d) + " €" : fEur.format(d);
  if (unit === "eur") return fmt(d, "eur", ref);
  if (unit === "dec") return Math.abs(d) < 10 ? f1.format(d) : fInt.format(d);
  return fInt.format(d);
}
/* sotto queste soglie una differenza in % ingannerebbe (es. 0,24 € contro 2 € = +733%): scriviamo la differenza assoluta */
const PICCOLO: Record<string, number> = { eur_ab: 5, eur_exact: 50, eur: 250000, int: 30, dec: 5, pct: 1 };

const nome = (id: string) => "Municipio " + ROMANI[id];
const al = (id: string) => "al " + nome(id);
const del = (id: string) => "del " + nome(id);

export type Diff = { hi: string | null; lo: string | null; testo: string; uguali?: boolean; na?: boolean };
/* Chi è più alto e di quanto, in una frase. a e b sono gli id dei municipi. */
export function diffInfo(m: Metric, a: string, b: string): Diff {
  const x = m.get(a), y = m.get(b), c = confOf(m);
  if (!isNum(x) || !isNum(y)) {
    const manca = [!isNum(x) ? a : null, !isNum(y) ? b : null].filter(Boolean) as string[];
    return { hi: null, lo: null, na: true, testo: `Confronto non possibile: ${NA} per ${manca.length === 2 ? "entrambi i municipi" : "il " + nome(manca[0])}.` };
  }
  if (x === y) return { hi: null, lo: null, uguali: true, testo: "Stesso valore nei due municipi." };
  const [hi, lo, vh, vl] = x > y ? [a, b, x, y] : [b, a, y, x];
  const d = vh - vl, mode = c.diff || (m.unit === "pct" ? "pp" : "rel");
  const suf = c.suffix ? " " + c.suffix : "";
  let quanto: string;
  if (mode === "pp") quanto = `di ${f1.format(d)} punti percentuali`;
  else if (mode === "abs") quanto = `di ${fmtDelta(d, m.unit)}${suf}`;
  else if (vl <= 0 || Math.abs(vl) < (PICCOLO[m.unit] ?? 0)) quanto = `di ${fmtDelta(d, m.unit, vh)}${suf}`;
  else if (vh / vl >= 3) quanto = `: ${f1.format(vh / vl)} volte il valore ${del(lo)}`;
  else { const pc = d / vl * 100; quanto = `: +${pc < 1 ? f1.format(pc) : fInt.format(pc)}% rispetto ${al(lo)}`; }
  const testo = quanto.startsWith(":") ? `${nome(hi)} più alto${quanto}` : `${nome(hi)} più alto ${quanto} rispetto ${al(lo)}`;
  return { hi, lo, testo };
}

/* ---------- posizione fra i 15 municipi (dal valore più alto) ---------- */
export type Rank = { pos: number; n: number; pari: boolean };
export function rankOf(m: Metric, id: string): Rank | null {
  const v = m.get(id); if (!isNum(v)) return null;
  const all = IDS.map(i => m.get(i)).filter(isNum);
  return { pos: 1 + all.filter(w => w > v).length, n: all.length, pari: all.filter(w => w === v).length > 1 };
}
const median = (arr: number[]) => { const s = [...arr].sort((p, q) => p - q), k = s.length; return k ? (k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2) : null; };

/* ---------- podio: fino a 3 indicatori dove il municipio è 1°, 2° o 3° su 15 ----------
   Solo indicatori relativi (per abitante, quote, medie) e non "giu": un primo posto in lista d'attesa
   non va letto come un traguardo. Prima i posti più alti; a parità, un tema non ancora usato. */
export type Podio = { m: Metric; r: Rank; v: number };
export function podiOf(id: string): Podio[] {
  const all: Podio[] = [];
  LISTA.forEach(m => { const c = confOf(m); if (!c.rel || c.dir === "giu") return; const r = rankOf(m, id); if (r && r.pos <= 3) all.push({ m, r, v: m.get(id) }); });
  /* a parità di posto: prima i temi dei soldi (ordine dei temi della pagina), poi l'ordine del registro */
  const g = groupsOf(LISTA), gi = (p: Podio) => g.indexOf(p.m.group), li = (p: Podio) => LISTA.indexOf(p.m);
  return all.sort((p, q) => p.r.pos - q.r.pos || gi(p) - gi(q) || li(p) - li(q));
}
export function podioTop(all: Podio[], k = 3): Podio[] {
  const out: Podio[] = [], left = [...all];
  while (out.length < k && left.length) {
    const best = left[0].r.pos, used = new Set(out.map(p => p.m.group));
    const i = Math.max(0, left.findIndex(p => p.r.pos === best && !used.has(p.m.group)));
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}
const podLabel = (m: Metric) => confOf(m).pod || m.label.charAt(0).toLowerCase() + m.label.slice(1);
const posTxt = (r: Rank) => `${r.pos}°${r.pari ? " a pari merito" : ""}`;
function podioInfo(p: Podio) {
  return `<p><b>${esc(p.m.label)}</b>${p.m.note ? `: ${esc(p.m.note)}` : "."}</p>
    <p>Valore: <b>${esc(fmtC(p.v, p.m.unit))}</b>. Posizione: ${esc(posTxt(p.r))} su ${p.r.n} municipi con il dato, dal valore più alto al più basso.</p>
    <p>Fonte: ${esc(p.m.src || "")}${p.m.periodo ? `. Periodo: ${esc(p.m.periodo)}` : ""}.</p>`;
}
function podioCard(id: string, side: "a" | "b") {
  const all = podiOf(id), top = podioTop(all), rest = all.filter(p => !top.includes(p));
  const item = (p: Podio) => `<li class="cf-pod-i"><span class="cf-pos" aria-hidden="true">${p.r.pos}°</span>
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
const badge = (ok: boolean) => `<span class="cf-badge ${ok ? "ok" : "ko"}">${ok ? ICON_OK : ICON_KO}${ok ? "meglio" : "peggio"}</span>`;

function indicatore(m: Metric, a: string, b: string) {
  const c = confOf(m), vals = IDS.map(i => m.get(i)).filter(isNum), max = Math.max(0, ...vals), med = median(vals);
  const d = diffInfo(m, a, b), x = m.get(a), y = m.get(b);
  /* differenze sotto il 5% del valore più alto: valori simili, niente verde o rosso */
  const simile = isNum(x) && isNum(y) && Math.abs(x - y) < SIMILE * Math.max(Math.abs(x), Math.abs(y));
  const colore = c.dir !== "neutro" && d.hi && !simile;
  const better = colore ? (c.dir === "su" ? d.hi : d.lo) : null;
  const riga = (id: string, side: "a" | "b") => {
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
function totali(list: Metric[], a: string, b: string) {
  if (!list.length) return "";
  return `<details class="cf-abs"><summary>Totali (${list.length}): crescono con le dimensioni del municipio</summary>
    <div class="table-wrap"><table><thead><tr><th>Indicatore</th><th class="num"><span class="dot a"></span> ${ROMANI[a]}</th><th class="num"><span class="dot b"></span> ${ROMANI[b]}</th><th>Differenza</th></tr></thead><tbody>
    ${list.map(m => { const x = m.get(a), y = m.get(b), ref = Math.max(Math.abs(x || 0), Math.abs(y || 0));
      return `<tr><td>${esc(m.label)}${info(`<p>${esc(m.note || "")}</p><p>Fonte: ${esc(m.src || "")}${m.periodo ? `, ${esc(m.periodo)}` : ""}.</p>`, m.label)}${m.periodo ? `<br><small class="cf-per">${esc(m.periodo)}</small>` : ""}</td><td class="num" data-v="${isNum(x) ? x : ""}">${esc(fmtC(x, m.unit, ref))}</td><td class="num" data-v="${isNum(y) ? y : ""}">${esc(fmtC(y, m.unit, ref))}</td><td>${esc(diffInfo(m, a, b).testo)}</td></tr>`; }).join("")}
    </tbody></table></div></details>`;
}

/* "Come leggiamo i colori": la tabella DIREZIONE, in pagina */
function legenda() {
  const rel = LISTA.filter(m => confOf(m).rel);
  const col = rel.filter(m => confOf(m).dir !== "neutro"), neu = rel.filter(m => confOf(m).dir === "neutro");
  const motivi = new Map<string, string[]>(); neu.forEach(m => { const k = confOf(m).perche; motivi.set(k, [...(motivi.get(k) || []), m.label]); });
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
export function confrontaIds(a: string, b: string) {
  if (!IDS.includes(a)) a = "1";
  if (!IDS.includes(b) || b === a) b = a === "1" ? "2" : "1";
  return [a, b];
}
const SWAP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><path d="M4 8h14m0 0-3.5-3.5M18 8l-3.5 3.5M20 16H6m0 0 3.5-3.5M6 16l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function htmlConfronto(a0: string, b0: string) {
  const [a, b] = confrontaIds(a0, b0);
  const sel = (id: string, cur: string, other: string, lab: string) => `<select id="${id}" aria-label="${lab}">${IDS.map(i => `<option value="${i}"${i === cur ? " selected" : ""}${i === other ? " disabled" : ""}>Municipio ${ROMANI[i]}</option>`).join("")}</select>`;
  const pres = (id: string) => D.politica?.municipi[id]?.presidente;
  const pop = (id: string) => A?.municipi[id]?.popolazione;
  const G = D.mappa;
  const fill = (id: string) => id === a ? "var(--cmp-a)" : id === b ? "var(--cmp-b)" : "var(--map-na)";
  const who = (id: string, side: string) => `<div class="cf-who"><span class="dot ${side}"></span><div><b>${nome(id)}</b>
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
    ${G ? `<div class="panel map"><svg viewBox="${G.viewBox}" role="img" aria-label="Mappa: ${nome(a)} e ${nome(b)}">${G.municipi.map((x: any) => { const id = String(x.municipio); return `<path d="${x.path}" fill="${fill(id)}" data-id="${id}"><title>Municipio ${x.romano}</title></path>`; }).join("")}${mapLabels(G)}</svg></div>` : naBlock("Mappa")}
    <div class="panel cf-whos">${who(a, "a")}${who(b, "b")}<p class="cf-scala">${esc(scala)}</p></div></div>

  <div class="cf-legwrap">${legenda()}</div>

  ${groups.map(g => {
    const gl = LISTA.filter(m => m.group === g), rel = gl.filter(m => confOf(m).rel), tot = gl.filter(m => !confOf(m).rel);
    return `<section class="block cf-g"><div class="head"><div><h2>${esc(g)}</h2></div></div>
    ${rel.length ? `<div class="cf-grid">${rel.map(m => indicatore(m, a, b)).join("")}</div>` : ""}
    ${totali(tot, a, b)}
    ${[...new Set(gl.map(m => m.snap))].map(s => srcLine(s)).join("")}</section>`; }).join("")}
  </div>`;
}

export function wireConfronto(root: HTMLElement, signal: AbortSignal, a0: string, b0: string, nav: Nav) {
  const [a, b] = confrontaIds(a0, b0);
  const go = (x: string, y: string) => nav(R.conf(x, y));
  root.querySelector("#ca")?.addEventListener("change", e => go((e.target as HTMLSelectElement).value, b), { signal });
  root.querySelector("#cb")?.addEventListener("change", e => go(a, (e.target as HTMLSelectElement).value), { signal });
  root.querySelector("#swap")?.addEventListener("click", () => go(b, a), { signal });
  wireMap(root, signal, id => { if (id !== a) go(a, id); });
  afterRender(root);
}
