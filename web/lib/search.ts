/* ---------- ricerca (/cerca) ----------
   Porting di scripts/search.js: stessa normalizzazione, stessi testi. Usa l'indice costruito da
   scripts/build_search.py (generated/search-index.json, vedi RICERCA.md) e legge testi, importi e
   periodi da D, cioè dagli stessi snapshot delle altre pagine. Lo stato sta nell'indirizzo
   (/cerca/?q=...&c=...) invece che nel cancelletto. */
import { IX as INDEX } from "../generated/snapshots";
import { D, ROMANI, aLink, dateIt, esc, fEur, fInt, fonteHtml, isNum, safeUrl, srcLine } from "./engine";
import { R } from "./routes";
import type { Nav } from "./pages";

const IX: any = INDEX;
const ABBR: [RegExp, string][] = IX.abbr.map(([p, r]) => [new RegExp(p, "gi"), r]);
const CAT = { progetti: "P", quartieri: "Q", vie: "V" };
const CAT_NOME = { P: "Progetti", Q: "Quartieri", V: "Vie, piazze e parchi" };
const AREE = (D.quartieri && D.quartieri.aree) || [];
const LABEL = { titolo: "Titolo", luogo: "Luogo", attuatore: "Attuatore", municipio_evidenza: "Testo della fonte sul municipio",
  oggetto: "Oggetto", centro_di_costo: "Centro di costo", etichetta: "Etichetta", denominazione: "Denominazione", motivo: "Motivo",
  presidente: "Presidente", presidente_deleghe: "Deleghe", nome: "Nome", ruolo: "Ruolo", deleghe: "Deleghe", gruppo: "Gruppo",
  gruppo_da_simbolo: "Gruppo", codice: "Codice", misura: "Cosa misura", non_misura: "Cosa non misura", tabella: "Tabella", periodo: "Periodo" };
const IMP_LABEL = { prog: "Importo del programma", cig: "Importo", voce: "Importo" };

/* ---- normalizzazione: stessa di build_search.py (abbreviazioni, accenti, minuscole) ---- */
function espandiMap(s: string): [string, number[]] {
  let t = s, p: number[] = [];
  for (let i = 0; i < s.length; i++) p.push(i); // indici UTF-16, come normMap
  for (const [rx, r] of ABBR) {
    rx.lastIndex = 0;
    let out = "", op: number[] = [], last = 0, m;
    while ((m = rx.exec(t))) {
      if (!m[0]) { rx.lastIndex++; continue; }
      out += t.slice(last, m.index); op.push(...p.slice(last, m.index));
      for (let k = 0; k < r.length; k++) op.push(p[m.index + Math.min(k, m[0].length - 1)]);
      out += r; last = m.index + m[0].length;
    }
    out += t.slice(last); op.push(...p.slice(last));
    t = out; p = op;
  }
  return [t, p];
}
function normMap(s: string): [string, number[]] {
  const out: string[] = [], pos: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const c of s[i].normalize("NFD").toLowerCase()) {
      if (/[̀-ͯ]/.test(c)) continue;
      if ((c >= "a" && c <= "z") || (c >= "0" && c <= "9")) { out.push(c); pos.push(i); }
      else if (out.length && out[out.length - 1] !== " ") { out.push(" "); pos.push(i); }
    }
  }
  while (out.length && out[out.length - 1] === " ") { out.pop(); pos.pop(); }
  return [out.join(""), pos];
}
const norm = (s: any) => normMap(espandiMap(String(s ?? ""))[0])[0];
// stesso nome scritto in due modi (come VARIANTI in build_search.py): vale solo per il confronto
const varianti = (n: string) => n.replace(/pamphilj/g, "pamphili");

/* ---- documenti: puntatori ai record degli snapshot ---- */
const get = (path: string) => path.split("/").reduce((o, k) => (o == null ? o : o[Array.isArray(o) ? +k : k]), D as any);
const pathDoc = d => IX.sez[d[0]].path.replace(/\{(\d+)\}/g, (_, i) => d[2][+i]);
const piatto = v => Array.isArray(v) ? v.filter(Boolean).join(" · ") : (v && typeof v === "object" ? Object.values(v).filter(Boolean).join(" · ") : (v == null ? "" : String(v)));
const cacheCampi = new Map<number, { c: string; v: string; n: string }[]>();
function campi(di: number) {
  if (cacheCampi.has(di)) return cacheCampi.get(di)!;
  const d = IX.doc[di], s = IX.sez[d[0]], path = pathDoc(d), rec = get(path);
  const out = s.campi.map(c => {
    const v = c === "@chiave" ? path.split("/").pop() : piatto(rec && typeof rec === "object" ? rec[c] : "");
    return { c, v, n: norm(v) };
  }).filter(x => x.v);
  cacheCampi.set(di, out);
  return out;
}
let testiDoc: string[] | null = null;
const testoNorm = di => campi(di).map(x => x.n).join(" | ");

