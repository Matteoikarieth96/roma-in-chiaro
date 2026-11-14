/* Codice distribuito sotto GNU AGPL-3.0 (vedi ../LICENSE).
   Palette, regole di formato e impostazione editoriale derivano da
   DoveVannoINostriSoldi (github.com/Italian-Builders-Org/DoveVannoINostriSoldi, AGPL-3.0).
   Nessun font esterno: caratteri di sistema (vedi --font in globals.css). */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Shell from "@/components/Shell";
import logo from "../../assets/urbe-hub-donor.png";
import "./globals.css";
import "../../scripts/search.css";
/* stili di scheda municipio e Confronta: globali come nel sito statico (senza, Next.js li precarica dai link del menu e la console avvisa) */
import "@/components/grafici-municipio.css";
import "./confronto/confronto.css";

export const metadata: Metadata = {
  title: "Roma in chiaro",
  description: "Bilancio, appalti, progetti e profilo dei 15 Municipi di Roma Capitale, con fonte e periodo per ogni numero.",
  openGraph: { title: "Roma in chiaro", description: "I conti dei 15 Municipi di Roma, con fonte e periodo per ogni numero.", siteName: "Roma in chiaro", locale: "it_IT", type: "website" },
  twitter: { card: "summary_large_image" },
  /* icone: web/app/icon.svg (porpora, rosa col tema scuro) e web/app/apple-icon.png, generate da brand/logo/genera.py */
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/* tema scelto con il pulsante e colonna del menu chiusa sul computer: applicati prima del primo disegno, così la pagina non lampeggia */
const TEMA = `try{var t=localStorage.getItem("tema");if(t)document.documentElement.dataset.theme=t;if(localStorage.getItem("menu")==="chiuso")document.documentElement.dataset.menu="chiuso"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: TEMA }} /></head>
      <body>
        <Shell logo={{ src: logo.src, width: logo.width, height: logo.height }}>{children}</Shell>
      </body>
    </html>
  );
}
