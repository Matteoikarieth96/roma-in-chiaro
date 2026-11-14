"""Progetti PNRR, Giubileo 2025 e altri fondi straordinari per municipio.

Fonte: le pagine "Progetti PNRR e altri Fondi straordinari" di Roma Capitale
(comune.roma.it), una per programma, paginate con ?pagina=N (4 progetti per pagina).
Ogni scheda in elenco riporta i tag Municipio, lo stato, l'"Importo attribuito";
il CUP sta solo nella pagina di dettaglio del progetto, che quindi viene scaricata.

Regole:
- tutto l'HTML scaricato resta in data/raw/progetti/ (cache: una seconda esecuzione
  non rifà richieste); 1 richiesta al secondo, User-Agent generico;
- un progetto con un solo tag municipio va a quel municipio; con più tag, con il tag
  "Intermunicipale" o senza tag va nel bucket "cittadino": gli importi non vengono mai divisi;
  eccezione: una scheda con l'importo "per singolo Municipio" e un CUP per ogni municipio nella
  pagina di dettaglio va in ogni municipio con la cifra scritta per quel municipio (QUOTE_PER_MUNICIPIO);
- una scheda che la fonte descrive come parte di un'altra scheda già contata resta in elenco ma
  fuori dai totali (COMPRESE_IN);
- importo: solo il numero scritto nella scheda; se la scheda non ha un solo importo
  leggibile resta null e il testo originale viene conservato.

Controlli stampati: numero di schede letto = "Pagina 1 di N" * 4 (ultima pagina parziale),
conteggi per municipio = contatori del filtro Municipio della pagina stessa.
"""
import datetime
import hashlib
import json
import os
import re
import sys
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin

import subprocess
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/progetti"
OUT = ROOT / "data/snapshot/progetti.json"
BASE = "https://www.comune.roma.it"
UA = "Mozilla/5.0 (compatible; civic-data-research)"
# RIFRESCA=1: ignora la cache e riscarica ogni pagina (lo usa ./aggiorna.sh senza argomenti).
RIFRESCA = os.environ.get("RIFRESCA") == "1"
LICENZA_RC = ("Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 "
              "del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).")

PROGRAMMI = [
    ("pnrr", "PNRR"),
    ("giubileo-2025", "Giubileo 2025"),
    ("dl-aiuti-2022", "DL Aiuti 2022"),
    ("fondi-diretti", "Fondi diretti UE"),
    ("fondi-strutturali-regionali", "Fondi strutturali regionali"),
    ("pn-metro-plus-21-27", "PN Metro Plus 2021-2027"),
    ("pon-metro-14-20", "PON Metro 2014-2020"),
]
ROMANI = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
          "xi", "xii", "xiii", "xiv", "xv"]
MUN_NUM = {f"municipio_{r}": str(i + 1) for i, r in enumerate(ROMANI)}

_last = [0.0]
_fetched = [0]
LETTI = set()  # file raw da cui è costruito lo snapshot (per la data "verificato")


def fetch(url, name):
    path = RAW / name
    if not RIFRESCA and path.exists() and path.stat().st_size > 1000:
        LETTI.add(path)
        return path.read_text(encoding="utf-8")
    wait = 1.0 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    for attempt in range(3):
        try:
            # curl usa i certificati di sistema (il Python del venv non ha certifi)
            r = subprocess.run(["curl", "-sS", "-L", "--fail", "--max-time", "60", "-A", UA, url],
                               capture_output=True, check=True)
            text = r.stdout.decode("utf-8", errors="replace")
            _last[0] = time.time()
            break
        except subprocess.CalledProcessError as e:
            _last[0] = time.time()
            print(f"  ! {url}: {e.stderr.decode(errors='replace').strip()} (tentativo {attempt + 1})", file=sys.stderr)
            time.sleep(5)
    else:
        raise RuntimeError(f"download fallito: {url}")
    path.write_text(text, encoding="utf-8")
    _fetched[0] += 1
    LETTI.add(path)
    return text


def clean(s):
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


AMT_RE = re.compile(r"(€\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(\s*(?:euro|€))?", re.I)
MLN_RE = re.compile(r"(\d+(?:,\d+)?)\s*milion[ei]", re.I)


def parse_importo(testo):
    """(valore, metodo) dal testo 'Importo attribuito' della scheda.

    - una sola cifra in euro -> quella;
    - 'X euro (di cui Y ...)' -> X, il totale scritto per primo;
    - più cifre affiancate ('A euro + B euro', 'A (Giubileo) e B (Bilancio)') -> somma delle cifre scritte;
    - nessuna cifra leggibile -> None.
    """
    if not testo:
        return None, None
    t = testo.replace("\xa0", " ")
    vals = []
    for m in AMT_RE.finditer(t):
        if m.group(1) or m.group(3):
            vals.append((m.start(), float(m.group(2).replace(".", "").replace(",", "."))))
    for m in MLN_RE.finditer(t):
        vals.append((m.start(), round(float(m.group(1).replace(",", ".")) * 1_000_000, 2)))
    vals.sort()
    if not vals:
        return None, None
    distinti = {v for _, v in vals}
    if len(distinti) == 1:
        if vals[0][1] == 0:
            return None, "importo non leggibile nella fonte"
        return vals[0][1], "cifra unica"
    dc = re.search(r"di cui", t, re.I)
    if dc and vals[0][0] < dc.start():
        return vals[0][1], "totale scritto prima di 'di cui'"
    return round(sum(v for _, v in vals), 2), "somma delle cifre scritte nella scheda"


def componenti_importo(testo):
    """Le singole cifre di un importo composto, con il testo che le segue (la fonte indicata)."""
    if not testo:
        return None
    t = testo.replace("\xa0", " ")
    ms = [m for m in AMT_RE.finditer(t) if m.group(1) or m.group(3)]
    if len(ms) < 2:
        return None
    out = []
    for i, m in enumerate(ms):
        fine = ms[i + 1].start() if i + 1 < len(ms) else len(t)
        fonte = clean(re.sub(r"^[\s()€,+]*|[\s()€,+]*(e|di cui|\(di cui)?[\s()€,+]*$", "", t[m.end():fine]))
        out.append({"euro": float(m.group(2).replace(".", "").replace(",", ".")), "testo": fonte or None})
    return out