/* ---- nomi delle tre categorie ---- */
let ENT: any = null;
function entita() {
  if (ENT) return ENT;
  const Qmap = new Map<number, any>(IX.Q.map(([ai, docs, inVia]) => [ai, { docs, inVia: new Set(inVia) }]));
  ENT = {
    P: IX.P.map(docs => { const r = get(pathDoc(IX.doc[docs[0]])); return { cat: "P", nome: r.titolo, n: norm(r.titolo), docs, rec: r }; }),
    Q: AREE.map((a, ai) => { const q = Qmap.get(ai); return { cat: "Q", nome: a.nome, n: norm(a.nome), docs: q ? q.docs : [], inVia: q ? q.inVia : new Set(), area: a,
      parti: a.nome.split(/\s+-\s+/).map(norm).filter(Boolean) }; }),
    V: IX.V.map(([nome, mun, docs, fonte]) => ({ cat: "V", nome, n: norm(nome), docs, mun, fonte })),
  };
  return ENT;
}
function cerca(qn: string) {
  const E = entita(), res: any = {};
  for (const k of ["P", "Q", "V"]) {
    // "rione Monti", "quartiere Prati": per i quartieri conta il nome, non la parola che lo precede
    const q = varianti(k === "Q" ? qn.replace(/^(rione|quartiere|zona|localita|borgata|frazione) (?=\S)/, "") : qn);
    const tok = q.split(" ").filter(Boolean);
    res[k] = E[k].filter(e => tok.every(t => varianti(e.n).includes(t)))
      .map(e => { const n = varianti(e.n); return { e, r: n === q ? 0 : n.startsWith(q) ? 1 : (" " + n + " ").includes(" " + q + " ") ? 2 : 3 }; })
      .sort((a, b) => a.r - b.r || b.e.docs.length - a.e.docs.length || a.e.nome.localeCompare(b.e.nome, "it"))
      .map(x => x.e);
  }
  return res;
}
function altre(qn: string, gia: Set<number>) {
  if (qn.length < 3) return [];
  if (!testiDoc) testiDoc = IX.doc.map((_, i) => testoNorm(i));
  const rx = new RegExp("(^|[^a-z0-9])" + qn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const out: number[] = [];
  testiDoc!.forEach((t, i) => { if (!gia.has(i) && rx.test(t)) out.push(i); });
  return out;
}

/* ---- suggerimenti per grafie vicine ---- */
function lev(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function suggerimenti(qn: string) {
  const max = qn.length <= 4 ? 1 : qn.length <= 8 ? 2 : 3, nq = qn.split(" ").length, E = entita(), out: any[] = [];
  for (const e of [...E.Q, ...E.V]) {
    const w = e.n.split(" ");
    let d = lev(qn, e.n, max);
    for (let i = 0; i + nq <= w.length && d > 0; i++) d = Math.min(d, lev(qn, w.slice(i, i + nq).join(" "), max));
    if (d <= max) out.push({ e, d });
  }
  const visti = new Set();
  return out.sort((a, b) => a.d - b.d || b.e.docs.length - a.e.docs.length)
    .filter(x => !visti.has(x.e.nome) && visti.add(x.e.nome)).slice(0, 6).map(x => x.e);
}

/* ---- evidenziazione nel testo originale ---- */
function evidenzia(text: string, needles: string[], lim?: number) {
  const [t, p] = espandiMap(text), [n, np] = normMap(t);
  let spans: number[][] = [];
  for (const nd of needles) {
    if (!nd) continue;
    for (let i = n.indexOf(nd); i >= 0; i = n.indexOf(nd, i + nd.length)) spans.push([p[np[i]], p[np[i + nd.length - 1]] + 1]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  spans = spans.reduce((acc: number[][], s) => { const l = acc[acc.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else acc.push(s.slice()); return acc; }, []);
  let a = 0, b = text.length;
  if (lim && text.length > lim) {
    const c = spans.length ? spans[0][0] : 0;
    a = Math.max(0, c - Math.round(lim * 0.35));
    if (a > 0) { const sp = text.lastIndexOf(" ", a); a = sp > a - 20 && sp >= 0 ? sp + 1 : a; }
    b = Math.min(text.length, a + lim);
    if (b < text.length) { const sp = text.indexOf(" ", b); b = sp >= 0 && sp < b + 20 ? sp : b; }
  }
  let html = a > 0 ? "… " : "", cur = a;
  for (const [x, y] of spans) {
    if (y <= a || x >= b) continue;
    const xx = Math.max(x, a), yy = Math.min(y, b);
    html += esc(text.slice(cur, xx)) + "<mark>" + esc(text.slice(xx, yy)) + "</mark>"; cur = yy;
  }
  html += esc(text.slice(cur, b)) + (b < text.length ? " …" : "");
  return { html, hit: spans.length > 0 };
}

/* ---- una citazione ---- */
const munTxt = m => Array.isArray(m) ? "Mun. " + m.map(x => ROMANI[x]).join(", ") : m > 0 ? "Mun. " + ROMANI[m] : "Roma";
function linkDoc(d, s): [string, string] {
  if (s.id === "prog_citta") return [R.home, "Pagina iniziale"];
  if (s.id === "meta" || s.id === "ann" || s.id === "cig_roma") return [R.fonti, "Fonti e metodo"];
  return isNum(d[1]) && d[1] > 0 ? [R.mun(d[1]), "Scheda del Municipio " + ROMANI[d[1]]] : [R.fonti, "Fonti e metodo"];
}
const snapDi = d => IX.sez[d[0]].snap || d[2][0];
function periodoDi(d) {
  const p = (D[snapDi(d)] || {}).periodo;
  if (!p || typeof p === "string") return "";
  const k = d[2].find(v => p[v]);
  return k ? k + ": " + p[k] : "";
}
function citazione(di: number, needles: string[], extraNota?: ((di: number) => string) | null) {
  const d = IX.doc[di], s = IX.sez[d[0]], rec = get(pathDoc(d)), C = campi(di);
  let scelto: any = null;
  for (const nd of needles) { if (!nd) continue; scelto = C.find(x => x.n.includes(nd)); if (scelto) break; }
  const titoloC = (s.titolo && C.find(x => x.c === s.titolo)) || C[0];
  let html = "";
  if (!scelto || scelto === titoloC) html += `<span class="t">${evidenzia(titoloC ? titoloC.v : "", needles, 260).html}</span>`;
  else html += `<span class="t">${evidenzia(titoloC.v, [], 160).html}</span><span class="t sn">${esc(LABEL[scelto.c] || scelto.c)}: ${evidenzia(scelto.v, needles, 240).html}</span>`;
  const x: string[] = [];
  if (s.imp) {
    const v = s.imp === "@valore" ? rec : rec && rec[s.imp];
    x.push(s.unita ? `${isNum(v) ? fInt.format(v) : "n.d."} ${esc(s.unita)}` : `${esc(s.tipo === "voce" && s.id.startsWith("peg") ? "Competenza 2026" : IMP_LABEL[s.tipo] || "Importo")} ${isNum(v) ? fEur.format(v) : "n.d."}`);
  }
  if (s.tipo === "cig" && rec) { if (rec.cig) x.push("CIG " + esc(rec.cig)); if (rec.data_pubblicazione) x.push("pubblicato il " + dateIt(rec.data_pubblicazione)); }
  if (s.tipo === "prog" && rec) { if (rec.cup && rec.cup.length) x.push("CUP " + esc(piatto(rec.cup))); if (/\d/.test(rec.periodo || "")) x.push("attuazione " + esc(rec.periodo)); if (rec.stato) x.push(esc(rec.stato)); if (rec.nota) x.push(esc(rec.nota)); }
  const per = periodoDi(d);
  if (per) x.push("periodo dei dati " + esc(per));
  if (s.id === "meta" || s.id === "ann") {
    const sn = D[snapDi(d)];
    if (s.id === "meta" && sn && sn.fonte) x.push("Fonte: " + fonteHtml(sn.fonte));
  }
  const [href, txt] = linkDoc(d, s), nasc = d[3] === 1;
  const dove = nasc ? s.dove_nascosto : s.dove;
  const ext = s.tipo === "prog" && rec && safeUrl(rec.link) ? " · " + aLink(safeUrl(rec.link), "scheda del progetto sulla fonte") : "";
  return `<li><span class="w">${esc(munTxt(d[1]))}</span>${html}
      ${x.length ? `<span class="x">${x.join(" · ")}</span>` : ""}
      <span class="x"><a href="${href}">${esc(txt)}</a>${ext}${dove ? ` · <span class="dove">${esc(dove)}</span>` : ""}${extraNota && extraNota(di) ? ` · <span class="dove">${esc(extraNota(di))}</span>` : ""}</span></li>`;
}
/* citazioni raggruppate per sezione, con la fonte e il periodo di ogni sezione */
function gruppi(docs: number[], needles: string[], extraNota?: ((di: number) => string) | null) {
  const per = new Map<number, number[]>();
  for (const di of docs) { const k = IX.doc[di][0]; if (!per.has(k)) per.set(k, []); per.get(k)!.push(di); }
  return [...per.entries()].sort((a, b) => a[0] - b[0]).map(([k, l]) => {
    const s = IX.sez[k];
    l.sort((a, b) => { const ma = IX.doc[a][1], mb = IX.doc[b][1]; return (Array.isArray(ma) ? ma[0] : ma) - (Array.isArray(mb) ? mb[0] : mb) || a - b; });
    const src = s.snap ? srcLine(s.snap, typeof (D[s.snap] || {}).periodo === "string" ? "" : "periodo indicato in ogni riga") : "";
    return `<div class="s-grp"><h3>${esc(s.nome)} <small>${esc(s.gruppo)} · ${l.length} ${l.length === 1 ? "citazione" : "citazioni"}</small></h3>${src}
        <ul class="s-cit">${l.map(di => citazione(di, needles, extraNota)).join("")}</ul></div>`;
  }).join("");
}

/* ---- schede dei nomi ---- */
const PREP = new Set(["di", "de", "del", "della", "dei", "degli", "delle", "dello", "dell", "d", "a", "al", "alla", "in", "e"]);
function needlesDi(e, qtok: string[]) {
  if (e.cat === "P") return [qtok.join(" "), ...qtok];
  if (e.cat === "Q") return [e.n, ...e.parti.filter(x => x !== e.n), ...qtok];
  const w = e.n.split(" "), senza = w.filter(x => !PREP.has(x)).join(" ");
  return [e.n, senza, w.slice(1).filter(x => !PREP.has(x)).join(" "), w[w.length - 1], ...qtok];
}
function scheda(e, qtok: string[], aperta: boolean) {
  const n = e.docs.length, cit = `${n} ${n === 1 ? "citazione" : "citazioni"}`;
  let meta = "";
  if (e.cat === "Q") meta = `${esc(e.area.tipo[0].toUpperCase() + e.area.tipo.slice(1))} del Municipio ${ROMANI[e.area.municipio] || "?"}, nome ufficiale da ${fonteHtml(D.quartieri.fonte)}`;
  if (e.cat === "V") meta = e.fonte === 0 ? `Nome ufficiale dello stradario di Roma Capitale${e.mun.length ? ", attraversa " + (e.mun.length === 1 ? "il Municipio " : "i Municipi ") + e.mun.map(m => ROMANI[m]).join(", ") : ""}`
    : "Nome trovato nel testo dei dati: parchi, ville e giardini non sono nello stradario";
  if (e.cat === "P" && n > 1) meta = "Stesso titolo in più schede di municipio o in più elenchi";
  const nota = e.cat === "Q" && e.inVia.size ? di => e.inVia.has(di) ? "il nome compare solo dentro il nome di una via" : "" : null;
  const body = n ? gruppi(e.docs, needlesDi(e, qtok), nota) : `<p class="na-note">Nessuna citazione nei dati del sito.</p>`;
  return `<details class="s-ent"${aperta ? " open" : ""}><summary><span class="n">${evidenzia(e.nome, [qtok.join(" "), ...qtok]).html}</span><span class="c">${cit}</span></summary>
      ${meta ? `<p class="meta">${meta}</p>` : ""}<div class="body">${body}</div></details>`;
}

/* ---- pagina ---- */
const LIM = 15;
export const ICONA = `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12.8 12.8l4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ESEMPI = ["Tor Bella Monaca", "Ostia", "Villa Borghese", "Via Tiburtina", "Parco degli Acquedotti", "Corviale", "San Lorenzo"];
const qLink = (q: string, c?: string) => R.cerca(new URLSearchParams(c ? { q, c } : { q }).toString());

export function leggiParams(p: URLSearchParams) {
  const c = p.get("c") || "";
  return { q: p.get("q") || "", c: CAT[c] ? c : "" };
}

export function htmlCerca() {
  const fq = D.quartieri && D.quartieri.fonte;
  return `
    <div class="hero"><p class="eyebrow">Ricerca</p><h1>Cerca un <em>luogo</em> o un progetto</h1>
    <p class="lede">Scrivi il nome di un progetto, di un quartiere, di una via, di una piazza o di un parco: trovi tutti i punti dei dati del sito in cui è citato.</p></div>
    <form class="s-form" role="search">
      <label class="s-box"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Cerca nei dati del sito</span>${ICONA}
        <input id="s-q" type="search" autocomplete="off" spellcheck="false" placeholder="Es. Ostia, Via Tiburtina, Villa Borghese" aria-describedby="s-note"><kbd aria-hidden="true">/</kbd></label>
      <div class="s-chips" role="group" aria-label="Categoria" id="s-chips"></div>
      <ul class="s-notes" id="s-note">
        <li>La ricerca copre solo i dati di questo sito: progetti con fondi straordinari, i CIG più grandi di ANAC, bilancio PEG 2026, nidi, organi politici e descrizioni delle fonti.</li>
        <li>Un luogo citato non vuol dire che il progetto o l'appalto si trovi lì: il nome può indicare un confine, un tratto di strada, una sede o un esempio.</li>
        <li>I nomi dei quartieri vengono da ${fq ? fonteHtml(fq) : "n.d."}; le vie dallo stradario di Roma Capitale. Parchi, ville e giardini che lo stradario non ha sono presi dal testo dei dati.</li>
      </ul>
    </form>
    <div id="s-res"></div>`;
}

/* Collega la pagina di ricerca già nel DOM. Restituisce sync(q, c), da chiamare quando cambia l'indirizzo. */
export function wireCerca(root: HTMLElement, signal: AbortSignal) {
  const stato = { q: "", c: "", mostra: {} as Record<string, boolean>, pronto: false };
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const inp = $("#s-q") as HTMLInputElement;
  const scrivi = () => {
    const u = stato.q.trim() ? qLink(stato.q.trim(), stato.c) : R.cerca(stato.c ? "c=" + stato.c : "");
    if (location.pathname + location.search !== u) history.replaceState(history.state, "", u);
  };
  function chips(cnt: any) {
    const tot = cnt ? cnt.P + cnt.Q + cnt.V : null;
    const b = (c, nome, n) => `<button type="button" data-c="${c}" aria-pressed="${stato.c === c}">${esc(nome)}${n == null ? "" : `<b>${fInt.format(n)}</b>`}</button>`;
    $("#s-chips").innerHTML = b("", "Tutte", tot) + Object.entries(CAT).map(([c, k]) => b(c, CAT_NOME[k], cnt ? cnt[k] : null)).join("");
  }
  function risultati() {
    const box = $("#s-res"), q = stato.q.trim(), qn = norm(q);
    if (qn.length < 2) {
      chips(null);
      box.innerHTML = `<p class="s-sum">Scrivi almeno due lettere. Prova con:</p><div class="s-try">${ESEMPI.map(x => `<a href="${qLink(x)}">${esc(x)}</a>`).join("")}</div>`;
      return;
    }
    const qtok = qn.split(" ").filter(Boolean), Rs = cerca(qn);
    const cnt = { P: Rs.P.length, Q: Rs.Q.length, V: Rs.V.length };
    chips(cnt);
    const cats = stato.c ? [CAT[stato.c]] : ["P", "Q", "V"];
    const gia = new Set<number>();
    let html = "", nNomi = 0;
    for (const k of cats) {
      const L = Rs[k]; if (!L.length) continue;
      L.forEach(e => e.docs.forEach(d => gia.add(d)));
      const citK = L.reduce((s, e) => s + e.docs.length, 0);
      nNomi += L.length;
      const vis = stato.mostra[k] ? L : L.slice(0, LIM);
      html += `<section class="s-cat" aria-labelledby="s-h-${k}"><h2 id="s-h-${k}">${CAT_NOME[k]} <small>${fInt.format(L.length)} ${L.length === 1 ? "nome" : "nomi"}, ${fInt.format(citK)} ${citK === 1 ? "citazione" : "citazioni"}</small></h2>
        ${vis.map((e, i) => scheda(e, qtok, i === 0 && (nNomi - L.length) === 0 && e.docs.length > 0 && e.docs.length <= 60)).join("")}
        ${vis.length < L.length ? `<button type="button" class="s-more" data-more="${k}">Mostra gli altri ${fInt.format(L.length - vis.length)}</button>` : ""}</section>`;
    }
    const nCit = gia.size;
    let nAltre = 0;
    if (!stato.c) {
      const Al = altre(qn, gia); nAltre = Al.length;
      if (Al.length) {
        const vis = stato.mostra.A ? Al : Al.slice(0, 40);
        html += `<section class="s-cat" aria-labelledby="s-h-A"><h2 id="s-h-A">Altre citazioni nel testo <small>${fInt.format(Al.length)}</small></h2>
          <p class="meta" style="color:var(--muted);font-size:13px">Righe che contengono la parola cercata ma non sono legate a uno dei nomi qui sopra (anche bilancio, organi politici e descrizioni delle fonti).</p>
          ${gruppi(vis, [qn, ...qtok])}
          ${vis.length < Al.length ? `<button type="button" class="s-more" data-more="A">Mostra le altre ${fInt.format(Al.length - vis.length)}</button>` : ""}</section>`;
      }
    }
    if (!nNomi && !nAltre) {
      const altrove = stato.c ? Object.keys(CAT).filter(c => Rs[CAT[c]].length) : [];
      const S = suggerimenti(qn);
      box.innerHTML = `<div class="s-empty" role="status"><h2>Nessun risultato per «${esc(q)}»${stato.c ? " in " + esc(CAT_NOME[CAT[stato.c]]) : ""}</h2>
        ${altrove.length ? `<p>Ci sono risultati in: ${altrove.map(c => `<a href="${qLink(q, c)}">${esc(CAT_NOME[CAT[c]])}</a>`).join(", ")}, oppure in <a href="${qLink(q)}">tutte le categorie</a>.</p>` : ""}
        ${S.length ? `<p>Forse cercavi:</p><div class="s-sugg">${S.map(e => `<a href="${qLink(e.nome)}">${esc(e.nome)}</a>`).join("")}</div>` : `<p>Nessun nome simile tra quartieri, vie, piazze e parchi.</p>`}
        <p class="src">La ricerca guarda solo i dati di questo sito: un luogo che non compare qui può comunque avere progetti o appalti non inclusi.</p></div>`;
      return;
    }
    const plur = (n, s, p) => `${fInt.format(n)} ${n === 1 ? s : p}`;
    const sintesi = !nNomi ? `nessun nome tra progetti, quartieri e vie; ${plur(nAltre, "citazione", "citazioni")} nel testo`
      : `${plur(nNomi, "nome", "nomi")} ${nCit ? "con " + plur(nCit, "citazione distinta", "citazioni distinte") : (nNomi === 1 ? "trovato" : "trovati") + ", ma nessuna citazione nei dati del sito"}`
        + (nAltre ? `, più ${plur(nAltre, "altra citazione", "altre citazioni")} nel testo` : "");
    box.innerHTML = `<p class="s-sum" role="status">«${esc(q)}»: ${sintesi}</p>` + html;
  }

  let t: ReturnType<typeof setTimeout> | undefined;
  $(".s-form").addEventListener("submit", ev => ev.preventDefault(), { signal });
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { stato.q = inp.value; stato.mostra = {}; scrivi(); risultati(); }, 140); }, { signal });
  inp.addEventListener("keydown", ev => { if (ev.key === "Enter") { clearTimeout(t); stato.q = inp.value; scrivi(); risultati(); } }, { signal });
  $("#s-chips").addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("button[data-c]"); if (!b) return;
    stato.c = b.dataset.c || ""; stato.mostra = {}; scrivi(); risultati();
  }, { signal });
  $("#s-res").addEventListener("click", ev => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("button[data-more]"); if (!b) return;
    stato.mostra[b.dataset.more!] = true; risultati();
  }, { signal });
  signal.addEventListener("abort", () => clearTimeout(t));

  /* l'indirizzo è cambiato (link, indietro/avanti, primo caricamento): rifà i risultati solo se q o c sono diversi */
  return function sync(q: string, c: string) {
    if (stato.pronto && q === stato.q.trim() && c === stato.c) return;
    stato.q = q; stato.c = c; stato.mostra = {}; stato.pronto = true;
    if (inp.value !== q) inp.value = q;
    risultati();
  };
}
