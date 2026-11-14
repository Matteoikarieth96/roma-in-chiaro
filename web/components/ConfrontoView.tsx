"use client";
/* Pagina Confronta: l'HTML viene da lib/confronto.ts, come le altre pagine; qui solo l'inserimento nel DOM
   e il collegamento di selettori, tasto Scambia e mappa. */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { htmlConfronto, wireConfronto } from "@/lib/confronto";
import { stripBase } from "@/lib/routes";

export function ConfrontoView() {
  const sp = useSearchParams();
  const a = sp.get("a") || "1", b = sp.get("b") || "";
  const router = useRouter();
  const html = useMemo(() => htmlConfronto(a, b), [a, b]);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const ac = new AbortController();
    if (ref.current) wireConfronto(ref.current, ac.signal, a, b, href => router.push(stripBase(href)));
    return () => ac.abort();
  }, [html, a, b, router]);
  return <main id="app" className="wrap" ref={ref} data-html="" dangerouslySetInnerHTML={{ __html: html }} />;
}