# ---------------------------------------------------------------- importo del programma

# Parole che nel testo dell'importo indicano la fonte di una cifra. Una cifra è "del programma"
# se la sua etichetta nomina il programma della scheda; è "di altra fonte" se nomina un'altra fonte.
FONTE_PROGRAMMA = {
    "PNRR": r"\bPNRR\b",
    "Giubileo 2025": r"Giubileo",
    "DL Aiuti 2022": r"\bD\.?\s*L\.?\s*50/2022|Decreto\s+Aiuti|\bDL\s+Aiuti",
    "Fondi diretti UE": r"$^",  # per i fondi diretti conta la quota "di competenza di Roma Capitale"
    "Fondi strutturali regionali": r"\bFESR\b|\bFSE\+?",
    "PN Metro Plus 2021-2027": r"\bPN\s*METRO",
    "PON Metro 2014-2020": r"\bPON\s*METRO",
}
ALTRE_FONTI = (r"[Bb]ilancio|Roma Capitale|\bMIT\b|Minister|Project Financing|Fondi vincolati|Altre Risorse|"
               r"Regione|privat|Concessionari|Piano Urbano Parcheggi|PON\s+Inclusione|\bFEAD\b|" +"|".join(v for v in FONTE_PROGRAMMA.values() if v != r"$^"))
QUOTA_ROMA = re.compile(r"(di\s+)?competenza\s+di\s+Roma\s+Capitale|quota\s+(di\s+)?Roma\s+Capitale", re.I)


def cifre(t):
    """[(inizio, fine, valore)] delle cifre in euro del testo (stesse regole di parse_importo)."""
    out = []
    for m in AMT_RE.finditer(t):
        # cifra in euro: con il simbolo/la parola euro, oppure scritta in formato contabile (1.234,56)
        if m.group(1) or m.group(3) or re.fullmatch(r"\d{1,3}(?:\.\d{3})+,\d{2}", m.group(2)):
            out.append((m.start(), m.end(), float(m.group(2).replace(".", "").replace(",", "."))))
    for m in MLN_RE.finditer(t):
        out.append((m.start(), m.end(), round(float(m.group(1).replace(",", ".")) * 1_000_000, 2)))
    return sorted(out)


def importo_programma(testo, programma):
    """(valore, metodo): la parte dell'importo che appartiene al programma della scheda.

    Etichetta di una cifra = testo che la segue fino alla cifra successiva; se in mezzo c'è
    "di cui", la parte dopo "di cui" è l'etichetta della cifra successiva e la cifra prima di
    "di cui" è un totale (non una componente).
    - una sola cifra (o la stessa ripetuta) -> quella;
    - Fondi diretti UE: la cifra indicata "di competenza di Roma Capitale", se c'è;
    - cifre etichettate con il programma della scheda -> la loro somma;
    - nessuna cifra etichettata con una fonte -> il totale prima di "di cui", altrimenti la somma;
    - cifre di altre fonti e nessuna del programma -> la somma delle cifre senza fonte, se ce ne sono;
      altrimenti il totale scritto prima di "di cui" meno le parti di altre fonti
      ("1.270.000 euro (di cui 620.000 dal PNRR)" su una scheda PN Metro -> 650.000);
      altrimenti null (il programma non è indicato).
    """
    if not testo:
        return None, None
    t = testo.replace("\xa0", " ")
    fig = cifre(t)
    if not fig:
        return None, None
    if len({v for _, _, v in fig}) == 1:
        if fig[0][2] == 0:
            # es. "1.428.00,00 euro": refuso della fonte, la cifra non si legge (non è zero)
            return None, "importo non leggibile nella fonte"
        # una sola cifra: conta solo se la sua etichetta non la attribuisce a un'altra fonte
        etichetta = t[:fig[0][0]] + " " + t[fig[0][1]:]
        if (not re.search(FONTE_PROGRAMMA.get(programma, r"$^"), etichetta, re.I)
                and re.search(ALTRE_FONTI, etichetta, re.I) and not QUOTA_ROMA.search(etichetta)):
            return None, "solo cifre di altre fonti"
        return fig[0][2], "cifra unica"
    seg =[t[:fig[0][0]]] + [t[fig[i - 1][1]:fig[i][0]] for i in range(1, len(fig))] + [t[fig[-1][1]:]]
    comp, totali = [], []
    for i, (_, _, v) in enumerate(fig):
        prima, dopo = seg[i], seg[i + 1]
        pref = re.split(r"di cui", prima, flags=re.I)[-1] if re.search(r"di cui", prima, re.I) else (prima if i == 0 else "")
        if re.search(r"di cui", dopo, re.I):
            totali.append(v)
            continue
        comp.append((v, f"{pref} {dopo}"))
    rx_prog = re.compile(FONTE_PROGRAMMA.get(programma, r"$^"), re.I)
    rx_altre = re.compile(ALTRE_FONTI, re.I)
    if programma == "Fondi diretti UE":
        quota = [v for v, l in comp if QUOTA_ROMA.search(l)]
        if quota:
            return round(sum(quota), 2), "quota di competenza di Roma Capitale"
    prog = [v for v, l in comp if rx_prog.search(l)]
    if prog:
        return round(sum(prog), 2), f"cifre indicate come {programma}"
    altre = [v for v, l in comp if rx_altre.search(l) and not QUOTA_ROMA.search(l)]
    neutre = [v for v, l in comp if not rx_altre.search(l) or QUOTA_ROMA.search(l)]
    if not altre:
        if totali:
            return totali[0], "totale (le parti non indicano un'altra fonte)"
        return round(sum(neutre), 2), "somma delle cifre (nessuna indica un'altra fonte)"
    if neutre:
        return round(sum(neutre), 2), "cifre senza fonte indicata (escluse quelle di altre fonti)"
    if totali and sum(altre) < totali[0]:
        return round(totali[0] - sum(altre), 2), "totale meno le parti indicate come altre fonti"
    return None, "nessuna cifra indicata come " + programma


