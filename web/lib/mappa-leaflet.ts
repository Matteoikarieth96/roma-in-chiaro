/* Mappa interattiva della pagina iniziale, adattata da Quartieri di Roma 2026 di Urbe Hub
   (github.com/urbe-hub/quartieri-roma-2026, MIT; vedi THIRD_PARTY.md e lib/mappa.ts).
   Il file statico contiene la mappa SVG dei municipi (mapSvg in lib/engine.ts): resta come riserva.
   Nel browser questo modulo carica Leaflet e i confini (import dinamico, mai durante il build) e mette
   al suo posto una mappa con zoom, spostamento, i quartieri dentro ogni municipio e i loro nomi.
   I municipi hanno gli stessi colori e le stesse classi della legenda; un clic apre la scheda.
   Sul telefono: un dito scorre la pagina, due dita spostano e ingrandiscono la mappa, un tocco mostra
   il nome e il valore con il link alla scheda. Col mouse la rotella ingrandisce solo con Ctrl o ⌘. */
import type * as Leaf from "leaflet";
import "leaflet/dist/leaflet.css";
import "../components/Mappa.css";
import { IDS, ROMANI, breaks, esc, fmt, isNum, values, type Metric } from "./engine";
import { R } from "./routes";
import { TILE_ATTRIBUZIONE, TILE_URL } from "./mappa";

type Area = { c: string; n: string; t: string; m: number; l: [number, number]; g: [number, number][][][] };
type Mun = { m: number; l: [number, number]; g: [number, number][][][] };
type Richiesta = { panel: HTMLElement; m: Metric; onClick: (id: string) => void };
type Stato = {
  L: typeof Leaf; map: Leaf.Map; el: HTMLDivElement; mun: Record<string, Leaf.Polygon>;
  labQ: Leaf.LayerGroup; labM: Leaf.LayerGroup; m: Metric; byId: Record<string, any>; onClick: (id: string) => void;
  pop: Leaf.Popup; hint: HTMLDivElement;
};

let S: Stato | null = null;
let P: Promise<void> | null = null;
let cur: Richiesta | null = null;
let vivi = 0, kill = 0;
const TIPO: Record<string, string> = { quartiere: "quartiere", rione: "rione", "zona funzionale": "zona funzionale" };

export function montaMappa(root: HTMLElement, signal: AbortSignal, m: Metric, onClick: (id: string) => void) {
  const panel = root.querySelector<HTMLElement>(".panel.map"); if (!panel) return;
  const req: Richiesta = { panel, m, onClick };
  cur = req; vivi++; clearTimeout(kill);
  /* cambiando indicatore la pagina si ridisegna: la mappa resta la stessa (zoom compreso) e passa nel nuovo riquadro */
  signal.addEventListener("abort", () => {
    vivi = Math.max(0, vivi - 1); if (cur === req) cur = null;
    if (!vivi) kill = window.setTimeout(distruggi, 0);
  }, { once: true });
  if (S) { applica(S, req); return; }
  if (!P) P = carica().then(([L, Q, Mu]) => { P = null; if (cur && !S) { S = crea(L, Q, Mu, cur); applica(S, cur); } })
    .catch(() => { P = null; /* resta la mappa SVG */ });
}

function distruggi() { if (vivi || !S) return; S.map.remove(); S.el.remove(); S = null; }

async function carica(): Promise<[typeof Leaf, Area[], Mun[]]> {
  const [L, q, mu] = await Promise.all([import("leaflet"), import("../data/mappa-quartieri.json"), import("../data/mappa-municipi.json")]);
  return [((L as any).default || L) as typeof Leaf, (q as any).default?.aree || (q as any).aree, (mu as any).default?.municipi || (mu as any).municipi];
}

const conMouse = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const latlngs = (g: [number, number][][][]) => g as unknown as Leaf.LatLngExpression[][][];

