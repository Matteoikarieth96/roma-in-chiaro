"use client";
/* Una vista per pagina. L'HTML viene dagli stessi costruttori del sito statico (lib/pages.ts):
   è già nel file statico generato al build, e dopo il caricamento wire*() aggiunge mappa,
   ordinamento delle tabelle e icone info. */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { afterRender, htmlFonti, htmlHome, htmlMunicipio, htmlTutti, homeMetric, wireMap, type Nav } from "@/lib/pages";
import { htmlCerca, leggiParams, wireCerca } from "@/lib/search";
import { htmlFondo, wireFondo, type Programma } from "@/lib/fondi";
import { R, stripBase } from "@/lib/routes";
import { wireGrafici } from "@/lib/grafici";
import { montaMappa } from "@/lib/mappa-leaflet";

export function useNav(): Nav {
  const router = useRouter();
  return href => router.push(stripBase(href));
}

/* Inserisce l'HTML della pagina e lo collega. wire riceve un segnale che si chiude quando l'HTML cambia. */
function HtmlView({ html, wire }: { html: string; wire: (root: HTMLElement, signal: AbortSignal) => void }) {
  const ref = useRef<HTMLElement>(null);
  const wireRef = useRef(wire);
  wireRef.current = wire;
  useEffect(() => {
    const ac = new AbortController();
    if (ref.current) wireRef.current(ref.current, ac.signal);
    return () => ac.abort();
  }, [html]);
  return <main id="app" className="wrap" ref={ref} data-html="" dangerouslySetInnerHTML={{ __html: html }} />;
}

/* indicatore scelto sulla mappa: resta lo stesso tornando alla pagina iniziale, come nel sito statico */
let curMetric: string | null = null;

export function HomeView() {
  const [cur, setCur] = useState<string | null>(curMetric);
  const nav = useNav();
  const html = useMemo(() => htmlHome(cur), [cur]);
  return <HtmlView html={html} wire={(root, signal) => {
    curMetric = homeMetric(cur).id;
    root.querySelector("#pick")?.addEventListener("change", e => setCur((e.target as HTMLSelectElement).value), { signal });
    wireMap(root, signal, id => nav(R.mun(id)));
    montaMappa(root, signal, homeMetric(cur), id => nav(R.mun(id))); /* mappa con i quartieri al posto dell'SVG */
    afterRender(root);
  }} />;
}

export function MunicipioView({ id }: { id: string }) {
  const html = useMemo(() => htmlMunicipio(id), [id]);
  return <HtmlView html={html} wire={(root, signal) => { wireGrafici(root, signal); afterRender(root); }} />;
}

export function TuttiView() {
  const html = useMemo(() => htmlTutti(), []);
  return <HtmlView html={html} wire={root => afterRender(root)} />;
}

/* pagine dei fondi straordinari (PNRR, Giubileo 2025): grafici e tabelle da progetti.json */
export function FondoView({ prog }: { prog: Programma }) {
  const html = useMemo(() => htmlFondo(prog), [prog]);
  return <HtmlView html={html} wire={(root, signal) => { wireFondo(root, signal); afterRender(root); }} />;
}

export function FontiView() {
  const html = useMemo(() => htmlFonti(), []);
  return <HtmlView html={html} wire={root => afterRender(root, true)} />;
}

/* Tasto "/" premuto fuori dalla ricerca: la pagina di ricerca mette il cursore nella casella appena si apre. */
export const focusRicerca = { prossima: false };

export function CercaView() {
  const sp = useSearchParams();
  const { q, c } = leggiParams(new URLSearchParams(sp.toString()));
  const html = useMemo(() => htmlCerca(), []);
  const sync = useRef<((q: string, c: string) => void) | null>(null);
  const first = useRef(true);
  useEffect(() => {
    sync.current?.(q, c);
  }, [q, c]);
  return <HtmlView html={html} wire={(root, signal) => {
    sync.current = wireCerca(root, signal);
    sync.current(q, c);
    if (first.current && (focusRicerca.prossima || !q)) (root.querySelector("#s-q") as HTMLInputElement | null)?.focus();
    focusRicerca.prossima = false; first.current = false;
  }} />;
}