# ---------------------------------------------------------------- municipio dal testo

ROMANO = r"(XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)"
MUN_TXT_RE = re.compile(r"\bMunicipio\s+(?:Roma\s+)?" + ROMANO + r"\b")
NUM_ROMANO = {r.upper(): str(i + 1) for i, r in enumerate(ROMANI)}
PAROLE_GENERICHE = {"municipio", "municipi", "roma", "capitale", "via", "viale", "piazza", "largo", "missione"}


def municipio_da_testo_scheda(c):
    """(municipio, evidenza) se il testo della scheda nomina uno e un solo 'Municipio <romano>'."""
    trovati = {NUM_ROMANO[m.group(1)]: m for m in MUN_TXT_RE.finditer(c["_card_text"])}
    if len(trovati) != 1:
        return None, None
    num, m = next(iter(trovati.items()))
    t = c["_card_text"]
    return num, clean(t[max(0, m.start() - 70):m.end() + 10])


def testo_programma(html):
    """Testo introduttivo della pagina di programma (prima dei filtri e delle schede)."""
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "header", "footer"]):
        t.decompose()
    return clean(soup.get_text(" ")).split("Filtra per:")[0]


def luoghi_programma(intro):
    """[(parole del luogo, municipio, frase)] per ogni 'Municipio <romano>' del testo di programma.

    Il luogo è il tratto di frase attaccato alla menzione: prima ("Casal Selce - Municipio XIII"),
    dentro la stessa parentesi, prima della parentesi ("via Severini (Municipio V ...)") e dopo un
    trattino ("Municipio V - Tor Sapienza"). Le parole del luogo sono quelle con l'iniziale maiuscola
    (nomi propri), di almeno 4 lettere, escluse quelle generiche (Via, Roma, Municipio...).
    """
    out = []
    delim = re.compile(r"[;:,(]|\se\s")
    for m in MUN_TXT_RE.finditer(intro):
        pre = intro[:m.start()].rstrip(" -–—")
        last = None
        for d in delim.finditer(pre):
            last = d
        pezzi = [pre[last.end():] if last else pre]
        if last is not None and last.group(0) == "(":
            prima = pre[:last.start()]
            l2 = None
            for d in delim.finditer(prima):
                l2 = d
            pezzi.append(prima[l2.end():] if l2 else prima)
        dopo = re.match(r"\s*[-–—]\s*([^;),]*?)(?:\se\s|[;),]|$)", intro[m.end():])
        if dopo:
            pezzi.append(dopo.group(1))
        luogo = " ".join(pezzi)
        parole = {w.lower() for w in re.findall(r"\b[A-ZÀ-Ý][A-Za-zÀ-ÿ]{3,}", luogo)} - PAROLE_GENERICHE
        frase = clean(intro[max(0, m.start() - 60):m.end() + 25])
        if parole:
            out.append((parole, NUM_ROMANO[m.group(1)], frase))
    return out


def attribuisci_da_programma(cards, intro):
    """{link: (municipio, frase)} per le schede senza Municipio che il testo di programma lega a un luogo.

    Per ogni luogo nominato con il suo municipio: punteggio di ogni scheda del programma = numero di
    parole del luogo presenti nel titolo o nel campo Luogo. Vale solo se una e una sola scheda ha il
    punteggio massimo (>=1), quella scheda non ha il campo Municipio, e la scheda non è legata a
    luoghi di municipi diversi.
    """
    cand = defaultdict(list)
    for parole, num, frase in luoghi_programma(intro):
        punti = []
        for c in cards:
            hay = (c["titolo"] + " " + (c["luogo"] or "")).lower()
            punti.append((sum(1 for w in parole if re.search(rf"\b{re.escape(w)}\b", hay)), c))
        best = max(p for p, _ in punti) if punti else 0
        top = [c for p, c in punti if p == best]
        if best >= 1 and len(top) == 1 and not top[0]["municipio_tag"]:
            cand[top[0]["link"]].append((num, frase))
    return {k: v[0] for k, v in cand.items() if len({n for n, _ in v}) == 1}


def campo(card, etichetta):
    """Testo dopo '<strong>Etichetta:</strong>' in un paragrafo della scheda."""
    for p in card.find_all("p"):
        strong = p.find("strong")
        if strong and clean(strong.get_text()).rstrip(":").strip().lower().startswith(etichetta.lower()):
            txt = clean(p.get_text())
            return clean(re.sub(rf"^{re.escape(clean(strong.get_text()))}\s*:?", "", txt))
    return None


def parse_listing(html):
    soup = BeautifulSoup(html, "html.parser")
    pag = soup.find(string=re.compile(r"Pagina \d+ di \d+"))
    n_pagine = int(re.search(r"di (\d+)", pag).group(1)) if pag else 1
    facet = {}
    for a in soup.select("a[data-value]"):
        href = a.get("href", "")
        m = re.search(r"[?&]mun=([a-z_]+)", href)
        c = re.search(r"\((\d+)\)\s*$", clean(a.get_text()))
        if m and c:
            facet[m.group(1)] = int(c.group(1))
    stato_facet = {}
    for a in soup.select("a[data-value]"):
        m = re.search(r"[?&]stato=([a-z_]+)", a.get("href", ""))
        c = re.search(r"^(.*)\((\d+)\)\s*$", clean(a.get_text()))
        if m and c:
            stato_facet[m.group(1)] = int(c.group(2))
    cards = []
    for title in soup.select("p.List-title"):
        card = title.find_parent("div", class_="List-content")
        a = title.find("a")
        cat = card.find("p", class_="List-category")
        tags = defaultdict(list)
        if cat:
            for span in cat.find_all("span", recursive=False):
                label = clean(span.contents[0] if span.contents else "").rstrip(":")
                for link in span.find_all("a"):
                    q = re.search(r"[?&](\w+)=([^&]+)", link.get("href", ""))
                    tags[label].append((q.group(2) if q else None, clean(link.get_text())))
        importo_testo = campo(card, "Importo")
        cards.append({
            "titolo": clean(a.get_text()),
            "link": urljoin(BASE, a["href"]),
            "municipio_tag": [k for k, _ in tags.get("Municipio", [])],
            "stato": "; ".join(v for _, v in tags.get("Stato", [])) or None,
            "stato_dettaglio": campo(card, "Stato"),
            "tematica": [v for _, v in tags.get("Tematica", [])] or None,
            "struttura": [v for _, v in tags.get("Da", [])] or None,
            "periodo": clean(card.find("p", class_="List-date").get_text()) if card.find("p", class_="List-date") else None,
            "luogo": campo(card, "Luogo"),
            "importo_testo": importo_testo,
            "importo": parse_importo(importo_testo)[0],
            "importo_metodo": parse_importo(importo_testo)[1],
            "importo_da": "elenco" if importo_testo else None,
            "attuatore": campo(card, "Struttura referente"),
            "_card_text": clean(card.get_text(" ")),
        })
    return n_pagine, facet, stato_facet, cards


