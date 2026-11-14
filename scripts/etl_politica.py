"""Organi politici dei 15 municipi: presidente, giunta, consiglio.

Fonte: https://www.comune.roma.it/web/it/organi-politici-dei-municipi.page?municipio=mun_<romano>
(una pagina per municipio, sezioni a fisarmonica "Presidente", "Giunta del Municipio",
"Consiglio del Municipio"). HTML in data/raw/politica/mun_<romano>.html: se manca viene
scaricato (1 richiesta al secondo, User-Agent generico).

Solo nomi, ruoli, deleghe e gruppi consiliari: niente telefoni, email o indirizzi.
Il gruppo consiliare è il titolo della tabella; se il titolo è vuoto si usa il nome del
file del simbolo (segnalato con gruppo_da_simbolo=true). Testi riportati come scritti,
senza correggere l'ordine nome/cognome. Campo assente sulla pagina = null.

Controlli bloccanti (se uno fallisce lo snapshot non viene scritto e lo script esce con 1):
- l'intestazione della pagina nomina il municipio giusto ("Municipio <romano>");
- il numero di consiglieri letti è uguale a quello dichiarato dalla pagina ("composto dal
  Presidente e 24 Consiglieri") o, se la pagina non lo dice, alla composizione prevista (24);
- il presidente della sezione Presidente coincide con quello indicato nella giunta.
"""
import datetime
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/politica"
OUT = ROOT / "data/snapshot/politica.json"
URL = "https://www.comune.roma.it/web/it/organi-politici-dei-municipi.page?municipio=mun_{}"
UA = "Mozilla/5.0 (compatible; civic-data-research)"
# RIFRESCA=1: riscarica le pagine anche se sono già in cache (lo usa ./aggiorna.sh senza argomenti).
RIFRESCA = os.environ.get("RIFRESCA") == "1"
# Composizione prevista del consiglio di ogni municipio (Presidente + 24 consiglieri), usata solo se
# la pagina non dichiara il numero.
CONSIGLIERI_ATTESI = 24
LICENZA_RC = ("Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 "
              "del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).")
CONSILIATURA_RE = re.compile(r"[Cc]onsiliatura\s+(\d{4})\s*[-–/]\s*(\d{4})")
ROMANI = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
          "xi", "xii", "xiii", "xiv", "xv"]
DATA_RE = re.compile(r"(?:data di aggiornamento|aggiornato al)\s*:?\s*(\d{1,2}/\d{1,2}/\d{4})?", re.I)


def fetch(r):
    path = RAW / f"mun_{r}.html"
    if not RIFRESCA and path.exists() and path.stat().st_size > 1000:
        return path.read_text(encoding="utf-8")
    time.sleep(1)
    out = subprocess.run(["curl", "-sS", "-L", "--fail", "--max-time", "60", "-A", UA, URL.format(r)],
                         capture_output=True, check=True).stdout.decode("utf-8", errors="replace")
    path.write_text(out, encoding="utf-8")
    return out