function crea(L: typeof Leaf, Q: Area[], Mu: Mun[], req: Richiesta): Stato {
  const el = document.createElement("div");
  el.className = "mq-map";
  req.panel.querySelector(":scope > svg")?.replaceWith(el);
  if (!el.isConnected) req.panel.prepend(el);
  const mouse = conMouse();
  const map = L.map(el, {
    zoomControl: false, attributionControl: false, zoomSnap: 0.25, zoomDelta: 1, maxZoom: 17,
    dragging: mouse, touchZoom: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90, keyboard: true,
  });
  L.control.zoom({ position: "topleft", zoomInTitle: "Ingrandisci", zoomOutTitle: "Riduci" }).addTo(map);
  L.control.attribution({ prefix: `<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>` }).addTo(map);
  /* nessun prefetch: solo le tile della vista (policy d'uso delle tile di OpenStreetMap) */
  L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUZIONE, keepBuffer: 1 }).addTo(map);

  const st = { L, map, el, mun: {}, m: req.m, byId: {}, onClick: req.onClick } as Stato;
  const pop = st.pop = L.popup({ closeButton: true, autoPanPadding: [16, 16], className: "mq-pop", maxWidth: 260 });

  const evidenzia = (id: string, on: boolean) => { const p = st.mun[id]?.getElement(); if (p) p.classList.toggle("on", on); };
  const testo = (id: string, area?: Area) => {
    const v = st.byId[id];
    return `${area ? `<b>${esc(area.n)}</b> <span class="mq-t">${esc(TIPO[area.t] || area.t)}</span><br>` : ""}<b>Municipio ${ROMANI[id]}</b>: ${esc(fmt(v, st.m.unit))}`;
  };
  const tocco = (id: string, area: Area | undefined, ll: Leaf.LatLng) => {
    Object.keys(st.mun).forEach(k => evidenzia(k, k === id));
    const box = document.createElement("div");
    box.innerHTML = `<p>${testo(id, area)}</p><a class="mq-apri" href="${R.mun(id)}">Apri la scheda del Municipio ${ROMANI[id]}</a>`;
    box.querySelector("a")!.addEventListener("click", e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); st.onClick(id); });
    pop.setLatLng(ll).setContent(box).openOn(map);
  };
  pop.on("remove", () => Object.keys(st.mun).forEach(k => evidenzia(k, false)));
  const collega = (layer: Leaf.Polygon, id: string, area?: Area) => {
    if (mouse) {
      layer.bindTooltip(() => testo(id, area), { sticky: true, direction: "top", offset: [0, -12], className: "mq-tip", opacity: 1 });
      layer.on("mouseover", () => evidenzia(id, true));
      layer.on("mouseout", () => evidenzia(id, false));
      layer.on("click", () => st.onClick(id));
    } else layer.on("click", e => { L.DomEvent.stopPropagation(e); tocco(id, area, e.latlng); });
  };

  /* municipi: il colore dell'indicatore */
  const bounds = L.latLngBounds([]);
  for (const x of Mu) {
    const id = String(x.m);
    const layer = L.polygon(latlngs(x.g), { className: "mq-mun", weight: 1.6, fillOpacity: 1, smoothFactor: 0.5 }).addTo(map);
    st.mun[id] = layer; bounds.extend(layer.getBounds()); collega(layer, id);
  }
  /* quartieri, rioni e zone funzionali: solo il confine, il nome al passaggio o col tocco */
  for (const a of Q) {
    const layer = L.polygon(latlngs(a.g), { className: "mq-q" + (a.t === "zona funzionale" ? " mq-zf" : ""), weight: 0.7, fillOpacity: 0, smoothFactor: 0.5 }).addTo(map);
    collega(layer, String(a.m), a);
  }
  /* etichette: i numeri dei municipi da lontano, i nomi delle aree da vicino */
  const lab = (ll: [number, number], html: string, cls: string) => L.marker(ll, { icon: L.divIcon({ className: cls, html, iconSize: null as any }), interactive: false, keyboard: false });
  st.labM = L.layerGroup(Mu.map(x => lab(x.l, `<span>${ROMANI[x.m]}</span>`, "mq-lab mq-lab-m"))).addTo(map);
  st.labQ = L.layerGroup(Q.map(a => lab(a.l, `<span>${esc(a.n)}</span>`, "mq-lab mq-lab-q")));
  const perZoom = () => {
    const z = map.getZoom(), vicino = z >= 14;
    el.classList.toggle("mq-medio", z >= 12.5 && !vicino); el.classList.toggle("mq-vicino", vicino);
    if (vicino) { map.removeLayer(st.labM); map.addLayer(st.labQ); } else { map.removeLayer(st.labQ); map.addLayer(st.labM); }
  };
  map.on("zoomend", perZoom);

  map.fitBounds(bounds, { padding: [8, 8], animate: false });
  map.setMinZoom(Math.max(9, map.getZoom() - 0.5));
  map.setMaxBounds(bounds.pad(0.35));
  perZoom();

  /* suggerimenti: rotella senza Ctrl o ⌘ e un dito sul telefono scorrono la pagina */
  const hint = st.hint = document.createElement("div");
  hint.className = "mq-hint"; hint.setAttribute("aria-hidden", "true"); el.appendChild(hint);
  let hintT = 0;
  const mostra = (t: string) => { hint.textContent = t; hint.classList.add("on"); clearTimeout(hintT); hintT = window.setTimeout(() => hint.classList.remove("on"), 1400); };
  el.addEventListener("wheel", e => {
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation(); /* Leaflet non la riceve: scorre la pagina */
    mostra(/Mac|iPhone|iPad/.test(navigator.platform) ? "Per ingrandire: ⌘ + rotella o i tasti + e −" : "Per ingrandire: Ctrl + rotella o i tasti + e −");
  }, { capture: true, passive: true });
  if (!mouse) el.addEventListener("touchmove", e => { if (e.touches.length === 1 && !pop.isOpen()) mostra("Usa due dita per spostare la mappa"); }, { passive: true });
  return st;
}

function applica(st: Stato, req: Richiesta) {
  const svg = req.panel.querySelector(":scope > svg");
  if (svg) svg.replaceWith(st.el); else if (st.el.parentElement !== req.panel) req.panel.prepend(st.el);
  st.onClick = req.onClick; st.m = req.m;
  const vals = values(req.m), br = breaks(vals.map(r => r.v));
  st.byId = Object.fromEntries(vals.map(r => [r.id, r.v]));
  for (const id of IDS) {
    const v = st.byId[id], p = st.mun[id]?.getElement();
    if (p) p.setAttribute("data-c", isNum(v) ? String(1 + br.filter(b => v >= b).length) : "na");
  }
  st.el.setAttribute("aria-label", `Mappa interattiva dei 15 municipi e dei loro quartieri: ${req.m.label}`);
  st.el.setAttribute("role", "region");
  st.map.closePopup();
  st.map.invalidateSize({ animate: false } as any);
}