def soup_has_pager(html):
    return bool(re.search(r"Pagina \d+ di \d+", html))


CUP_RE = re.compile(r"\b[A-Z]\d{2}[A-Z]\d{11}\b")


def detail_info(html):
    """CUP e, se c'è, il testo 'Importo...' dalla pagina di dettaglio."""
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "header", "footer"]):
        t.decompose()
    text = soup.get_text(" ")
    found = []
    for c in CUP_RE.findall(text):
        if c not in found:
            found.append(c)
    imp = None
    for td in soup.find_all("td"):
        if re.fullmatch(r"(Costo totale|Importo[^:]{0,30})", clean(td.get_text()), re.I):
            nxt = td.find_next_sibling("td")
            if nxt and re.search(r"\d", nxt.get_text()):
                return found, clean(nxt.get_text(" "))
    for p in soup.find_all(["p", "li", "td"]):
        pt = clean(p.get_text(" "))
        if re.match(r"(Importo|Valore del progetto|Budget|Finanziamento)[^:]{0,40}:", pt, re.I) and re.search(r"\d", pt):
            imp = clean(pt.split(":", 1)[1])
            break
    return found, imp


# Pagine di programma che oggi non pubblicano schede progetto: descrivono i progetti solo nel
# testo, senza elenco e senza paginatore (controllato sulla copia del 13/11/2026). Solo per
# queste "0 schede" è un risultato valido; per ogni altra pagina 0 schede vuol dire che la
# lettura è fallita.
PAGINE_DESCRITTIVE = {
    "fondi-strutturali-regionali": "testo descrittivo dei progetti (es. 25 milioni per un progetto) senza schede",
}

REGOLA_MUNICIPIO = (
    "Municipio di un progetto: (a) il campo Municipio della scheda; se la scheda non ha il campo, "
    "(b) il 'Municipio <numero romano>' che un testo ufficiale lega esplicitamente a quel progetto: "
    "il testo della scheda stessa, se nomina un solo municipio (campo Luogo, Struttura referente o "
    "descrizione), oppure il testo introduttivo della pagina del programma, se nomina il luogo del "
    "progetto accanto al municipio (es. 'Casal Selce - Municipio XIII'). Il luogo nominato deve "
    "corrispondere al titolo o al campo Luogo di una sola scheda. Nessuna attribuzione da indirizzi, "
    "mappe o stime. La regola usata è in municipio_fonte (campo_scheda, testo_scheda, "
    "testo_programma) con la frase citata in municipio_evidenza. Una scheda con l'importo 'per singolo "
    "Municipio' e un CUP per municipio nella pagina di dettaglio è riportata in ogni municipio con la "
    "cifra scritta per quel municipio (municipio_fonte cup_per_municipio).")

# ---------------------------------------------------------------- importo per singolo municipio
# Es. "3.000.000,00 euro (Risorse Giubileo 2025, per singolo Municipio)" con, nella pagina di
# dettaglio, "Codice Unico di Progetto (CUP) J87H23003140001 (Municipio I) J87H22004900001 (Municipio II) ...".
# Ogni municipio riceve la cifra scritta per singolo municipio: nessuna divisione e nessuna stima.
# Una cifra diversa per un municipio vale solo se la scheda la scrive, es. "ad eccezione del
# Municipio 1 il cui intervento ha richiesto un maggiore finanziamento, pari ad euro 1.350.000,00".
# Se la pagina non dà un CUP per ognuno dei municipi del campo Municipio, il controllo fallisce.
PER_SINGOLO_RE = re.compile(r"per\s+singolo\s+Municipio", re.I)
CUP_MUN_RE = re.compile(r"\b([A-Z]\d{2}[A-Z]\d{11})\s*\(\s*Municipio\s+" + ROMANO + r"\s*\)")
ECCEZIONE_RE = re.compile(r"ad\s+eccezione\s+del\s+Municipio\s+(\d{1,2}|XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b"
                          r"[^.]{0,160}?pari\s+ad?\s+euro\s+(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)", re.I)
ROMANO_DI = {str(i + 1): r.upper() for i, r in enumerate(ROMANI)}


def euro_it(v):
    """1350000.0 -> '1.350.000,00'"""
    return f"{v:,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")