def clean(s):
    s = (s or "").replace("\xa0", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip(" -–—.;,:")


def lines(tag):
    """Testo di un elemento spezzato in righe su <p>, <br>, <li>, <tr>."""
    for br in tag.find_all("br"):
        br.replace_with(NavigableString("\n"))
    for t in tag.find_all(["p", "li", "tr", "div"]):
        t.insert_before(NavigableString("\n"))
        t.append(NavigableString("\n"))
    return [c for c in (clean(x) for x in tag.get_text().split("\n")) if c]


def sezione(soup, titolo):
    h4 = soup.find(lambda t: t.name == "h4" and clean(t.get_text()).lower().startswith(titolo.lower()))
    if not h4:
        return None
    acc = h4.find_parent("div", class_="Accordion")
    return acc.find("div", class_="Accordion-panel") if acc else None


def date_aggiornamento(panel):
    if panel is None:
        return []
    out = []
    for m in DATA_RE.finditer(panel.get_text(" ").replace("\xa0", " ")):
        if m.group(1):
            out.append(m.group(1))
    # anche "Aggiornato il 18.09.2026" a fondo sezione
    for m in re.finditer(r"Aggiornato il\s*(\d{1,2}\.\d{1,2}\.\d{4})", panel.get_text(" ")):
        out.append(m.group(1).replace(".", "/"))
    return out


def iso(d):
    if not d:
        return None
    g, m, a = d.split("/")
    return f"{a}-{int(m):02d}-{int(g):02d}"


RUOLO_RE = re.compile(
    r"\b(Presidente|Vice ?Presidente|Vicepresidente|Capogruppo|Vicecapogruppo|Vice ?capogruppo|"
    r"Consigliere|Consigliera)\b.*$", re.I)


def split_nome_ruolo(riga):
    riga = clean(riga)
    m = re.match(r"^(.*?)\s*\((.*)\)?\s*$", riga)
    if m and "(" in riga:
        nome, ruolo = m.group(1), m.group(2)
    elif " - " in riga or " – " in riga:
        nome, ruolo = re.split(r"\s+[-–]\s+", riga, maxsplit=1)
    else:
        m = RUOLO_RE.search(riga)
        if m and m.start() > 0:
            nome, ruolo = riga[:m.start()], riga[m.start():]
        else:
            nome, ruolo = riga, None
    nome = clean(nome)
    ruolo = clean((ruolo or "").strip("()")) or None
    return nome, ruolo


def parse_presidente(panel):
    """Nome in grassetto in testa alla sezione Presidente (prima di Competenze/Contatti), se presente."""
    if panel is None:
        return None
    for st in panel.find_all("strong"):
        t = clean(st.get_text())
        if not t:
            continue
        if re.match(r"(Competenze|Riferimenti|Contatti|Tel|e-?mail|data di aggiornamento|Segreteria|Ufficio)", t, re.I):
            return None  # il nome, se c'è, viene prima di queste etichette
        t = re.sub(r"^Presidente del Municipio[^:]*:\s*", "", t)
        return t or None
    return None


def parse_giunta(panel):
    if panel is None:
        return []
    membri = []
    for det in panel.select("div.Person--details"):
        li = det.find("li")
        if not li:
            continue
        strong = li.find("strong")
        nome = clean(strong.get_text()) if strong else None
        ruolo = clean(li.get_text().replace(strong.get_text(), "", 1)) if strong else clean(li.get_text())
        deleghe = None
        sib = det.find_next_sibling()
        while sib is not None and sib.name == "br":
            sib = sib.find_next_sibling()
        if sib is not None and sib.name == "ul":
            deleghe = clean(sib.get_text(" ")) or None
        membri.append({"nome": nome or None, "ruolo": ruolo or None, "deleghe": deleghe})
    return membri


def gruppo_da_img(img):
    alt = img.get("alt") or img.get("src", "").rsplit("/", 1)[-1]
    alt = re.sub(r"\.(png|jpe?g|gif)$", "", alt, flags=re.I)
    alt = re.sub(r"(_d\d)+$", "", alt)
    alt = re.sub(r"^(Simbolo|Logo|SIMBOLO)[ _]+", "", alt)
    alt = re.sub(r"^mun_\d+_", "", alt)
    alt = re.sub(r"_\d+$", "", alt)
    return clean(alt.replace("_", " ")) or None


def parse_consiglio(panel):
    if panel is None:
        return None, [], []
    pres_cons = None
    for p in panel.find_all("p"):
        t = clean(p.get_text())
        m = re.match(r"Presidente del Consiglio(?: del Municipio(?: Roma [IVX]+)?)?\s*:?\s*(\S.+)$", t)
        if m:
            pres_cons = clean(m.group(1))
            break
    membri = []
    note = []
    for table in panel.find_all("table"):
        ths = [clean(th.get_text(" ")) for th in table.find_all("th")]
        head = clean(" ".join(t for t in ths if t))
        imgs = table.find_all("img")
        if "commission" in head.lower() or (not head and not imgs) or "Competenze" in table.get_text():
            continue
        gruppo, da_simbolo = head or None, False
        if not gruppo and imgs:
            gruppo, da_simbolo = gruppo_da_img(imgs[0]), True
        for th in table.find_all("thead"):
            th.decompose()
        for img in imgs:
            img.decompose()
        for tr in table.find_all("tr"):
            tds = [td for td in tr.find_all("td", recursive=False) if clean(td.get_text())]
            if not tds:
                continue
            if len(tds) >= 2:
                # tabella a colonne: nome | ruolo (es. Municipio VI)
                nomi, ruoli = lines(tds[0]), lines(tds[1])
                if len(nomi) == 1:
                    coppie = [(nomi[0], " ".join(ruoli) or None)]
                else:
                    coppie = [(n, None) for n in nomi]
                    if ruoli:
                        note.append(f"{gruppo}: ruoli {ruoli} non attribuibili con certezza a {nomi}")
                for n, ru in coppie:
                    membri.append({"nome": clean(n), "ruolo": clean(ru or "") or None, "gruppo": gruppo,
                                   **({"gruppo_da_simbolo": True} if da_simbolo else {})})
                continue
            for riga in lines(tds[0]):
                if re.fullmatch(r"[\W\d]*", riga):
                    continue
                nome, ruolo = split_nome_ruolo(riga)
                if not nome:
                    continue
                membri.append({"nome": nome, "ruolo": ruolo, "gruppo": gruppo,
                               **({"gruppo_da_simbolo": True} if da_simbolo else {})})
    return pres_cons, membri, note


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    municipi = {}
    problemi = []
    consiliature = set()
    for i, r in enumerate(ROMANI, start=1):
        html = fetch(r)
        consiliature.update(CONSILIATURA_RE.findall(html))
        soup = BeautifulSoup(html, "html.parser")
        h3 = soup.select_one("div.organi-politici-municipio h3")
        titolo = clean(h3.get_text()) if h3 else None
        if titolo != f"Municipio {r.upper()}":
            problemi.append(f"{i}: intestazione pagina {titolo!r}")
        p_pres, p_giunta, p_cons = (sezione(soup, "Presidente"), sezione(soup, "Giunta"),
                                     sezione(soup, "Consiglio del Municipio"))
        giunta = parse_giunta(p_giunta)
        pres_sez = parse_presidente(p_pres)
        pres_g = [g["nome"] for g in giunta if (g["ruolo"] or "").lower() == "presidente"]
        presidente = pres_g[0] if pres_g else pres_sez
        if pres_sez and presidente and pres_sez.lower() != presidente.lower():
            problemi.append(f"{i}: presidente nella sezione Presidente {pres_sez!r} vs giunta {presidente!r}")
        pres_cons, consiglio, note_cons = parse_consiglio(p_cons)
        date = {"presidente": [iso(d) for d in date_aggiornamento(p_pres)],
                "giunta": [iso(d) for d in date_aggiornamento(p_giunta)],
                "consiglio": [iso(d) for d in date_aggiornamento(p_cons)]}
        dates_all = [d for v in date.values() for d in v if d]
        gm = re.search(r"composto\s+dal\s+Presidente\s+e\s+(\d+)\s+Consiglieri",
                       p_cons.get_text(" ").replace("\xa0", " ") if p_cons else "")
        n_dichiarati = int(gm.group(1)) if gm else None
        pres_in_giunta = [g for g in giunta if (g["ruolo"] or "").lower() == "presidente"]
        assessori = [g for g in giunta if g not in pres_in_giunta]
        # il presidente del municipio a volte compare anche nella tabella del consiglio
        consiglieri = [c for c in consiglio if not re.search(r"Presidente del Municipio", c["ruolo"] or "", re.I)]
        municipi[str(i)] = {
            "pagina": URL.format(r),
            "presidente": presidente,
            "giunta": assessori,
            "presidente_deleghe": (pres_in_giunta[0]["deleghe"] or None) if pres_in_giunta else None,
            "consiglio": {
                "presidente_del_consiglio": pres_cons,
                "consiglieri_dichiarati_in_pagina": n_dichiarati,
                "consiglieri": consiglieri,
                "gruppi": sorted({c["gruppo"] for c in consiglieri if c["gruppo"]}),
                "note": note_cons or None,
            },
            "date_aggiornamento_sezioni": date,
            "ultimo_aggiornamento": max(dates_all) if dates_all else None,
            "campi_mancanti": [],
        }
        mm = municipi[str(i)]
        if not presidente:
            mm["campi_mancanti"].append("presidente")
        if not assessori:
            mm["campi_mancanti"].append("giunta")
        if any(a["deleghe"] is None for a in assessori):
            mm["campi_mancanti"].append("deleghe di alcuni assessori")
        if not consiglieri:
            mm["campi_mancanti"].append("consiglio")
        if any(c["gruppo"] is None for c in consiglieri):
            mm["campi_mancanti"].append("gruppo di alcuni consiglieri")
        if not dates_all:
            mm["campi_mancanti"].append("data di aggiornamento (la pagina riporta la dicitura senza data o non la riporta)")

    print("CONTROLLI")
    for k, m in municipi.items():
        n = len(m["consiglio"]["consiglieri"])
        att = m["consiglio"]["consiglieri_dichiarati_in_pagina"]
        ok = n == (att if att is not None else CONSIGLIERI_ATTESI)
        if not ok:
            problemi.append(f"{k}: consiglieri letti {n}, attesi {att if att is not None else CONSIGLIERI_ATTESI}")
        nomi = [c["nome"] for c in m["consiglio"]["consiglieri"]]
        dup = sorted({x for x in nomi if nomi.count(x) > 1})
        sospetti = [x for x in nomi if len(x.split()) < 2 or len(x.split()) > 5]
        print(f"  {'OK  ' if ok else 'FAIL'} mun {k:>2}: presidente={m['presidente']!r}, assessori={len(m['giunta'])}, "
              f"consiglieri letti={n} (pagina: Presidente + {att}), gruppi={len(m['consiglio']['gruppi'])}, "
              f"ultimo agg.={m['ultimo_aggiornamento']}" + (f", doppi={dup}" if dup else "")
              + (f", nomi sospetti={sospetti}" if sospetti else "") + (f", mancanti={m['campi_mancanti']}" if m['campi_mancanti'] else ""))
    for p in problemi:
        print("  FAIL", p)
    if problemi:
        print(f"ERRORE: {len(problemi)} controlli FAIL: snapshot non scritto", file=sys.stderr)
        sys.exit(1)

    verificato = datetime.date.fromtimestamp(min((RAW / f"mun_{r}.html").stat().st_mtime for r in ROMANI)).isoformat()
    periodo = "Composizione pubblicata sulle pagine al " + verificato + "."
    if len(consiliature) == 1:
        a, b = next(iter(consiliature))
        periodo += f" Consiliatura {a}-{b} (come indicato sulle pagine)."

    snap = {
        "id": "politica",
        "titolo": "Chi governa ogni municipio: presidente, giunta e consiglio",
        "fonte": {
            "nome": "Organi politici dei Municipi",
            "ente": "Roma Capitale",
            "url": "https://www.comune.roma.it/web/it/organi-politici-dei-municipi.page",
            "licenza": LICENZA_RC,
        },
        "periodo": periodo,
        "verificato": verificato,
        "misura": "Nomi e ruoli come pubblicati sulle pagine istituzionali dei municipi; gruppo consiliare dal titolo della tabella.",
        "non_misura": [
            "Nessun recapito personale (telefono, email, indirizzo) è riportato, anche se presente sulla pagina.",
            "La pagina può essere aggiornata in ritardo rispetto a dimissioni, surroghe o cambi di gruppo: vale la data di aggiornamento di ciascuna sezione.",
            "Il nome del gruppo è quello scritto sulla pagina; dove il titolo manca è ricavato dal nome del file del simbolo (gruppo_da_simbolo).",
            "Nomi riportati come scritti (in qualche caso cognome prima del nome).",
            "Le commissioni consiliari non sono incluse.",
            "Refusi della pagina non corretti (es. 'lacobelli' per Iacobelli nel Municipio XIII).",
            "Ruoli consiliari (capogruppo, vicepresidente) solo dove la pagina li indica; alcune pagine non li indicano affatto.",
        ],
        "municipi": municipi,
    }
    OUT.write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"scritto {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
