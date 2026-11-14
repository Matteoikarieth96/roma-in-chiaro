"use client";
/* Cornice di tutte le pagine: barra in alto, menu a sinistra (pannello sotto i 960px), piè di pagina,
   finestra delle icone info. */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { REPO_URL, safeUrl } from "@/lib/engine";
import { BASE, R, fromHash, stripBase } from "@/lib/routes";
import { focusRicerca } from "./views";

type Item = { href: string; label: string; icon: ReactNode; on: (p: string) => boolean };
const ic = (d: ReactNode) => <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

/* Voci del menu, in due gruppi. Un gruppo vuoto non viene mostrato. */
const NAV: { titolo?: string; voci: Item[] }[] = [
  { voci: [
    { href: "/", label: "Mappa", on: p => p === "/", icon: ic(<><path d="M2.75 5.25 7.25 3.5l5.5 2 4.5-1.75v11L12.75 16.5l-5.5-2-4.5 1.75z" /><path d="M7.25 3.5v11M12.75 5.5v11" /></>) },
    { href: "/municipio/1/", label: "Schede", on: p => p.startsWith("/municipio/"), icon: ic(<><rect x="4.25" y="2.75" width="11.5" height="14.5" rx="2.25" /><path d="M7.5 7h5M7.5 10h5M7.5 13h3" /></>) },
    { href: "/tutti/", label: "Tutti i municipi", on: p => p.startsWith("/tutti"), icon: ic(<><rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" /><path d="M2.75 8h14.5M2.75 12h14.5M7.75 3.75v12.5" /></>) },
    { href: "/confronto/", label: "Confronta", on: p => p.startsWith("/confronto"), icon: ic(<><path d="M6 3.5v13M14 3.5v13" /><path d="M3.5 6 6 3.5 8.5 6M11.5 14l2.5 2.5 2.5-2.5" /></>) },
    { href: "/fonti/", label: "Fonti", on: p => p.startsWith("/fonti"), icon: ic(<><path d="M4 4.75A1.75 1.75 0 0 1 5.75 3H16v11.5H5.75A1.75 1.75 0 0 0 4 16.25z" /><path d="M4 16.25A1.75 1.75 0 0 0 5.75 18H16" /></>) },
  ] },
  { titolo: "Fondi straordinari", voci: [
    { href: "/pnrr/", label: "PNRR", on: p => p.startsWith("/pnrr"), icon: ic(<><path d="M3 16.5h14" /><path d="M5 16.5V9.5M10 16.5V6M15 16.5V11.5" /><path d="M3.5 7.5 10 3l6.5 4.5" /></>) },
    { href: "/giubileo-2025/", label: "Giubileo 2025", on: p => p.startsWith("/giubileo-2025"), icon: ic(<><path d="M10 2.75v5.5M7.25 5.5h5.5" /><path d="M4 17.25V11a6 6 0 0 1 12 0v6.25" /><path d="M2.75 17.25h14.5" /></>) },
  ] },
];

/* Contatti, in fondo alla colonna del menu. Il codice diventa un link quando REPO_URL (lib/engine.ts) è impostato. */
export const EMAIL = "matteo.dandreta@gmail.com";
export const TELEGRAM = "https://t.me/+X7hXSib0Q-o5MTQ0";
const IC_MAIL = ic(<><rect x="2.75" y="4.25" width="14.5" height="11.5" rx="2" /><path d="m3.5 5.5 6.5 5 6.5-5" /></>);
const IC_CHAT = ic(<><path d="M17.25 3 2.75 9l5.5 2 2 5.75z" /><path d="M8.25 11 17.25 3" /></>);
const IC_CODE = ic(<path d="M7 6 3 10l4 4M13 6l4 4-4 4" />);

const MOBILE = "(max-width: 959px)";
/* colonna del menu chiusa sul computer: data-menu="chiuso" su <html> (messo prima del primo disegno da app/layout.tsx) */
const leggiChiuso = () => typeof document !== "undefined" && document.documentElement.dataset.menu === "chiuso";
/* "/municipio/3" e "/municipio/3/" valgono uguale */
const normPath = (p: string) => (p === "/" ? "/" : p.replace(/\/*$/, "/"));

export default function Shell({ children, logo }: { children: ReactNode; logo: { src: string; width: number; height: number } }) {
  const router = useRouter();
  const path = normPath(usePathname() || "/");
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [chiuso, setChiuso] = useState(false);
  useEffect(() => { setChiuso(leggiChiuso()); }, []);
  /* pulsante del menu: sul telefono apre il pannello, sul computer apre e chiude la colonna e lo ricorda */
  const toggleMenu = () => {
    if (mobile) { setOpen(true); return; }
    const c = !chiuso, r = document.documentElement;
    if (c) r.dataset.menu = "chiuso"; else delete r.dataset.menu;
    try { localStorage.setItem("menu", c ? "chiuso" : "aperto"); } catch { /* archivio non disponibile: vale fino al prossimo caricamento */ }
    setChiuso(c);
  };
  const sideRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const onCerca = path.startsWith("/cerca");

  /* vecchi indirizzi con il cancelletto: #/municipio/6 porta a /municipio/6/ */
  useEffect(() => {
    if (location.pathname !== BASE + "/" && location.pathname !== BASE) return;
    const to = fromHash(location.hash);
    if (to) router.replace(stripBase(to));
  }, [router]);

  useEffect(() => {
    const mq = matchMedia(MOBILE);
    const set = () => { setMobile(mq.matches); if (!mq.matches) setOpen(false); };
    set(); mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  /* il fuoco torna al pulsante del menu dopo il nuovo disegno: prima la barra in alto è ancora inert */
  const rendi = useRef(false);
  const close = useCallback((focusBtn = true) => { rendi.current = focusBtn; setOpen(false); }, []);
  useEffect(() => { if (!open && rendi.current) { rendi.current = false; btnRef.current?.focus(); } }, [open]);

  /* pannello aperto: Esc chiude, Tab resta dentro il pannello, la pagina sotto non scorre */
  useEffect(() => {
    if (!open || !mobile) return;
    const side = sideRef.current!;
    const focusables = () => [...side.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
    (side.querySelector<HTMLElement>('a[aria-current="page"]') || focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); html.style.overflow = prev; };
  }, [open, mobile, close]);

  /* link interni dentro le pagine e nelle finestre info: navigazione senza ricaricare la pagina */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !a.closest("[data-html],#pop") || (a.target && a.target !== "_self")) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith(BASE + "/")) return;
      e.preventDefault();
      router.push(stripBase(href));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  /* tasto "/": apre la ricerca o mette il cursore nella casella */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "/" || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      ev.preventDefault();
      const inp = document.getElementById("s-q") as HTMLInputElement | null;
      if (inp) { inp.focus(); inp.select(); }
      else { focusRicerca.prossima = true; router.push("/cerca/"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const toggleTheme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("tema", r.dataset.theme); } catch { /* archivio non disponibile */ }
  };

  const drawer = mobile && open;
  const repo = safeUrl(REPO_URL);

  return (
    <>
      <header className="topbar" inert={drawer || undefined}><div className="in">
        <button ref={btnRef} className="theme menu-btn" type="button" aria-label={!mobile && !chiuso ? "Chiudi il menu" : "Apri il menu"} aria-controls="menu"
          aria-expanded={mobile ? drawer : !chiuso} onClick={toggleMenu}>
          <svg className="ic-burger" viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          <svg className="ic-side" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.25" /><path d="M7.75 3.75v12.5" /></svg>
        </button>
        <Link className="brand" href="/"><strong>Roma in chiaro</strong><small>I conti dei 15 Municipi di Roma</small></Link>
        <div className="donor"><span>un progetto di</span><img src={logo.src} alt="Urbe Hub" width={126} height={21} /></div>
        <div className="tools">
          <Link id="search-btn" className="theme search-btn" href="/cerca/" aria-label="Cerca" aria-keyshortcuts="/" title="Cerca (tasto /)"
            aria-current={onCerca ? "page" : undefined}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12.8 12.8l4.4 4.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </Link>
          <button className="theme" type="button" id="theme" aria-label="Cambia tema" onClick={toggleTheme}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 2.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" /></svg>
          </button>
        </div>
      </div></header>

      <div className="frame">
        <aside ref={sideRef} id="menu" className="side" data-open={drawer ? "true" : undefined}
          {...(mobile ? { role: "dialog", "aria-modal": drawer ? true : undefined, "aria-label": "Menu", "aria-hidden": drawer ? undefined : true } : {})}>
          <div className="side-head">
            <strong>Roma in chiaro</strong>
            <button className="theme" type="button" aria-label="Chiudi il menu" onClick={() => close()}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </button>
          </div>
          <nav aria-label="Sezioni">
            {NAV.filter(g => g.voci.length).map((g, i) => (
              <div className="grp" key={i}>
                {g.titolo && <p className="grp-t">{g.titolo}</p>}
                <ul>{g.voci.map(v => (
                  <li key={v.href}><Link href={v.href} aria-current={v.on(path) ? "page" : undefined} onClick={() => setOpen(false)}>{v.icon}<span>{v.label}</span></Link></li>
                ))}</ul>
              </div>
            ))}
          </nav>
          <div className="grp contatti">
            <p className="grp-t">Contatti</p>
            <ul>
              <li><a href={"mailto:" + EMAIL}>{IC_MAIL}<span>Segnalazioni, correzioni e nuovi dati: scrivi a<small>{EMAIL.split("@")[0]}@<wbr />{EMAIL.split("@")[1]}</small></span></a></li>
              <li><a href={TELEGRAM} target="_blank" rel="noopener noreferrer">{IC_CHAT}<span>Gruppo Telegram di Urbe Hub</span></a></li>
              <li>{repo
                ? <a href={repo} target="_blank" rel="noopener noreferrer">{IC_CODE}<span>Codice su GitHub</span></a>
                : <span className="side-txt">{IC_CODE}<span>Codice su GitHub: in arrivo</span></span>}</li>
            </ul>
          </div>
        </aside>
        <div className="scrim" hidden={!drawer} onClick={() => close()} aria-hidden="true" />

        <div className="content" inert={drawer || undefined}>
          {children}
          <footer><div className="wrap">
            <p className="indip"><strong>Sito indipendente, non è un sito di Roma Capitale.</strong> Non usa stemmi, loghi o marchi di Roma Capitale.</p>
            <p>Ogni numero viene da un documento ufficiale: la fonte, il periodo e i limiti sono scritti sotto ogni blocco. Un valore insolito indica dove guardare meglio, non dimostra da solo uno spreco o un illecito.</p>
            <p>Copyright 2026 contributori di Roma in chiaro, un progetto di Urbe Hub. Codice sotto licenza <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener">GNU AGPL-3.0</a>. Software fornito senza alcuna garanzia. <span id="repo-link">{repo ? <a href={repo} target="_blank" rel="noopener">Codice sorgente</a> : "Codice sorgente: in pubblicazione"}</span>.</p>
            <p>Impostazione grafica ed editoriale derivata da <a href="https://github.com/Italian-Builders-Org/DoveVannoINostriSoldi">DoveVannoINostriSoldi</a> (AGPL-3.0); questo sito non è affiliato a quel progetto.</p>
            <p>Confini dei municipi © OpenStreetMap contributors (<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>). Dati ANAC sotto <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.it" target="_blank" rel="noopener">CC BY-SA 4.0</a>, anche le tabelle che ne ricaviamo. Documenti di Roma Capitale riusati con citazione della fonte (art. 7 del D.Lgs. 33/2013 e art. 52 del CAD).</p>
          </div></footer>
        </div>
      </div>
      <div className="tip" id="tip" role="status" />
      <Popover path={path} />
    </>
  );
}

/* ---------- finestra delle icone info: si apre passando sopra, con un tocco o con la tastiera ---------- */
function Popover({ path }: { path: string }) {
  const popRef = useRef<HTMLDivElement>(null);
  const hideRef = useRef<() => void>(() => {});
  useEffect(() => {
    const pop = popRef.current!;
    let btn: HTMLElement | null = null, at = 0, hideT: ReturnType<typeof setTimeout> | undefined;
    const hover = () => matchMedia("(hover:hover)").matches;
    const place = () => {
      if (!btn) return; const r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight;
      const w = pop.offsetWidth, h = pop.offsetHeight; const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8); let y = r.bottom + 8;
      if (y + h > vh - 8 && r.top - h - 8 > 8) y = r.top - h - 8; pop.style.left = x + "px"; pop.style.top = y + "px";
    };
    const show = (b: HTMLElement) => {
      clearTimeout(hideT); if (btn && btn !== b) btn.setAttribute("aria-expanded", "false");
      if (btn !== b) at = Date.now(); btn = b; pop.innerHTML = b.dataset.info || ""; pop.hidden = false; b.setAttribute("aria-expanded", "true"); place();
    };
    const hide = () => { clearTimeout(hideT); if (btn) btn.setAttribute("aria-expanded", "false"); btn = null; pop.hidden = true; };
    const later = () => { clearTimeout(hideT); hideT = setTimeout(hide, 200); };
    hideRef.current = hide;
    const el = (e: Event) => e.target as Element;
    const onOver = (e: MouseEvent) => { const b = el(e).closest?.(".info") as HTMLElement | null; if (b && hover()) show(b); else if (el(e).closest?.("#pop")) clearTimeout(hideT); };
    const onOut = (e: MouseEvent) => { if (hover() && el(e).closest?.(".info,#pop")) later(); };
    const onFocus = (e: FocusEvent) => { const b = el(e).closest?.(".info") as HTMLElement | null; if (b) show(b); };
    const onClick = (e: MouseEvent) => {
      const b = el(e).closest?.(".info") as HTMLElement | null;
      if (b) { e.preventDefault(); e.stopPropagation(); if (btn === b && Date.now() - at > 400) hide(); else show(b); return; }
      if (!el(e).closest?.("#pop")) hide();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && btn) { const b = btn; hide(); b.focus(); } };
    document.addEventListener("mouseover", onOver); document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocus); document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    addEventListener("scroll", place, { passive: true }); addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocus); document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      removeEventListener("scroll", place); removeEventListener("resize", hide); clearTimeout(hideT);
    };
  }, []);
  useEffect(() => { hideRef.current(); }, [path]);
  return <div id="pop" className="glass" role="note" hidden ref={popRef} />;
}