def quote_per_municipio(c):
    """[record per municipio] per una scheda con l'importo 'per singolo Municipio', None per le altre.

    ValueError con il motivo se la pagina non permette una ripartizione pulita."""
    if not (c["importo_testo"] and PER_SINGOLO_RE.search(c["importo_testo"])):
        return None
    base = c["importo_programma_euro"]
    if base is None or c["importo_programma_metodo"] != "cifra unica":
        raise ValueError(f"importo per singolo municipio non leggibile ({c['importo_programma_metodo']})")
    tags = c["municipio_tag"]
    if not tags or any(t not in MUN_NUM for t in tags):
        raise ValueError(f"campo Municipio non fatto solo di municipi: {tags}")
    t = c.get("_detail_text") or ""
    cup_mun = defaultdict(list)
    for m in CUP_MUN_RE.finditer(t):
        cup_mun[NUM_ROMANO[m.group(2)]].append(m.group(1))
    nums = sorted((MUN_NUM[x] for x in tags), key=int)
    if sorted(cup_mun, key=int) != nums or any(len(v) != 1 for v in cup_mun.values()):
        raise ValueError(f"la pagina non dà un CUP per ogni municipio del campo Municipio "
                         f"(municipi {nums}, CUP per municipio {dict(cup_mun)})")
    if sorted(v[0] for v in cup_mun.values()) != sorted(c["cup"] or []):
        raise ValueError("i CUP per municipio non coincidono con i CUP della scheda")
    eccezioni = {}
    for m in ECCEZIONE_RE.finditer(t):
        num = m.group(1) if m.group(1).isdigit() else NUM_ROMANO[m.group(1).upper()]
        if num not in cup_mun:
            raise ValueError(f"eccezione per un municipio fuori dalla scheda: {clean(m.group(0))}")
        eccezioni[num] = (float(m.group(2).replace(".", "").replace(",", ".")), clean(m.group(0)))
    out = []
    for num in nums:
        cup = cup_mun[num][0]
        r = dict(c)
        euro, ev = eccezioni.get(num, (base, None))
        r.update({
            "cup": [cup], "importo": euro, "importo_programma_euro": euro,
            "importo_metodo": "importo per singolo municipio",
            "importo_programma_metodo": "importo per singolo municipio" if ev is None else "importo del municipio scritto nella scheda",
            "municipio": num, "municipio_fonte": "cup_per_municipio",
            "municipio_evidenza": f"{cup} (Municipio {ROMANO_DI[num]})" + (f"; {ev}" if ev else ""),
            "nota": None if ev is None else (f"Per il Municipio {ROMANO_DI[num]} la scheda indica {euro_it(euro)} euro "
                                             f"invece di {euro_it(base)}."),
        })
        out.append(r)
    return out


# ---------------------------------------------------------------- schede comprese in un'altra
# Una scheda che la fonte descrive come parte di un'altra scheda già contata: resta in elenco,
# ma fuori dai totali (contato_nel_totale false, doppione_di = la scheda che la comprende).
# Vale solo se le due frasi citate sono ancora nelle pagine di dettaglio in cache e se la scheda
# che la comprende è contata nei totali; altrimenti il controllo fallisce.
COMPRESE_IN = {
    # D7 della verifica del 14/11: "probabile", non certo. La fonte non pubblica gli importi delle
    # parti del Piano Urbano Integrato, quindi non si può dire quanto dei 50.043.779 euro siano i parchi.
    "https://www.comune.roma.it/web/it/attivita-progetto.page?contentId=PRG1095436": {
        "in": "https://www.comune.roma.it/web/it/attivita-progetto/piani-urbani-integrati-corviale.page",
        "frase_scheda": "Fonti di finanziamento P.N.R.R. M5.C2.2 Investimento 2.2 – Piani Urbani Integrati",
        "frase_contenitore": "verso la città (Parco Est) e quello oggi protetto nella Riserva naturale della "
                             "Tenuta dei Massimi (Parco Ovest)",
        "nota": ("Non contato nei totali: probabilmente è già compreso nei Piani Urbani Integrati Corviale "
                 "del Municipio XI (PNRR, 50.043.779,00 euro), la cui pagina ufficiale descrive Parco Est e "
                 "Parco Ovest come parte del piano."),
    },
}
NOTA_DOPPIONE = "Stesso CUP e stesso importo di un'altra scheda: l'importo è contato una volta sola."


