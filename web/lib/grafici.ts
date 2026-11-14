/* Pezzi dei grafici condivisi dalle pagine dei fondi (PNRR, Giubileo 2025) e dalla scheda municipio.
   HTML e SVG in linea, senza librerie. Colori: token --c1…--c5, --c-na, --data e --data-hl in globals.css,
   controllati con lo script della skill dataviz (validate_palette.js) su chiaro e scuro.
   Un valore mancante non entra nei grafici e nelle tabelle resta "non disponibile", mai 0. */
import { esc, f1, fInt, fmt, isNum } from "./engine";

export const pct = (a: number, b: number) => (b > 0 ? f1.format(a / b * 100) + "%" : "n.d.");

/* ---------- assi ---------- */
export function nice(max: number) {
  if (!(max > 0)) return { step: 1, top: 1 };
  const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  return { step, top: Math.ceil(max / step - 1e-9) * step };
}
const num = (v: number) => (Number.isInteger(v) ? fInt.format(v) : f1.format(v));
function tick(v: number, unit: string, top: number) {
  if (v === 0) return "0";
  if (unit === "eur") return top >= 1e9 ? num(v / 1e9) + " mld" : top >= 1e6 ? num(v / 1e6) + " mln" : fInt.format(v);
  if (unit === "pct") return num(v) + "%";
  return fInt.format(v);
}
/* asse: per i conteggi dice che cosa si conta (default: progetti) */
const UNIT_ASSE = (unit: string, top: number, asse?: string) => unit === "eur" ? (top >= 1e9 ? "miliardi di euro" : top >= 1e6 ? "milioni di euro" : "euro") : unit === "eur_ab" ? "euro per abitante" : asse || "numero di progetti";
function ticksOf(max: number, unit: string) {
  const { step, top } = nice(max);
  const ticks: number[] = []; for (let t = 0; t <= top + step / 1e6; t += step) ticks.push(t);
  const labels = ticks.map(t => tick(t, unit, top)), w = Math.max(...labels.map(l => l.length)) * 0.6 + 0.4;
  return { top, ticks, labels, w };
}
const yAxis = (t: ReturnType<typeof ticksOf>) => `<div class="ch-y" style="width:${t.w.toFixed(1)}em">${t.ticks.map((v, i) => `<span style="bottom:${(v / t.top * 100).toFixed(2)}%">${esc(t.labels[i])}</span>`).join("")}</div>`;
const grid = (t: ReturnType<typeof ticksOf>) => `<div class="ch-grid">${t.ticks.map(v => `<i style="bottom:${(v / t.top * 100).toFixed(2)}%"${v === 0 ? ' class="base"' : ""}></i>`).join("")}</div>`;

