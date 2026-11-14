/* Pagina iniziale: le classifiche sotto i numeri principali e le due ciambelle di PNRR e Giubileo 2025.
   Portato nel sito statico da scripts/porta-al-sito-statico.mjs (DAWEB.classificheHome, DAWEB.torteHome):
   un testo si cambia solo qui.
   Classifiche: per ogni indicatore solo il primo dei 15 municipi (a pari merito tutti i primi), con il valore,
   il periodo e, nell'icona info, fonte, limiti e il secondo in classifica. Indicatori diversi non si sommano. */
import { D, IDS, ROMANI, esc, fmt, fonteHtml, info, isNum, metric, metricInfo, naBlock } from "./engine";
import { R } from "./routes";
import { donut } from "./grafici";
import { NON_PAGAMENTI, fette, fonteFondo, type Programma } from "./fondi";

const CLASSIFICHE: [string, string][] = [
  ["peg_spese_ab", "Più stanziamenti per abitante"],
  ["peg_capitale_ab", "Più investimenti per abitante"],
  ["anac_importo_ab", "Più appalti avviati per abitante"],
  ["prog_importo_ab", "Più fondi straordinari per abitante"],
];
const nomeMun = (id: string) => "Municipio " + ROMANI[id];

export function classificheHome() {
  const card = ([mid, titolo]: [string, string]) => {
    const m = metric(mid); if (!m) return "";
    const vs = IDS.map(id => ({ id, v: m.get(id) })).filter(r => isNum(r.v)).sort((a, b) => b.v - a.v);
    if (!vs.length) return "";
    const top = vs.filter(r => r.v === vs[0].v), dopo = vs.find(r => r.v < vs[0].v);
    const f = D[m.snap]?.fonte;
    const det = metricInfo(m) + `<p>Primo su ${vs.length} municipi con il dato.${dopo ? ` Secondo: ${esc(nomeMun(dopo.id))}, ${esc(fmt(dopo.v, m.unit))}.` : ""}</p>` +
      (f ? `<p>Fonte: ${fonteHtml(f)}${f.ente ? ", " + esc(f.ente) : ""}</p>` : "");
    return `<div class="kpi primo"><span class="l">${esc(titolo)}${info(det, titolo)}</span>
      <span class="v">${top.map(r => `<a href="${R.mun(r.id)}">${esc(nomeMun(r.id))}</a>`).join(" e ")}</span>
      <span class="x">${esc(fmt(vs[0].v, m.unit))} per abitante, ${esc(m.periodo || "")}</span></div>`;
  };
  const html = CLASSIFICHE.map(card).filter(Boolean);
  if (!html.length) return "";
  return `<div class="grid g4 primi">${html.join("")}</div>
  <p class="src primi-src">Il primo dei 15 municipi per ogni indicatore, diviso per i residenti al 31/12/2025. Gli indicatori hanno fonti e periodi diversi e non si sommano: li trovi nelle icone info.</p>`;
}

export function torteHome() {
  const pagina: Record<Programma, string> = { "PNRR": R.pnrr, "Giubileo 2025": R.giubileo };
  const pannello = (prog: Programma) => {
    const slices = fette(prog), tot = slices.reduce((s, x) => s + x.v, 0);
    if (!(tot > 0)) return naBlock(prog);
    return `<div class="panel torta"><div class="torta-h"><h3>${esc(prog)}</h3><a class="piu" href="${pagina[prog]}">Apri la pagina ${esc(prog)}</a></div>
      ${donut(slices, tot, `Ciambella: fondi ${prog} per luogo`)}${fonteFondo(prog)}</div>`;
  };
  return `<section class="block torte"><div class="head"><div><h2>PNRR e Giubileo 2025: dove vanno i fondi</h2><p>Quota dei fondi di ciascun programma per luogo del progetto. I progetti su più municipi, intermunicipali o senza municipio indicato restano a parte: i loro importi non sono divisi tra i municipi. ${NON_PAGAMENTI} Li gestiscono per lo più i dipartimenti di Roma Capitale, non i municipi.</p></div></div>
    <div class="grid g2">${pannello("PNRR")}${pannello("Giubileo 2025")}</div></section>`;
}
