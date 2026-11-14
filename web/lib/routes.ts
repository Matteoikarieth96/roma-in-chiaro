/* Indirizzi delle pagine. Prima erano rotte con il cancelletto (#/municipio/6), ora sono pagine vere.
   trailingSlash: ogni pagina è una cartella con index.html, così funziona su qualsiasi hosting statico. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const R = {
  home: BASE + "/",
  mun: (id: string | number) => `${BASE}/municipio/${id}/`,
  tutti: BASE + "/tutti/",
  conf: (a?: string, b?: string) => (a ? `${BASE}/confronto/?a=${a}&b=${b || ""}` : `${BASE}/confronto/`),
  fonti: BASE + "/fonti/",
  pnrr: BASE + "/pnrr/",
  giubileo: BASE + "/giubileo-2025/",
  cerca: (qs = "") => `${BASE}/cerca/${qs ? "?" + qs : ""}`,
};

/* Per router.push: Next aggiunge da solo il basePath. */
export const stripBase = (href: string) => (BASE && href.startsWith(BASE) ? href.slice(BASE.length) || "/" : href);

/* Vecchi link con il cancelletto (#/municipio/6, #/cerca?q=Ostia): dove portano adesso. */
export function fromHash(hash: string): string | null {
  if (!/^#\/?/.test(hash) || hash === "#" ) return null;
  const raw = hash.replace(/^#\/?/, "");
  if (!raw) return null;
  const [path, qs = ""] = raw.split("?");
  const h = path.split("/");
  switch (h[0]) {
    case "municipio": return R.mun(/^\d+$/.test(h[1] || "") ? h[1] : "1");
    case "tutti": return R.tutti;
    case "confronto": return h[1] ? R.conf(h[1], h[2] || "") : R.conf();
    case "fonti": return R.fonti;
    case "cerca": return R.cerca(qs);
    default: return null;
  }
}