/* ---------- colonne (anche impilate) ---------- */
export type Seg = { v: number | null; c: string };
export type ColRow = { label: string; tip: string; segs: Seg[] };
export function colChart(o: { rows: ColRow[]; unit: string; aria: string; stagger?: boolean; asse?: string }) {
  const tot = (r: ColRow) => r.segs.reduce((s, x) => s + (isNum(x.v) ? x.v : 0), 0);
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

/* ---------- linee nel tempo: stesse misure delle colonne, un punto per periodo, buchi dove manca il dato ---------- */
export type LineSerie = { label: string; c: string; vals: (number | null)[] };
export function lineChart(o: { x: string[]; tips: string[]; series: LineSerie[]; unit: string; aria: string; asse?: string; every?: number }) {
  const n = o.x.length, all = o.series.flatMap(s => s.vals.filter(isNum));
  const t = ticksOf(Math.max(0, ...all), o.unit), { top } = t;
  const X = (i: number) => (i + 0.5) / n * 100, Y = (v: number) => 100 - v / top * 100;
  const lines = o.series.map(s => {
    const runs: string[][] = []; let cur: string[] = [];
    s.vals.forEach((v, i) => { if (isNum(v)) cur.push(`${X(i).toFixed(2)},${Y(v).toFixed(2)}`); else { if (cur.length) runs.push(cur); cur = []; } });
    if (cur.length) runs.push(cur);
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

export const legend = (items: { label: string; c: string }[]) => `<div class="legend">${items.map(s => `<span class="li"><i style="background:${s.c}"></i>${esc(s.label)}</span>`).join("")}</div>`;

/* ---------- ciambella: al massimo 6 fette ---------- */
export type Slice = { label: string; v: number; c: string; nota?: string };
export function donut(slices: Slice[], total: number, aria: string, unit = "eur") {
  const ref = Math.max(...slices.map(s => s.v)); /* stessa unità in tutta la legenda, dalla fetta più grande */
  const cx = 100, cy = 100, R1 = 96, R0 = 60;
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  let a = -Math.PI / 2;
  const paths = slices.map(s => {
    const ang = s.v / total * 2 * Math.PI, a0 = a, a1 = a + ang; a = a1;
    /* 2 px di fondo tra le fette, uguali sul bordo esterno e su quello interno */
    const o0 = a0 + 1 / R1, o1 = a1 - 1 / R1, i0 = a0 + 1 / R0, i1 = a1 - 1 / R0;
    if (o1 <= o0) return "";
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
export function stackBars(rows: { label: string; tip: string; segs: Seg[] }[], unit: string, aria: string) {
  const tot = (r: { segs: Seg[] }) => r.segs.reduce((s, x) => s + (isNum(x.v) ? x.v : 0), 0);
  const max = Math.max(0, ...rows.map(tot));
  return `<div class="bars sb" role="img" aria-label="${esc(aria)}">${rows.map(r => { const t = tot(r);
    return `<div class="bar-row" data-tip="${esc(r.tip)}"><span class="n" title="${esc(r.label)}">${esc(r.label)}</span><span class="sb-t"><span class="sb-b" style="width:${max > 0 ? (t / max * 100).toFixed(2) : 0}%">${r.segs.filter(s => isNum(s.v) && s.v > 0).map(s => `<i style="flex-grow:${s.v};background:${s.c}"></i>`).join("")}</span></span><span class="val">${esc(fmt(t, unit, max))}</span></div>`; }).join("")}</div>`;
}

/* ---------- classifica con barra: titolo, riga di contesto, valore ---------- */
export function ranking(items: { titolo: string; meta: string; v: number; href?: string; tip: string }[], unit = "eur") {
  const mx = items[0]?.v || 0;
  return `<ol class="rk">${items.map(x => { const u = x.href; return `<li><${u ? `a href="${esc(u)}" target="_blank" rel="noopener"` : "div"} class="rk-r" data-tip="${esc(x.tip)}"><span class="rk-t">${esc(x.titolo)}</span><span class="rk-m">${esc(x.meta)}</span><span class="rk-b"><i style="width:${(x.v / mx * 100).toFixed(2)}%"></i></span><span class="rk-v">${esc(fmt(x.v, unit, mx))}</span></${u ? "a" : "div"}></li>`; }).join("")}</ol>`;
}

/* tabella con i dati di un grafico: la stessa informazione senza colori né puntatore */
export const datiTab = (head: string[], rows: string[][], numFrom = 1) => `<details class="dati"><summary>Dati del grafico</summary><div class="table-wrap"><table><thead><tr>${head.map((h, i) => `<th${i >= numFrom ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.join("")}</tr>`).join("")}</tbody></table></div></details>`;
export const td = (v: any, unit?: string, ref?: number) => unit ? `<td class="num" data-v="${isNum(v) ? v : ""}">${isNum(v) ? fmt(v, unit, ref) : "non disponibile"}</td>` : `<td>${esc(v)}</td>`;
export const nota = (t: string) => `<p class="src keep ch-note">${esc(t)}</p>`;

/* ---------- comportamenti: suggerimento al passaggio e scelta della vista (bottoni data-vista) ---------- */
export function wireGrafici(root: HTMLElement, signal: AbortSignal) {
  const tip = document.getElementById("tip");
  const hide = () => { if (tip) tip.style.display = "none"; };
  const show = (e: PointerEvent) => {
    const t = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip]");
    if (!t || !tip) return hide();
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
  root.querySelectorAll<HTMLButtonElement>("[data-vista]").forEach(b => b.addEventListener("click", () => {
    const sec = b.closest("section")!;
    sec.querySelectorAll<HTMLButtonElement>("[data-vista]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    sec.querySelectorAll<HTMLElement>("[data-pannello]").forEach(p => { p.hidden = p.dataset.pannello !== b.dataset.vista; });
  }, { signal }));
}
