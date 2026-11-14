"""Costruisce il sito statico: site/index.html con i dati incorporati.

Legge data/snapshot/*.json (prodotti dagli script etl_*.py e build_map.py) e li
inserisce nel modello scripts/template.html. Nessun dato viene calcolato qui:
le pagine leggono gli snapshot così come sono, con la loro fonte e il loro periodo.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP = ROOT / "data/snapshot"
TEMPLATE = ROOT / "scripts/template.html"
OUT = ROOT / "site/index.html"


def main():
    data = {}
    for f in sorted(SNAP.glob("*.json")):
        data[f.stem] = json.loads(f.read_text())
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # Il JSON finisce dentro <script type="application/json">: niente "</" grezzi.
    payload = payload.replace("</", "<\\/")
    sections = (ROOT / "scripts/sections.js").read_text()
    html = TEMPLATE.read_text()
    html, ricerca_js = aggiungi_ricerca(html, data)  # ricerca: blocco separato, vedi sotto e RICERCA.md
    html, web_js = aggiungi_web(html)  # grafici, Confronta e mappa da web/lib, vedi sotto
    html = html.replace("/*__SECTIONS__*/", sections + "\n" + ricerca_js)
    assert html.count("/*__DA_WEB__*/") == 1, "template.html: manca il segnaposto /*__DA_WEB__*/"
    html = html.replace("/*__DA_WEB__*/", web_js)
    html = html.replace("__DATA__", payload)
    import base64
    logo = base64.b64encode((ROOT / "assets/urbe-hub-donor.png").read_bytes()).decode()
    html = html.replace("__URBE_LOGO__", "data:image/png;base64," + logo)
    # logo Roma in chiaro (maschera CSS) e favicon, da brand/logo/genera.py
    for segnaposto, file in (("__ROMA_LOGO__", "assets/logo-roma-in-chiaro.svg"), ("__ROMA_ICON__", "web/app/icon.svg")):
        svg64 = base64.b64encode((ROOT / file).read_bytes()).decode()
        html = html.replace(segnaposto, "data:image/svg+xml;base64," + svg64)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html)
    print(f"site/index.html: {len(data)} snapshot ({', '.join(data)}), {OUT.stat().st_size // 1024} KB")


# ---------------- ricerca (pagina #/cerca) ----------------
# Il template non cambia: lo stile va in fondo a <style>, l'indice in un suo <script> accanto ai
# dati, il codice (scripts/search.js) dopo le sezioni. Così il blocco si sposta da solo su un
# template con un'altra veste.
def aggiungi_ricerca(html, data):
    """Stile e indice inseriti in html; restituisce (html, codice JS da mettere dopo le sezioni)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_search", ROOT / "scripts/build_search.py")
    bs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bs)
    indice = bs.build_index(data, ROOT)
    idx = json.dumps(indice, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    css = (ROOT / "scripts/search.css").read_text()
    js = (ROOT / "scripts/search.js").read_text()
    assert "__DATA__" not in js and "</script" not in js, "search.js non deve contenere __DATA__ né </script"
    for segno in ("</style>", '<script id="data"', "/*__SECTIONS__*/"):
        assert segno in html, f"template senza {segno!r}: la ricerca non sa dove andare"
    html = html.replace("</style>", css + "</style>", 1)
    html = html.replace('<script id="data"', f'<script id="search-index" type="application/json">{idx}</script>\n<script id="data"', 1)
    print(f"ricerca: indice {len(idx.encode()) // 1024} KB, {len(indice['doc'])} documenti, "
          f"{len(indice['P'])} progetti, {len(indice['Q'])} aree citate, {len(indice['V'])} vie/piazze/parchi")
    return html, js


# ---------------- codice condiviso con la versione Next.js (web/) ----------------
# scripts/da-web.js è generato da web/scripts/porta-al-sito-statico.mjs (npm run porta) a partire da web/lib:
# grafici delle schede, PNRR e Giubileo, Confronta e mappa della pagina iniziale. Qui si aggiungono i suoi
# stili (gli stessi file CSS della versione Next.js), Leaflet 1.9.4 (scripts/vendor, licenza BSD 2-Clause)
# e i due file della mappa (web/data). Tutto resta dentro site/index.html: le sole richieste esterne sono
# le tile di OpenStreetMap della mappa.
WEB_CSS = ["web/components/grafici-municipio.css", "web/app/confronto/confronto.css", None, "web/components/Mappa.css"]  # None = leaflet.css
LEAFLET = ROOT / "scripts/vendor/leaflet-1.9.4"
MAPPE = {"mappa-quartieri": ROOT / "web/data/mappa-quartieri.json", "mappa-municipi": ROOT / "web/data/mappa-municipi.json"}


def aggiungi_web(html):
    """Stili, Leaflet e file della mappa inseriti in html; restituisce (html, codice di da-web.js)."""
    import base64
    js = (ROOT / "scripts/da-web.js").read_text()
    leaflet_css = (LEAFLET / "leaflet.css").read_text()
    for img in sorted((LEAFLET / "images").glob("*.png")):  # icone di Leaflet dentro il file, niente richieste a images/
        leaflet_css = leaflet_css.replace(f"url(images/{img.name})", "url(data:image/png;base64," + base64.b64encode(img.read_bytes()).decode() + ")")
    assert "url(images/" not in leaflet_css, "leaflet.css: immagine non incorporata"
    css = "".join(f"\n/* ---- {f or 'scripts/vendor/leaflet-1.9.4/leaflet.css'} ---- */\n" + ((ROOT / f).read_text() if f else leaflet_css) for f in WEB_CSS)
    licenza = (LEAFLET / "LICENSE").read_text().strip()
    leaflet_js = (LEAFLET / "leaflet.js").read_text().replace("//# sourceMappingURL=leaflet.js.map", "").rstrip()
    mappe = ""
    for k, f in MAPPE.items():
        j = json.dumps(json.loads(f.read_text()), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        mappe += f'<script id="{k}" type="application/json">{j}</script>\n'
    for t in (js, leaflet_js, css, licenza):
        assert "</script" not in t.lower() and "__DATA__" not in t, "blocco con </script o __DATA__"
    assert html.count("</style>") == 1 and html.count('<script id="data"') == 1
    html = html.replace("</style>", css + "</style>", 1)
    html = html.replace('<script id="data"', mappe + "<script>/* Leaflet 1.9.4, https://leafletjs.com\n" + licenza + "\n*/\n" + leaflet_js + "\n</script>\n<script id=\"data\"", 1)
    print(f"da web/: codice {len(js.encode()) // 1024} KB, stili {len(css.encode()) // 1024} KB, Leaflet {len(leaflet_js.encode()) // 1024} KB, mappa {len(mappe.encode()) // 1024} KB")
    return html, js


if __name__ == "__main__":
    main()
