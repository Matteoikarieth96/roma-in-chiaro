import Link from "next/link";

export const metadata = { title: "Pagina non trovata · Roma in chiaro" };

export default function NotFound() {
  return (
    <main id="app" className="wrap">
      <div className="hero"><h1>Pagina non trovata</h1>
        <p className="lede">L&apos;indirizzo non corrisponde a nessuna pagina del sito.</p>
        <Link className="btn" href="/">Torna alla mappa</Link></div>
    </main>
  );
}