def testo_pagina(html):
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "nav", "header", "footer"]):
        t.decompose()
    return clean(soup.get_text(" "))


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    progetti = []
    checks = []
    programmi_info = {}
    attrib_programma = {}
    for slug, nome in PROGRAMMI:
        url0 = f"{BASE}/web/it/progetti-pnrr-e-altri-fondi-straordinari-{slug}.page"
        html = fetch(url0, f"{slug}_p001.html")
        n_pagine, facet, stato_facet, cards = parse_listing(html)
        for p in range(2, n_pagine + 1):
            h = fetch(f"{url0}?pagina={p}", f"{slug}_p{p:03d}.html")
            np_, _, _, c = parse_listing(h)
            checks.append((f"{nome} pagina {p}: dice 'di {np_}' come la prima ({n_pagine})", np_ == n_pagine))
            cards.extend(c)
        seen = {}
        for c in cards:
            if c["link"] in seen:
                print(f"  ! {nome}: scheda ripetuta {c['titolo'][:60]}")
                continue
            seen[c["link"]] = c
        cards = list(seen.values())
        for c in cards:
            c["programma"] = nome
        programmi_info[nome] = {"url": url0, "pagine": n_pagine, "schede": len(cards),
                                 "contatori_filtro_municipio": facet,
                                 "contatori_filtro_stato": stato_facet}
        # check 1: schede per pagina
        if not cards and n_pagine == 1 and not soup_has_pager(html):
            checks.append((f"{nome}: 0 schede e nessun paginatore; ammesso solo per le pagine descrittive "
                           f"in elenco ({'in elenco' if slug in PAGINE_DESCRITTIVE else 'NON in elenco'})",
                           slug in PAGINE_DESCRITTIVE))
            programmi_info[nome]["pagina_descrittiva"] = PAGINE_DESCRITTIVE.get(slug)
        else:
            ok_pag = (n_pagine - 1) * 4 < len(cards) <= n_pagine * 4
            checks.append((f"{nome}: {len(cards)} schede su {n_pagine} pagine (4 per pagina)", ok_pag))
        # check 2: contatori del filtro Municipio
        conta = defaultdict(int)
        for c in cards:
            for t in c["municipio_tag"]:
                conta[t] += 1
        for k in sorted(set(facet) | set(conta)):
            checks.append((f"{nome} {k}: filtro pagina {facet.get(k)} vs schede {conta.get(k, 0)}",
                           facet.get(k, 0) == conta.get(k, 0)))
        if stato_facet:
            sc = defaultdict(int)
            for c in cards:
                for s in (c["stato"] or "").split("; "):
                    if s:
                        sc[s.lower().replace(" ", "")] += 1
            for k, v in stato_facet.items():
                checks.append((f"{nome} stato {k}: filtro {v} vs schede {sc.get(k, 0)}", sc.get(k, 0) == v))
        attrib_programma.update(attribuisci_da_programma(cards, testo_programma(html)))
        progetti.extend(cards)
        print(f"{nome}: {n_pagine} pagine, {len(cards)} schede")

    # verifica che il filtro ?mun= funzioni come dichiarato (una prova per programma Giubileo)
    h = fetch(f"{BASE}/web/it/progetti-pnrr-e-altri-fondi-straordinari-giubileo-2025.page?mun=municipio_v",
              "giubileo-2025_mun_v.html")
    _, _, _, cv = parse_listing(h)
    atteso = [c["link"] for c in progetti if c["programma"] == "Giubileo 2025" and "municipio_v" in c["municipio_tag"]]
    checks.append((f"filtro ?mun=municipio_v Giubileo: {len(cv)} schede in pagina 1, attese {min(4, len(atteso))}",
                   len(cv) == min(4, len(atteso)) and all(c["link"] in atteso for c in cv)))

    # dettaglio: CUP (un download fallito ferma l'esecuzione: nessun progetto viene perso in silenzio)
    for c in progetti:
        key = hashlib.sha1(c["link"].encode()).hexdigest()[:12]
        m = re.search(r"contentId=(\w+)", c["link"])
        name = f"dettaglio_{m.group(1) if m else key}.html"
        try:
            html_det = fetch(c["link"], name)
            c["cup"], imp = detail_info(html_det)
            c["_detail_text"] = testo_pagina(html_det)
        except RuntimeError as e:
            checks.append((f"pagina di dettaglio scaricata: {c['titolo'][:60]} ({e})", False))
            c["cup"], imp, c["_detail_text"] = None, None, ""
        if c["importo_testo"] is None and imp:
            c["importo_testo"] = imp
            c["importo"], c["importo_metodo"] = parse_importo(imp)
            c["importo_da"] = "pagina di dettaglio (Costo totale/Importo)"
        if not c["cup"]:
            # a volte il CUP compare nel testo della scheda in elenco
            c["cup"] = CUP_RE.findall(c["_card_text"]) or None
        c["importo_programma_euro"], c["importo_programma_metodo"] = importo_programma(c["importo_testo"], c["programma"])
    print(f"richieste HTTP fatte in questa esecuzione: {_fetched[0]}")

    # attribuzione ai municipi (regola in REGOLA_MUNICIPIO)
    for c in progetti:
        c["municipio"], c["municipio_fonte"], c["municipio_evidenza"] = None, None, None
        tags = c["municipio_tag"]
        if tags:
            c["municipio_fonte"] = "campo_scheda"
            if len(tags) == 1 and tags[0] in MUN_NUM:
                c["municipio"] = MUN_NUM[tags[0]]
            continue
        num, ev = municipio_da_testo_scheda(c)
        if num:
            c["municipio"], c["municipio_fonte"], c["municipio_evidenza"] = num, "testo_scheda", ev
        elif c["link"] in attrib_programma:
            num, ev = attrib_programma[c["link"]]
            c["municipio"], c["municipio_fonte"], c["municipio_evidenza"] = num, "testo_programma", ev

    # schede con l'importo "per singolo Municipio": un record per municipio (QUOTE_PER_MUNICIPIO sopra)
    n_schede, n_divise, espansi = len(progetti), 0, []
    for c in progetti:
        c.setdefault("nota", None)
        try:
            q = quote_per_municipio(c)
        except ValueError as e:
            checks.append((f"importo per singolo municipio {c['titolo'][:50]!r}: {e}", False))
            q = None
        if not q:
            espansi.append(c)
            continue
        n_divise += 1
        quote = ", ".join("%s=%s" % (r["municipio"], format(r["importo_programma_euro"], ",.0f")) for r in q)
        checks.append((f"importo per singolo municipio {c['titolo'][:50]!r}: {len(q)} municipi, un CUP ciascuno, "
                       f"{quote}; totale {sum(r['importo_programma_euro'] for r in q):,.2f}", True))
        espansi.extend(q)
    progetti = espansi

    # schede comprese in un'altra già contata (COMPRESE_IN sopra): verifica delle frasi citate
    per_link = {c["link"]: c for c in progetti}
    for link, v in COMPRESE_IN.items():
        c, cont = per_link.get(link), per_link.get(v["in"])
        ok = bool(c and cont and v["frase_scheda"] in c["_detail_text"] and v["frase_contenitore"] in cont["_detail_text"]
                  and cont["importo_programma_euro"] is not None and c["importo_programma_euro"] is not None
                  and c["importo_programma_euro"] < cont["importo_programma_euro"])
        checks.append((f"scheda compresa in un'altra: {c['titolo'][:45] if c else link!r} in "
                       f"{cont['titolo'][:45] if cont else v['in']!r} (frasi citate presenti nelle pagine)", ok))
        if c:
            c["nota"] = v["nota"]

    municipi ={str(i): {"progetti": []} for i in range(1, 16)}
    cittadino = {"piu_municipi": [], "intermunicipale": [], "senza_municipio": []}
    for c in progetti:
        tags = c["municipio_tag"]
        rec = {k: c[k] for k in ["titolo", "programma", "cup", "importo_programma_euro", "importo_programma_metodo",
                                 "importo", "importo_testo", "importo_metodo", "importo_da", "attuatore", "stato",
                                 "stato_dettaglio", "periodo", "luogo", "tematica", "link"]}
        rec["importo_schede_lordo_euro"] = c["importo"]
        rec["importo_componenti"] = componenti_importo(c["importo_testo"])
        rec["municipio_tag"] = [MUN_NUM.get(t, t) for t in tags]
        rec["municipio_fonte"] = c["municipio_fonte"]
        rec["municipio_evidenza"] = c["municipio_evidenza"]
        rec["nota"] = c["nota"]
        if c["municipio"]:
            municipi[c["municipio"]]["progetti"].append(rec)
        elif len(tags) > 1:
            cittadino["piu_municipi"].append(rec)
        elif tags == ["intermunicipale"]:
            cittadino["intermunicipale"].append(rec)
        else:
            cittadino["senza_municipio"].append(rec)

    def segna_doppioni(lista):
        """Stesso insieme di CUP con lo stesso importo del programma nello stesso gruppo: contato una volta.
        Le schede in COMPRESE_IN non sono contate (doppione_di = la scheda che le comprende)."""
        visti = {}
        for p in lista:
            p["contato_nel_totale"], p["doppione_di"] = True, None
            if p["link"] in COMPRESE_IN:
                p["contato_nel_totale"], p["doppione_di"] = False, COMPRESE_IN[p["link"]]["in"]
                continue
            if p["cup"] and p["importo_programma_euro"] is not None:
                k = (tuple(sorted(p["cup"])), p["importo_programma_euro"])
                if k in visti:
                    p["contato_nel_totale"], p["doppione_di"] = False, visti[k]
                    p["nota"] = p["nota"] or NOTA_DOPPIONE
                else:
                    visti[k] = p["link"]

    def somme(sel):
        lordi = [p["importo"] for p in sel if p["importo"] is not None]
        netti = [p["importo_programma_euro"] for p in sel
                 if p["importo_programma_euro"] is not None and p["contato_nel_totale"]]
        return {"n_progetti": len(sel), "importo_totale_euro": round(sum(netti), 2),
                "importo_schede_lordo_euro": round(sum(lordi), 2),
                "n_senza_importo_leggibile": len(sel) - len(lordi),
                "n_senza_importo_programma": sum(1 for p in sel if p["importo_programma_euro"] is None),
                "n_doppioni_cup_importo": sum(1 for p in sel if not p["contato_nel_totale"])}

    def riepilogo(lista):
        segna_doppioni(lista)
        per = {}
        for nome in [n for _, n in PROGRAMMI]:
            sel = [p for p in lista if p["programma"] == nome]
            if sel:
                per[nome] = {**somme(sel), "n_importo_composto": sum(1 for p in sel if p["importo_componenti"])}
        return {**somme(lista), "per_programma": per}

    for k, v in municipi.items():
        v["progetti"].sort(key=lambda p: -(p["importo_programma_euro"] or 0))
        municipi[k] = {**riepilogo(v["progetti"]), "progetti": v["progetti"]}
    cit = {}
    for k, lst in cittadino.items():
        lst.sort(key=lambda p: -(p["importo_programma_euro"] or 0))
        cit[k] = {**riepilogo(lst), "progetti": lst}
    gruppi = list(municipi.values()) + list(cit.values())
    totale = {
        "n_progetti": sum(g["n_progetti"] for g in gruppi),
        "importo_totale_euro": round(sum(g["importo_totale_euro"] for g in gruppi), 2),
        "importo_schede_lordo_euro": round(sum(g["importo_schede_lordo_euro"] for g in gruppi), 2),
        "importo_municipi_euro": round(sum(m["importo_totale_euro"] for m in municipi.values()), 2),
        "importo_municipi_lordo_euro": round(sum(m["importo_schede_lordo_euro"] for m in municipi.values()), 2),
        "nota": "Somma dei 15 municipi e dei tre gruppi cittadini (piu_municipi, intermunicipale, senza_municipio).",
    }

    # check 3: nulla perso
    tot = sum(m["n_progetti"] for m in municipi.values()) + sum(v["n_progetti"] for v in cit.values())
    checks.append((f"progetti assegnati {tot} = schede lette {n_schede} - {n_divise} schede per singolo municipio "
                   f"+ {len(progetti) - (n_schede - n_divise)} record per municipio",
                   tot == len(progetti) and len(progetti) >= n_schede - n_divise))
    # check 5: importo del programma mai superiore all'importo lordo della scheda
    for c in progetti:
        if c["importo_programma_euro"] is not None:
            checks.append((f"importo programma <= lordo: {c['titolo'][:50]!r} {c['importo_programma_euro']:,.2f} <= "
                           f"{c['importo'] if c['importo'] is not None else 'null'}",
                           c["importo"] is not None and c["importo_programma_euro"] <= c["importo"] + 0.005))
    for k, g in [*municipi.items(), *cit.items()]:
        checks.append((f"{k}: totale programma {g['importo_totale_euro']:,.2f} <= lordo {g['importo_schede_lordo_euro']:,.2f}",
                       g["importo_totale_euro"] <= g["importo_schede_lordo_euro"] + 0.01))
    # check 4: CUP duplicati tra progetti
    cup_owner = defaultdict(list)
    for c in progetti:
        for cup in c["cup"] or []:
            cup_owner[cup].append(f"{c['programma']}: {c['titolo'][:50]}")
    dup = {k: v for k, v in cup_owner.items() if len(v) > 1}

    print("\nCONTROLLI")
    for msg, ok in checks:
        if not ok or not msg.startswith("importo programma <="):
            print(("  OK   " if ok else "  FAIL ") + msg)
    print(f"  ... e {sum(1 for m, _ in checks if m.startswith('importo programma <='))} controlli 'importo programma <= lordo'")
    n_cup = sum(1 for c in progetti if c["cup"])
    n_imp = sum(1 for c in progetti if c["importo"] is not None)
    print(f"  schede con almeno un CUP: {n_cup}/{len(progetti)}; con importo leggibile: {n_imp}/{len(progetti)}")
    print(f"  CUP presenti in più schede: {len(dup)}")
    for k, v in list(dup.items())[:10]:
        print(f"    {k}: {v}")
    print("\nIMPORTO DEL PROGRAMMA (schede con più cifre)")
    for c in progetti:
        if c["importo_programma_metodo"] and c["importo_programma_metodo"] != "cifra unica":
            print(f"    [{c['programma'][:12]}] {c['importo_programma_euro'] if c['importo_programma_euro'] is None else format(c['importo_programma_euro'], ',.2f')}"
                  f" ({c['importo_programma_metodo']}) lordo {'null' if c['importo'] is None else format(c['importo'], ',.2f')} <-{c['importo_testo'][:110]!r}")
    senza = [c for c in progetti if c["importo"] is None]
    for c in senza[:60]:
        print(f"    importo non leggibile [{c['programma']}] {c['titolo'][:50]!r}: {c['importo_testo']!r}")
    print("\nMUNICIPIO DA TESTO (scheda senza campo Municipio)")
    for c in progetti:
        if c["municipio_fonte"] in ("testo_scheda", "testo_programma"):
            print(f"    {c['municipio']:>2} {c['municipio_fonte']:<15} {c['titolo'][:55]!r} <- {c['municipio_evidenza']!r}")
    print("\nDOPPIONI CUP + IMPORTO (contati una volta)")
    for k, g in [*municipi.items(), *cit.items()]:
        for p in g["progetti"]:
            if not p["contato_nel_totale"]:
                print(f"    {k}: {p['cup']} {p['importo_programma_euro']:,.2f} {p['titolo'][:50]!r}")

    print("\nPER MUNICIPIO (importo del programma | lordo delle schede)")
    for k, m in municipi.items():
        pp = ", ".join(f"{n} {v['n_progetti']} / {v['importo_totale_euro']:,.0f}" for n, v in m["per_programma"].items())
        print(f"  {k:>2}: {m['n_progetti']:3d} progetti, {m['importo_totale_euro']:>16,.2f} | {m['importo_schede_lordo_euro']:>16,.2f}  [{pp}]")
    for k, v in cit.items():
        print(f"  cittadino/{k}: {v['n_progetti']} progetti, {v['importo_totale_euro']:,.2f} | {v['importo_schede_lordo_euro']:,.2f}")
    print(f"  totale: {totale['n_progetti']} progetti, {totale['importo_totale_euro']:,.2f} | {totale['importo_schede_lordo_euro']:,.2f}")

    fail = [m for m, ok in checks if not ok]
    if fail:
        print(f"\nERRORE: {len(fail)} controlli FAIL: snapshot non scritto", file=sys.stderr)
        sys.exit(1)

    verificato = datetime.date.fromtimestamp(min(p.stat().st_mtime for p in LETTI)).isoformat()
    snap = {
        "id": "progetti",
        "titolo": "Progetti PNRR, Giubileo 2025 e altri fondi straordinari per municipio",
        "fonte": {
            "nome": "Progetti PNRR e altri Fondi straordinari",
            "ente": "Roma Capitale",
            "url": f"{BASE}/web/it/progetti-pnrr-e-altri-fondi-straordinari.page",
            "pagine_programma": {n: i["url"] for n, i in programmi_info.items()},
            "licenza": LICENZA_RC,
        },
        "periodo": "Elenco pubblicato al momento della lettura (" + verificato + "); ogni progetto ha il suo periodo di attuazione.",
        "verificato": verificato,
        "misura": ("Numero di progetti e importo del programma per municipio. importo_totale_euro somma, per ogni "
                   "scheda, solo la parte dell'importo che appartiene al programma della scheda "
                   "(importo_programma_euro: PNRR, Giubileo 2025, PN Metro, DL Aiuti, fondi UE...), letta dalle "
                   "cifre etichettate nel testo 'Importo attribuito'; per i Fondi diretti UE la quota 'di competenza "
                   "di Roma Capitale' quando la scheda la indica; con una sola cifra senza etichetta, quella cifra. "
                   "Un CUP con lo stesso importo presente in più schede dello stesso municipio è contato una volta "
                   "(contato_nel_totale). importo_schede_lordo_euro è la somma di tutte le cifre scritte nelle schede "
                   "(il valore usato prima, che include cofinanziamenti di altre fonti). " + REGOLA_MUNICIPIO +
                   " attuatore = campo 'Struttura referente' della scheda. CUP letti dalla pagina di dettaglio del progetto."),
        "non_misura": [
            "Non è la spesa effettiva né i pagamenti: è l'importo attribuito (finanziamento assegnato) dichiarato nella scheda.",
            "Non comprende progetti di altri enti (Stato, Regione, Ferrovie, Anas, ecc.) sul territorio del municipio.",
            "I progetti con più municipi, 'Intermunicipale' o senza municipio sono nel bucket 'cittadino': gli importi non sono divisi tra municipi. Fanno eccezione le schede che indicano l'importo 'per singolo Municipio' con un CUP per ogni municipio: sono riportate in ogni municipio con la cifra scritta per quel municipio.",
            "Una scheda che la pagina ufficiale descrive come parte di un'altra scheda già contata (Parco Est e Parco Ovest, dentro i Piani Urbani Integrati Corviale del Municipio XI) resta in elenco ma non entra nei totali (contato_nel_totale false, doppione_di).",
            "Una scheda con il campo Municipio 'Intermunicipale' resta intermunicipale anche se il campo Luogo nomina un municipio: vale il campo della scheda.",
            "Importo senza cifra leggibile nella scheda (o nella pagina di dettaglio) resta null e non entra nei totali; lo stesso se la scheda elenca solo cifre di altre fonti.",
            "I cofinanziamenti di altre fonti scritti nella scheda (bilancio di Roma Capitale, MIT, project financing, un altro programma) non entrano in importo_totale_euro: restano in importo_schede_lordo_euro e in importo_componenti.",
            "Per i Fondi diretti UE senza quota di Roma Capitale indicata, l'importo è quello scritto nella scheda, che può essere l'intero progetto europeo con più partner.",
            "Lo 'stato' è quello della scheda (per il Giubileo la pagina rimanda all'Indice Interventi Giubileo per l'aggiornamento).",
            "Alcune schede raggruppano più CUP in un solo progetto (es. Piani Urbani Integrati).",
        ],
        "programmi": {n: {k: v for k, v in i.items() if k != "url"} for n, i in programmi_info.items()},
        "cup_in_piu_schede": dup,
        "totale": totale,
        "municipi": municipi,
        "cittadino": cit,
    }
    OUT.write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nscritto {OUT.relative_to(ROOT)} (verificato {verificato})")


if __name__ == "__main__":
    main()
