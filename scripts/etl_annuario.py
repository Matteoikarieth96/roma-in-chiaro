"""Profilo dei 15 municipi dall'Annuario statistico 2025 di Roma Capitale (agg. giugno 2026).

Ingresso: data/raw/annuario/Annuario_2025_agg.Giu_2026.pdf (copiato da una copia locale se
          indicata con --pdf, altrimenti scaricato da comune.roma.it).
Uscita:   data/snapshot/profilo_annuario.json

Regole: ogni numero viene letto da una tabella stampata, con tabella e pagina; nessun valore
stimato o ricalcolato finisce nello snapshot. Le somme dei 15 municipi (più le righe "non
localizzati" / "non indicato" quando stampate) devono tornare ai totali della tabella: se non
tornano lo script si ferma con errore. "-" nelle tabelle (convenzione Istat: fenomeno assente)
è letto come 0 solo nelle tabelle di conteggi dove le somme lo confermano.

Richiede pdftotext (poppler). Uso: .venv/bin/python -I scripts/etl_annuario.py [--pdf PATH]
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://www.comune.roma.it/web-resources/cms/documents/Annuario_2025_agg.Giu_2026.pdf"
RAW_DIR = ROOT / "data/raw/annuario"
PDF = RAW_DIR / "Annuario_2025_agg.Giu_2026.pdf"
OUT = ROOT / "data/snapshot/profilo_annuario.json"
# RIFRESCA=1: riscarica il PDF anche se è già in cache (lo usa ./aggiorna.sh senza argomenti).
RIFRESCA = os.environ.get("RIFRESCA") == "1"
LICENZA_RC = ("Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 "
              "del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).")

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
         "XI", "XII", "XIII", "XIV", "XV"]
NUM_RE = re.compile(r"^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?%?$|^-?\d+(?:,\d+)?%?$|^-$")
CHECKS = []


def fail(msg):
    print("ERRORE:", msg, file=sys.stderr)
    sys.exit(1)


def check(cond, msg):
    CHECKS.append(("OK " if cond else "KO ") + msg)
    print(("  OK  " if cond else "  KO  ") + msg)
    if not cond:
        fail(msg)


def num(tok):
    """Numero in formato italiano -> int o float. '-' -> 0."""
    if tok == "-":
        return 0
    t = tok.rstrip("%")
    if "," in t:
        return float(t.replace(".", "").replace(",", "."))
    return int(t.replace(".", ""))


# ---------------------------------------------------------------- PDF e pagine

def get_pdf(local):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if local and Path(local).exists():
        if Path(local).resolve() != PDF.resolve():
            shutil.copyfile(local, PDF)
    elif RIFRESCA or not PDF.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": "municipi-roma-soldi-etl"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if not data.startswith(b"%PDF"):
            fail(f"{URL} non ha restituito un PDF")
        tmp = PDF.with_suffix(".part")
        tmp.write_bytes(data)
        tmp.replace(PDF)
    data = PDF.read_bytes()
    if not data.startswith(b"%PDF"):
        fail(f"{PDF} non è un PDF")
    return hashlib.sha256(data).hexdigest()


def pdf_pages():
    out = subprocess.run(["pdftotext", "-layout", str(PDF), "-"],
                         check=True, capture_output=True, text=True).stdout
    pages = out.split("\f")
    if pages and not pages[-1].strip():
        pages = pages[:-1]
    return pages


def find_table(pages, code, seguito=False):
    """Pagina (1-based) dove inizia la tabella 'Tab.<code> - ' (esclude indici e 'segue')."""
    pat = re.compile(r"^\s*Tab\.\s?" + re.escape(code) + r"\s*-\s", re.M)
    hits = []
    for i, t in enumerate(pages):
        for m in pat.finditer(t):
            two_lines = t[m.start():].split("\n")[:2]
            # voce dell'indice di capitolo: riga che finisce con puntini + numero di pagina
            if any(re.search(r"\.{2,}\s*\d+\s*$", ln) for ln in two_lines):
                continue
            if re.search(r"^\s*Indice\s*$", t, re.M):
                continue
            hits.append(i + 1)
    hits = sorted(set(hits))
    if len(hits) != 1:
        fail(f"Tab.{code}: attese 1 pagina, trovate {hits}")
    p = hits[0]
    text = pages[p - 1]
    m = re.search(r"Cap\.\s*(\d+)\s*-\s*Pag\.\s*(\d+)", text)
    pag_cap = f"Cap. {m.group(1)} - Pag. {m.group(2)}" if m else None
    if seguito:
        nxt = pages[p]
        if f"segue Tab.{code}" not in nxt:
            fail(f"Tab.{code}: seguito non trovato a pagina {p + 1}")
    return p, pag_cap


def table_block(page_text, code, start_tag=None):
    """Testo dalla riga del titolo della tabella alla prima riga 'Fonte'."""
    i = page_text.find(start_tag or f"Tab.{code} ")
    if i < 0:
        i = page_text.find(f"Tab.{code}")
    if i < 0:
        fail(f"Tab.{code}: titolo non trovato nella pagina")
    rest = page_text[i:]
    j = rest.find("Fonte")
    if j < 0:
        j = rest.find("Elaborazioni")
    return rest[:j] if j > 0 else rest


def split_row(line):
    toks = line.split()
    k = 0
    while k < len(toks) and not NUM_RE.match(toks[k]):
        k += 1
    label = " ".join(toks[:k])
    label = re.sub(r"\s*\(\*+\)", "", label).strip()
    if not all(NUM_RE.match(t) for t in toks[k:]):
        return label, []  # riga di testo (titolo, intestazione), non di dati
    return label, [num(t) for t in toks[k:]]


def rows_by_label(block, first_only=True):
    """{etichetta: [numeri]} per ogni riga con numeri; tiene la prima occorrenza."""
    out = {}
    for line in block.splitlines():
        label, nums = split_row(line)
        if not label or not nums:
            continue
        if first_only and label in out:
            continue
        out[label] = nums
    return out


def municipi_values(rows, idx, code):
    vals = {}
    for i, r in enumerate(ROMAN, start=1):
        if r not in rows:
            fail(f"Tab.{code}: riga municipio {r} mancante")
        vals[str(i)] = rows[r][idx]
    return vals


def get_row(rows, names, code):
    for n in names:
        for lab, v in rows.items():
            if lab.lower() == n.lower():
                return v
    fail(f"Tab.{code}: riga {names} mancante")


def close(a, b, tol):
    return abs(a - b) <= tol


# ---------------------------------------------------------------- estrazione

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", help="copia locale del PDF (altrimenti download)")
    args = ap.parse_args()

    sha = get_pdf(args.pdf)
    pages = pdf_pages()
    print(f"PDF {PDF.name}: {len(pages)} pagine, sha256 {sha[:16]}...")
    if len(pages) != 515:
        fail(f"attese 515 pagine, trovate {len(pages)}")

    ind = {}      # indicatori
    mun = {str(i): {} for i in range(1, 16)}
    roma = {}

    def put(key, meta, vals, roma_tot=None, extra_roma=None):
        ind[key] = meta
        for m, v in vals.items():
            mun[m][key] = v
        if roma_tot is not None:
            roma[key] = roma_tot
        for k, v in (extra_roma or {}).items():
            roma[f"{key}__{k}"] = v

    def meta(etichetta, unita, periodo, code, page, misura, non_misura):
        p, pc = page
        return {"etichetta": etichetta, "unita": unita, "periodo": periodo,
                "tabella": f"Tab. {code}", "pagina": p, "pagina_capitolo": pc,
                "misura": misura, "non_misura": non_misura}

    CONFINI = ("Confini: dal 2021 la zona urbanistica 8A è passata dal VI al VII; dal 12/01/2024 "
               "parti delle zone 5F, 5L (dal IV) e 8D (dal VI) sono passate al V. Confronti nel "
               "tempo per IV, V, VI e VII non omogenei.")

    # ---- Tab 1.2: superficie, popolazione, densità al 31.12.2025
    print("\nTab. 1.2")
    pg = find_table(pages, "1.2")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "1.2"))
    area = municipi_values(rows, 0, "1.2")
    pop = municipi_values(rows, 1, "1.2")
    dens = municipi_values(rows, 2, "1.2")
    nonloc = get_row(rows, ["non localizzati"], "1.2")
    tot = get_row(rows, ["Roma"], "1.2")
    if len(nonloc) != 1:
        fail("Tab.1.2: riga non localizzati inattesa")
    check(sum(pop.values()) + nonloc[0] == tot[1],
          f"Tab.1.2 popolazione: somma 15 municipi {sum(pop.values()):,} + non localizzati "
          f"{nonloc[0]} = {sum(pop.values()) + nonloc[0]:,} vs Roma {tot[1]:,}")
    check(tot[1] == 2803873, "Tab.1.2 totale Roma = 2.803.873")
    check(close(sum(area.values()), tot[0], 0.05),
          f"Tab.1.2 superficie: somma {sum(area.values()):.2f} vs Roma {tot[0]} kmq (arrot. 0,05)")
    # la superficie è stampata con 2 decimali: la densità è coerente se pop/densità arrotonda alla superficie
    bad = [m for m in pop if not close(pop[m] / dens[m], area[m], 0.0051)]
    check(not bad, f"Tab.1.2 densità coerente: popolazione/densità = superficie stampata (±0,005 kmq) {bad or ''}")
    check(close(tot[1] / tot[0], tot[2], 0.5), "Tab.1.2 densità Roma = popolazione/superficie")
    period = "31/12/2025"
    put("popolazione", meta("Residenti", "persone", period, "1.2", pg,
        "Popolazione residente iscritta in anagrafe per municipio al 31/12/2025.",
        ["Non include i 195 residenti 'non localizzati' (presenti nel totale di Roma).",
         "Dato anagrafico comunale, non il censimento permanente Istat.", CONFINI]),
        pop, tot[1], {"non_localizzati": nonloc[0]})
    put("superficie_kmq", meta("Superficie", "km²", period, "1.2", pg,
        "Superficie del municipio in km².", ["Superficie amministrativa totale, comprese aree non abitate."]),
        area, tot[0])
    put("densita_ab_kmq", meta("Densità abitativa", "abitanti per km²", period, "1.2", pg,
        "Residenti per km² come stampato nella tabella.",
        ["Media su tutta la superficie, comprese aree agricole e verdi."]), dens, tot[2])

    # ---- Tab 2.5: residenti 65+ al 31.12.2024 (blocco Maschi e Femmine)
    print("\nTab. 2.5")
    pg = find_table(pages, "2.5")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "2.5"))  # prima occorrenza = M+F
    p65 = municipi_values(rows, 4, "2.5")
    q65 = municipi_values(rows, 5, "2.5")
    pt24 = municipi_values(rows, 6, "2.5")
    nl = get_row(rows, ["Non localizzati"], "2.5")
    tt = get_row(rows, ["Totale"], "2.5")
    check(sum(p65.values()) + nl[4] == tt[4],
          f"Tab.2.5 65+: somma {sum(p65.values()):,} + non localizzati {nl[4]} = {tt[4]:,}")
    check(sum(pt24.values()) + nl[6] == tt[6],
          f"Tab.2.5 totale 2024: somma {sum(pt24.values()):,} + non localizzati {nl[6]} = {tt[6]:,}")
    bad = [m for m in p65 if not close(100 * p65[m] / pt24[m], q65[m], 0.051)]
    check(not bad, f"Tab.2.5 quota 65+ stampata coerente con i conteggi (±0,05) {bad or ''}")
    period = "31/12/2024"
    nm = ["Data di riferimento 31/12/2024, un anno prima della popolazione di Tab. 1.2: "
          "non dividere per la popolazione 2025.", CONFINI]
    put("residenti_2024", meta("Residenti (anagrafe, base per età e cittadinanza)", "persone", period,
        "2.5", pg, "Totale iscritti in anagrafe al 31/12/2024, denominatore delle quote 65+ e stranieri.",
        nm + ["Escluse 568 persone non localizzate (nel totale di Roma)."]),
        pt24, tt[6], {"non_localizzati": nl[6]})
    put("residenti_65_e_oltre", meta("Residenti con 65 anni e più", "persone", period, "2.5", pg,
        "Iscritti in anagrafe con 65 anni e oltre.", nm), p65, tt[4], {"non_localizzati": nl[4]})
    put("quota_65_e_oltre_pct", meta("Quota di residenti con 65 anni e più", "%", period, "2.5", pg,
        "Percentuale stampata: residenti 65+ sul totale dei residenti del municipio.", nm),
        q65, tt[5])

    # ---- Tab 2.7: stranieri al 31.12.2024
    print("\nTab. 2.7")
    pg = find_table(pages, "2.7")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "2.7"))
    stra = municipi_values(rows, 1, "2.7")
    tot27 = municipi_values(rows, 2, "2.7")
    qst = municipi_values(rows, 3, "2.7")
    nl = get_row(rows, ["Non localizzati"], "2.7")
    tt = get_row(rows, ["Totale"], "2.7")
    check(sum(stra.values()) + nl[1] == tt[1],
          f"Tab.2.7 stranieri: somma {sum(stra.values()):,} + non localizzati {nl[1]} = {tt[1]:,}")
    check(tot27 == pt24, "Tab.2.7 totali per municipio = Tab.2.5")
    bad = [m for m in stra if not close(100 * stra[m] / tot27[m], qst[m], 0.051)]
    check(not bad, f"Tab.2.7 quota stranieri stampata coerente (±0,05) {bad or ''}")
    put("stranieri", meta("Residenti con cittadinanza straniera", "persone", period, "2.7", pg,
        "Iscritti in anagrafe con cittadinanza non italiana.",
        nm + ["Non conta i cittadini italiani di origine straniera né i non iscritti in anagrafe."]),
        stra, tt[1], {"non_localizzati": nl[1]})
    put("quota_stranieri_pct", meta("Quota di residenti stranieri", "%", period, "2.7", pg,
        "Percentuale stampata: stranieri sul totale dei residenti del municipio.", nm), qst, tt[3])

    # ---- Cap. 13 redditi (anno d'imposta 2023)
    period = "anno d'imposta 2023"
    nm13 = ["Contribuenti attribuiti al municipio di residenza; la riga 'Non indicato' "
            "(contribuenti senza municipio, inclusi non residenti a Roma) è nel totale di Roma ma in nessun municipio.",
            "Reddito imponibile IRPEF dichiarato, non reddito disponibile né ricchezza; esclusi redditi "
            "esenti, a tassazione separata o sostitutiva (es. cedolare secca, flat tax forfettari).",
            "Le intestazioni di pagina del capitolo 13 riportano 'Annuario statistico 2024': i dati sono "
            "quelli stampati nell'Annuario 2025.",
            "Le tabelle non indicano con quali confini municipali sono attribuiti i contribuenti."]
    print("\nTab. 13.1")
    pg = find_table(pages, "13.1")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "13.1", "Tab.13.1 -"))
    contr = municipi_values(rows, 0, "13.1")
    res = get_row(rows, ["Totale residenti"], "13.1")
    ni = get_row(rows, ["Non indicato"], "13.1")
    tt = get_row(rows, ["Totale"], "13.1")
    check(sum(contr.values()) == res[0],
          f"Tab.13.1 contribuenti: somma {sum(contr.values()):,} = Totale residenti {res[0]:,}")
    check(res[0] + ni[0] == tt[0], f"Tab.13.1 Totale residenti + Non indicato {ni[0]:,} = Totale {tt[0]:,}")
    put("contribuenti", meta("Contribuenti IRPEF", "persone", period, "13.1", pg,
        "Numero di contribuenti (dichiaranti) residenti nel municipio.", nm13),
        contr, tt[0], {"somma_municipi": res[0], "non_localizzati": ni[0]})

    print("\nTab. 13.6")
    pg = find_table(pages, "13.6")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "13.6"))
    red = municipi_values(rows, 2, "13.6")
    ita = municipi_values(rows, 0, "13.6")
    st = municipi_values(rows, 1, "13.6")
    res = get_row(rows, ["Totale residenti"], "13.6")
    ni = get_row(rows, ["Non indicato"], "13.6")
    tt = get_row(rows, ["Totale"], "13.6")
    d = sum(red.values()) - res[2]
    check(abs(d) <= 15, f"Tab.13.6 reddito: somma {sum(red.values()):,} vs Totale residenti {res[2]:,} (diff {d} €, arrot. ≤15 €)")
    d2 = res[2] + ni[2] - tt[2]
    check(abs(d2) <= 2, f"Tab.13.6 Totale residenti + Non indicato vs Totale {tt[2]:,} (diff {d2} €)")
    bad = [m for m in red if abs(ita[m] + st[m] - red[m]) > 2]
    check(not bad, f"Tab.13.6 italiani + stranieri = totale per municipio (±2 €) {bad or ''}")
    put("reddito_imponibile_totale_eur", meta("Reddito imponibile totale", "€", period, "13.6", pg,
        "Somma del reddito individuale imponibile IRPEF dei contribuenti del municipio.",
        nm13 + ["Valori stampati arrotondati all'euro: la somma dei municipi differisce dal totale di "
                f"{d} €."]), red, tt[2], {"somma_municipi": res[2], "non_localizzati": ni[2]})

    print("\nTab. 13.3")
    pg = find_table(pages, "13.3")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "13.3"))
    avg = municipi_values(rows, 0, "13.3")
    res = get_row(rows, ["Totale residenti"], "13.3")
    ni = get_row(rows, ["Non indicato"], "13.3")
    tt = get_row(rows, ["Totale"], "13.3")
    bad = [m for m in avg if not close(red[m] / contr[m], avg[m], 1.0)]
    check(not bad, f"Tab.13.3 media = Tab.13.6 / Tab.13.1 per municipio (±1 €) {bad or ''}")
    s = sum(red.values()) / sum(contr.values())
    check(close(s, res[0], 1.0), f"Tab.13.3 media residenti {res[0]} = {s:.2f} da 13.6/13.1")
    put("reddito_imponibile_medio_eur", meta("Reddito imponibile medio per contribuente", "€", period,
        "13.3", pg, "Reddito individuale imponibile IRPEF medio per contribuente del municipio.",
        nm13 + ["Media aritmetica: pochi redditi molto alti la alzano; non è il reddito tipico (mediana).",
                "Il totale di Roma (riga 'Totale') include i contribuenti 'Non indicato' con media "
                f"{ni[0]} €: per confrontare i municipi usare roma.reddito_imponibile_medio_eur__somma_municipi ({res[0]} €)."]),
        avg, tt[0], {"somma_municipi": res[0], "non_localizzati": ni[0]})

    print("\nTab. 13.10")
    pg = find_table(pages, "13.10")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "13.10"))
    add_m = municipi_values(rows, 0, "13.10")
    add_t = municipi_values(rows, 1, "13.10")
    res = get_row(rows, ["Totale Residenti"], "13.10")
    ni = get_row(rows, ["Non indicato"], "13.10")
    tt = get_row(rows, ["Totale"], "13.10")
    d = sum(add_t.values()) - res[1]
    check(abs(d) <= 15, f"Tab.13.10 addizionale: somma {sum(add_t.values()):,} vs Totale Residenti {res[1]:,} (diff {d} €)")
    check(abs(res[1] + ni[1] - tt[1]) <= 2, f"Tab.13.10 Totale Residenti + Non indicato = Totale {tt[1]:,}")
    bad = [m for m in add_m if not close(add_t[m] / contr[m], add_m[m], 0.05)]
    check(not bad, f"Tab.13.10 media = totale / contribuenti Tab.13.1 (±0,05 €) {bad or ''}")
    nm_add = nm13[:1] + nm13[2:] + [
        "Addizionale comunale IRPEF dovuta/versata secondo le dichiarazioni dei residenti nel municipio: "
        "è un'entrata del bilancio di Roma Capitale, non del municipio.",
        "La media è per contribuente (inclusi quelli che non la pagano perché sotto soglia)."]
    put("addizionale_comunale_totale_eur", meta("Addizionale comunale IRPEF versata", "€", period, "13.10",
        pg, "Totale dell'addizionale comunale IRPEF versata dai contribuenti del municipio.",
        nm_add + [f"Somma dei municipi differisce dal totale stampato di {d} € (arrotondamenti)."]),
        add_t, tt[1], {"somma_municipi": res[1], "non_localizzati": ni[1]})
    put("addizionale_comunale_media_eur", meta("Addizionale comunale IRPEF media per contribuente", "€",
        period, "13.10", pg, "Addizionale comunale IRPEF media per contribuente del municipio.", nm_add),
        add_m, tt[0], {"somma_municipi": res[0], "non_localizzati": ni[0]})

    # ---- Cap. 10 unità locali (2024)
    period = "2024"
    nm10 = ["Unità locali (sedi e sedi secondarie) di imprese iscritte al Registro delle imprese "
            "(InfoCamere): non conta enti pubblici, non profit non iscritti, lavoratori autonomi non iscritti.",
            "Conteggio di sedi, non di addetti né di fatturato.",
            "La riga 'UL non localizzate nei Municipi' è nel totale di Roma ma in nessun municipio.",
            "Le tabelle non indicano con quali confini municipali sono attribuite le unità locali."]
    for code, key, lab, mis in [
            ("10.1", "unita_locali_registrate", "Unità locali di imprese registrate",
             "Unità locali di imprese registrate (attive e non) al 2024."),
            ("10.2", "unita_locali_attive", "Unità locali di imprese attive",
             "Unità locali di imprese attive al 2024.")]:
        print(f"\nTab. {code}")
        pg = find_table(pages, code)
        rows = rows_by_label(table_block(pages[pg[0] - 1], code))
        v = municipi_values(rows, 2, code)
        loc = get_row(rows, ["Totale UL localizzate nei Municipi"], code)
        nl = get_row(rows, ["UL non localizzate nei Municipi"], code)
        tt = get_row(rows, ["Totale"], code)
        check(sum(v.values()) == loc[1], f"Tab.{code} 2024: somma {sum(v.values()):,} = localizzate {loc[1]:,}")
        check(loc[1] + nl[2] == tt[1], f"Tab.{code} 2024: localizzate + non localizzate {nl[2]:,} = Totale {tt[1]:,}")
        put(key, meta(lab, "unità locali", period, code, pg, mis, nm10),
            v, tt[1], {"somma_municipi": loc[1], "non_localizzati": nl[2]})
        if code == "10.2":
            ul_att = v
            ul_att_nl = nl[2]
            ul_att_tot = tt[1]

    print("\nTab. 10.8")
    pg = find_table(pages, "10.8", seguito=True)
    # i nomi dei settori vanno a capo in modo diverso sulle due pagine: chiave = prime 3 parole
    sectors = {}
    order = []
    for part, ncols, cols in [(pages[pg[0] - 1], 9, ROMAN[:9]),
                              (pages[pg[0]], 8, ROMAN[9:] + ["NL", "TOT"])]:
        block = table_block(part, "10.8", "Tab.10.8" if "segue" not in part else "segue Tab.10.8")
        prev = ""
        seen = []
        for line in block.splitlines()[1:]:
            toks = line.split()
            if len(toks) >= ncols and all(NUM_RE.match(t) for t in toks[-ncols:]):
                label = (" ".join(toks[:-ncols]) or prev).strip()
                key = " ".join(label.split()[:3])
                vals = [num(t) for t in toks[-ncols:]]
                sectors.setdefault(key, {}).update(dict(zip(cols, vals)))
                seen.append(key)
                prev = ""
            elif line.strip():
                prev = line.strip()
        order.append(seen)
    check(order[0] == order[1], "Tab.10.8: stesse righe, stesso ordine sulle due pagine")
    want = {"commercio": ("Commercio all'ingrosso e", "Commercio all'ingrosso e al dettaglio, riparazione di autoveicoli e motocicli"),
            "costruzioni": ("Costruzioni", "Costruzioni"),
            "alloggio_ristorazione": ("Attività dei servizi", "Attività dei servizi di alloggio e di ristorazione"),
            "professionali_tecniche": ("Attività professionali scientifiche", "Attività professionali scientifiche e tecniche")}
    if "Totale" not in sectors or len(sectors["Totale"]) != 17:
        fail(f"Tab.10.8: riga Totale incompleta {sectors.get('Totale')}")
    sec_rows = {k: v for k, v in sectors.items() if k != "Totale"}
    check(len(sec_rows) == 22 and all(len(v) == 17 for v in sec_rows.values()),
          f"Tab.10.8: 22 settori x 17 colonne letti ({len(sec_rows)} settori)")
    cols_all = ROMAN + ["NL", "TOT"]
    bad = [c for c in cols_all if sum(v[c] for v in sec_rows.values()) != sectors["Totale"][c]]
    check(not bad, f"Tab.10.8: somma dei settori = Totale in ogni colonna {bad or ''}")
    bad = [k for k, v in sectors.items() if sum(v[r] for r in ROMAN) + v["NL"] != v["TOT"]]
    check(not bad, f"Tab.10.8: 15 municipi + non localizzate = Totale per ogni settore {bad or ''}")
    check(all(sectors["Totale"][r] == ul_att[str(i)] for i, r in enumerate(ROMAN, 1))
          and sectors["Totale"]["NL"] == ul_att_nl and sectors["Totale"]["TOT"] == ul_att_tot,
          "Tab.10.8 Totale = Tab.10.2 (2024) per municipio, non localizzate e Roma")
    for k, (key3, nome) in want.items():
        if key3 not in sec_rows:
            fail(f"Tab.10.8: settore '{key3}' non trovato")
        row = sec_rows[key3]
        put(f"unita_locali_attive_{k}", meta(f"Unità locali attive: {nome}", "unità locali", period,
            "10.8", pg, f"Unità locali attive di imprese nel settore ATECO '{nome}'.",
            nm10 + ["Tabella su due pagine: municipi I-IX a p. %d, X-XV e totali a p. %d." % (pg[0], pg[0] + 1),
                    "Nel 2024 il 5,13% delle unità locali attive di Roma non ha codice ATECO "
                    "('Non classificate'), contro il 2,92% del 2023 (Tab. 10.7): i conteggi per settore "
                    "possono essere sottostimati."]),
            {str(i): row[r] for i, r in enumerate(ROMAN, 1)}, row["TOT"], {"non_localizzati": row["NL"]})

    # ---- Cap. 5 servizi (asili nido, anziani)
    nm5 = ["Le intestazioni di pagina del capitolo 5 riportano 'Annuario statistico 2023': i dati sono "
           "quelli stampati nell'Annuario 2025.", "'-' nella tabella letto come 0 (fenomeno assente); le somme lo confermano."]
    print("\nTab. 5.2")
    pg = find_table(pages, "5.2")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "5.2"))
    nidi = municipi_values(rows, 2, "5.2")
    cap_ = municipi_values(rows, 0, "5.2")
    sp = municipi_values(rows, 1, "5.2")
    tt = get_row(rows, ["Totale"], "5.2")
    check(sum(nidi.values()) == tt[2], f"Tab.5.2 nidi comunali: somma {sum(nidi.values())} = Totale {tt[2]}")
    bad = [m for m in nidi if cap_[m] + sp[m] != nidi[m]]
    check(not bad, f"Tab.5.2 asili capitolini + sezioni ponte = totale comunale {bad or ''}")
    put("asili_nido_comunali", meta("Asili nido comunali a gestione diretta", "strutture",
        "anno educativo 2024/2025", "5.2", pg,
        "Asili nido capitolini più sezioni ponte gestiti direttamente da Roma Capitale.",
        nm5 + [f"Esclusi i nidi privati a gestione comunale indiretta ({tt[9]} a Roma) e i privati autorizzati ({tt[11]}).",
               "Numero di strutture, non di posti.", "Dati MESIS aggiornati al 31/07/2025."]),
        nidi, tt[2])

    print("\nTab. 5.8")
    pg = find_table(pages, "5.8")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "5.8"))
    cols = {c: municipi_values(rows, i, "5.8") for i, c in enumerate(["dom", "ini", "fin", "sodd", "pct"])}
    tt = get_row(rows, ["Totali"], "5.8")
    for i, c in enumerate(["dom", "ini", "fin", "sodd"]):
        check(sum(cols[c].values()) == tt[i], f"Tab.5.8 colonna {c}: somma {sum(cols[c].values()):,} = Totali {tt[i]:,}")
    bad = [m for m in cols["ini"] if cols["ini"][m] - cols["fin"][m] != cols["sodd"][m]]
    check(not bad, f"Tab.5.8 lista iniziale - finale = domande soddisfatte {bad or ''}")
    bad = [m for m in cols["pct"] if not close(100 * cols["sodd"][m] / cols["ini"][m], cols["pct"][m], 0.051)]
    check(not bad, f"Tab.5.8 livello di soddisfazione = soddisfatte / lista iniziale (±0,05) {bad or ''}")
    put("nido_lista_attesa_finale", meta("Bambini in lista d'attesa per il nido (fine anno)", "bambini",
        "anno educativo 2024/2025", "5.8", pg,
        "Bambini rimasti in lista d'attesa a fine graduatoria (lista d'attesa attuale/finale).",
        nm5 + ["Riguarda le domande per i nidi del sistema comunale; non misura la domanda potenziale totale.",
               f"A Roma: {tt[0]:,} domande valide, {tt[1]:,} in lista iniziale, livello di soddisfazione {tt[4]}%.",
               "Dati MESIS aggiornati al 31/07/2025."]), cols["fin"], tt[2])

    print("\nTab. 5.12")
    pg = find_table(pages, "5.12")
    rows = rows_by_label(table_block(pages[pg[0] - 1], "5.12"))
    an = municipi_values(rows, 6, "5.12")
    parts = [municipi_values(rows, i, "5.12") for i in range(6)]
    tt = get_row(rows, ["Totale"], "5.12")
    check(sum(an.values()) == tt[6], f"Tab.5.12 anziani assistiti: somma {sum(an.values()):,} = TOTALE {tt[6]:,}")
    bad = [m for m in an if sum(p[m] for p in parts) != an[m]]
    check(not bad, f"Tab.5.12 somma delle tipologie = TOTALE per municipio {bad or ''}")
    put("anziani_assistiti", meta("Anziani assistiti dai servizi municipali", "persone", "2024", "5.12", pg,
        "Anziani che usufruiscono di assistenza fornita dai municipi (indigenti con contributo retta, "
        "economica, domiciliare SAISA, pacchetto famiglia, Alzheimer, dimissioni protette).",
        nm5 + [f"Esclusi gli utenti dei centri diurni per anziani fragili ({tt[8]} a Roma) e i centri sociali anziani.",
               "Fonte primaria: Ragioneria Generale, Relazione al Rendiconto 2024.",
               "Conteggio di utenti per tipologia: una persona con più servizi potrebbe essere contata più volte "
               "(la tabella non lo precisa)."]), an, tt[6])

    snap = {
        "id": "profilo_annuario",
        "titolo": "Profilo dei municipi: popolazione, redditi, imprese e servizi (Annuario statistico 2025 di Roma Capitale)",
        "fonte": {
            "nome": "Annuario statistico 2025 (aggiornamento giugno 2026)",
            "ente": "Roma Capitale - Ufficio di Statistica",
            "url": URL,
            "licenza": LICENZA_RC,
        },
        "verificato": datetime.date.fromtimestamp(PDF.stat().st_mtime).isoformat(),
        "indicatori": ind,
        "municipi": mun,
        "roma": roma,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snap, ensure_ascii=False, indent=1) + "\n")
    print(f"\n{len(CHECKS)} controlli superati. {len(ind)} indicatori x 15 municipi -> {OUT.relative_to(ROOT)}")
    print(f"PDF sha256 {sha}")


if __name__ == "__main__":
    main()
