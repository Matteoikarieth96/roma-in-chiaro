"""Bilancio dei 15 municipi dal Piano Esecutivo di Gestione (PEG) 2026-2028 di Roma Capitale.

Fonte: Deliberazione di Giunta Capitolina n. 110 del 16 aprile 2026, "Piano Esecutivo di
Gestione 2026-2028", pubblicata in Amministrazione trasparente con due allegati:

- "Allegato A" (Ripartizione delle risorse finanziarie, 838 pagine): una riga per
  capitolo-articolo, con struttura, missione, programma, titolo, macroaggregato e
  stanziamenti di competenza 2026/2027/2028 e di cassa 2026. Da qui vengono i numeri.
- "Allegato PEG 2026-2028" (202 pagine): sintesi per titolo e per struttura (pag. 8-24)
  e l'elenco delle strutture (sommario), da cui si verifica che i codici struttura
  TA..TQ sono i Municipi I..XV. Serve per i controlli incrociati.

Ingresso:  data/raw/bilancio/*.pdf (scaricati se mancano)
Uscita:    data/snapshot/bilancio_peg_2026.json

Controlli (falliscono con exit 1 se una somma non torna al centesimo):
 1. Allegato A: somma delle righe di spesa e di entrata = "Totale complessivo" stampato.
 2. Allegato A per titolo = tabelle "Stanziamenti di Entrata/Spesa da Bilancio" (Allegato PEG pag. 8).
 3. Per ogni municipio: entrate per titolo dell'Allegato A = tabella "Stanziamenti di Entrata
    per Struttura" dell'Allegato PEG (totale e ogni titolo).
 4. Per ogni struttura presente nella tabella "Stanziamenti di Spesa per Struttura" dell'Allegato
    PEG (che ne stampa solo una parte, vedi note): totale e titoli = Allegato A.
 5. Per ogni municipio: somme per titolo, per missione, per programma e per macroaggregato
    = totale del municipio; somma dei 15 municipi + altre strutture = totale di Roma Capitale.
 6. Allegato PEG: per ogni struttura la somma dei titoli = totale stampato della struttura,
    e la somma delle strutture = "Totale complessivo" stampato.

Il PDF è trattato come dato: nessun testo del PDF viene eseguito o interpretato come istruzione.
"""
import datetime
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import urllib.request

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/bilancio"
OUT = ROOT / "data/snapshot/bilancio_peg_2026.json"

URL_PAGINA = "https://www.comune.roma.it/web/it/amministrazione-trasparente-piano-esecutivo-di-gestione.page"
BASE = "https://www.comune.roma.it/servizi2/deliberazioniAttiWeb/showPdfDoc"
URL_DELIBERA = BASE + "?fun=deliberazioniAtti&par1=R0NE&par2=NjMyMA=="
URL_ALLEGATO_A = BASE + "?fun=deliberazioniAttiAllegato&par1=R0NE&par2=NjMyMA==&par3=Mg=="
URL_ALLEGATO_PEG = BASE + "?fun=deliberazioniAttiAllegato&par1=R0NE&par2=NjMyMA==&par3=MQ=="

PDF_A = RAW / "Allegato_A_PEG_2026-2028.pdf"
PDF_PEG = RAW / "Allegato_PEG_2026-2028.pdf"

# Codici struttura dei municipi come stampati nel sommario dell'Allegato PEG (pag. 4-5).
# La corrispondenza con il numero romano viene comunque verificata sul PDF a ogni esecuzione.
CODICI_MUNICIPI = ["TA", "TB", "TC", "TD", "TE", "TF", "TG", "TH", "TI", "TL", "TM", "TN", "TO", "TP", "TQ"]
ROMANI = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10,
          "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15}
# RIFRESCA=1: riscarica i PDF anche se sono già in cache (lo usa ./aggiorna.sh senza argomenti).
RIFRESCA = os.environ.get("RIFRESCA") == "1"
LICENZA_RC = ("Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 "
              "del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).")
COLONNE = ["competenza_2026", "cassa_2026", "competenza_2027", "competenza_2028"]
AMOUNT_RE = re.compile(r"^-?\d{1,3}(\.\d{3})*,\d{2}$")

errori = []


# ---------------------------------------------------------------- utilità

def scarica(path, url):
    if path.exists() and not RIFRESCA:
        return
    RAW.mkdir(parents=True, exist_ok=True)
    print(f"scarico {path.name} da {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (ETL dati pubblici)"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    if not data.startswith(b"%PDF"):
        sys.exit(f"ERRORE: {url} non ha restituito un PDF")
    tmp = path.with_suffix(".part")
    tmp.write_bytes(data)
    tmp.replace(path)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def importo(cella):
    """'1.234.567,89' -> Decimal; '-' o vuoto -> 0. Toglie gli spazi spuri che pdfplumber
    a volte inserisce dentro le cifre ('6 12.534,33'). Qualsiasi altro formato è un errore."""
    s = re.sub(r"\s+", "", cella or "")
    if s in ("", "-"):
        return Decimal(0)
    if not AMOUNT_RE.match(s):
        raise ValueError(f"importo non riconosciuto: {cella!r}")
    return Decimal(s.replace(".", "").replace(",", "."))


def testo(cella):
    # "economico-\npopolare" -> "economico-popolare" (a capo dopo un trattino nella cella)
    # ma "popolari -\nAnagrafe" resta "popolari - Anagrafe" (trattino preceduto da spazio)
    s = re.sub(r"(?<=\S)-\n", "-", cella or "")
    return re.sub(r"\s+", " ", s.replace("\n", " ")).strip()


def codice_nome(cella):
    """'12 - Diritti sociali...' -> ('12', 'Diritti sociali...')"""
    t = testo(cella)
    m = re.match(r"^([A-Z0-9.]+) - (.*)$", t)
    if not m:
        raise ValueError(f"cella codice-nome non riconosciuta: {cella!r}")
    return m.group(1), m.group(2)


def euro(d):
    """Decimal -> numero JSON in euro con 2 decimali."""
    return float(d.quantize(Decimal("0.01")))


def check(nome, atteso, trovato):
    ok = atteso == trovato
    stato = "OK " if ok else "ERR"
    print(f"  [{stato}] {nome}: stampato {atteso:,.2f} | ricalcolato {trovato:,.2f}")
    if not ok:
        errori.append(f"{nome}: stampato {atteso} ricalcolato {trovato}")


# ---------------------------------------------------------------- Allegato A

def leggi_allegato_a(path):
    """Restituisce (righe_spesa, righe_entrata, totale_spese_stampato, totale_entrate_stampato)."""
    spese, entrate = [], []
    tot_spese = tot_entrate = None
    with pdfplumber.open(path) as pdf:
        n = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            if i % 100 == 0:
                print(f"  Allegato A: pagina {i + 1}/{n}", flush=True)
            for table in page.extract_tables():
                for r in table:
                    primo = testo(r[0])
                    if primo.startswith("STRUTTURA"):
                        continue
                    if len(r) == 16:  # spese
                        if primo == "Totale complessivo":
                            tot_spese = [importo(x) for x in r[12:16]]
                            continue
                        str_c, str_n = codice_nome(r[0])
                        mis_c, mis_n = codice_nome(r[1])
                        prg_c, prg_n = codice_nome(r[2])
                        tit_c, tit_n = codice_nome(r[3])
                        mac_c, mac_n = codice_nome(r[4])
                        spese.append({
                            "pagina": i + 1, "struttura": str_c, "struttura_nome": str_n,
                            "missione": mis_c, "missione_nome": mis_n,
                            "programma": prg_c, "programma_nome": prg_n,
                            "titolo": tit_c, "titolo_nome": tit_n,
                            "macroaggregato": mac_c, "macroaggregato_nome": mac_n,
                            "capitolo": re.sub(r"\s+", "", r[8] or ""),
                            "crd_budget": testo(r[9]),
                            "importi": [importo(x) for x in r[12:16]],
                        })
                    elif len(r) == 10:  # entrate
                        if primo == "Totale complessivo":
                            tot_entrate = [importo(x) for x in r[6:10]]
                            continue
                        str_c, str_n = codice_nome(r[0])
                        tit_c, tit_n = codice_nome(r[1])
                        entrate.append({
                            "pagina": i + 1, "struttura": str_c, "struttura_nome": str_n,
                            "titolo": tit_c, "titolo_nome": tit_n,
                            "capitolo": re.sub(r"\s+", "", r[4] or ""),
                            "importi": [importo(x) for x in r[6:10]],
                        })
                    else:
                        raise ValueError(f"riga con {len(r)} colonne a pagina {i + 1}: {r}")
    if tot_spese is None or tot_entrate is None:
        sys.exit("ERRORE: 'Totale complessivo' non trovato nell'Allegato A")
    return spese, entrate, tot_spese, tot_entrate


# ---------------------------------------------------------------- Allegato PEG (sintesi)

def e_importo(c):
    return c is not None and (c.strip() == "-" or bool(AMOUNT_RE.match(re.sub(r"\s+", "", c))))


def righe_logiche(tab):
    """Le tabelle di sintesi hanno celle unite e colonne sfalsate, e a volte gli importi di una
    voce finiscono nella riga fisica successiva (senza etichetta). Restituisce righe logiche
    (etichetta, titolo, [4 importi]) fondendo le righe di continuazione."""
    out = []
    for r in tab:
        celle_testo = [testo(c) for c in r if c and not e_importo(c) and testo(c)]
        importi = [importo(c) for c in r if e_importo(c)]
        etichetta = testo(r[0])
        if not etichetta and "Totale complessivo" in celle_testo:
            etichetta = "Totale complessivo"
        tit = next((t for t in celle_testo if re.match(r"^[EU]\.\d - ", t)), None)
        if etichetta.startswith(("STRUTTURA", "TITOLO")) or (not etichetta and not tit and not importi):
            continue
        if not etichetta and not tit:
            if not out:
                raise ValueError(f"riga di continuazione senza riga precedente: {r}")
            out[-1][2].extend(importi)
            continue
        out.append([etichetta, tit, importi])
    for etichetta, tit, importi in out:
        if len(importi) != 4:
            raise ValueError(f"attesi 4 importi per {etichetta!r} / {tit!r}, trovati {importi}")
    return out


def leggi_allegato_peg(path):
    out = {"sommario": "", "entrate_titolo": {}, "spese_titolo": {}, "tot_entrate": None, "tot_spese": None,
           "entrate_struttura": {}, "tot_entrate_strutture": None,
           "spese_struttura": {}, "tot_spese_strutture": None}
    with pdfplumber.open(path) as pdf:
        out["sommario"] = "\n".join(pdf.pages[i].extract_text() or "" for i in range(1, 5))
        # pag. 8: due tabelle, entrate e spese per titolo (Roma Capitale)
        tabs = pdf.pages[7].extract_tables()
        if len(tabs) != 2:
            raise ValueError(f"pag. 8: attese 2 tabelle, trovate {len(tabs)}")
        for tab, chiave, tot in ((tabs[0], "entrate_titolo", "tot_entrate"), (tabs[1], "spese_titolo", "tot_spese")):
            for etichetta, _, imp in righe_logiche(tab):
                if etichetta == "Totale complessivo":
                    out[tot] = imp
                elif re.match(r"^[EU]\.\d - ", etichetta):
                    out[chiave][etichetta.split(" - ")[0]] = imp
                else:
                    raise ValueError(f"pag. 8: riga inattesa {etichetta!r}")
        tab_entrate, tab_spese = [], []
        for p in range(8, 24):  # pag. 9-24
            for tab in pdf.pages[p].extract_tables():
                spesa = any("TITOLO" in testo(c) for c in tab[0] if c)
                (tab_spese if spesa else tab_entrate).append(tab)
        # entrate per struttura: riga "XX - nome" con il totale, seguita dalle righe titolo
        cur = None
        for tab in tab_entrate:
            for etichetta, tit, imp in righe_logiche(tab):
                if etichetta == "Totale complessivo":
                    out["tot_entrate_strutture"] = imp
                elif re.match(r"^E\.\d - ", etichetta):
                    out["entrate_struttura"][cur]["titoli"][etichetta.split(" - ")[0]] = imp
                elif re.match(r"^[A-Z]{2} - ", etichetta):
                    cur = etichetta[:2]
                    if cur in out["entrate_struttura"]:
                        raise ValueError(f"struttura {cur} ripetuta nelle entrate")
                    out["entrate_struttura"][cur] = {"nome": etichetta, "totale": imp, "titoli": {}}
                else:
                    raise ValueError(f"entrate per struttura: riga inattesa {etichetta!r}")
        # spese per struttura: il nome è in una cella unita e può cadere su una qualsiasi
        # riga del blocco; le righe titolo si accumulano e "XX - ... Totale" chiude il blocco.
        pending = {}
        for tab in tab_spese:
            for etichetta, tit, imp in righe_logiche(tab):
                if etichetta == "Totale complessivo":
                    out["tot_spese_strutture"] = imp
                elif etichetta.endswith(" Totale") and re.match(r"^[A-Z]{2} - ", etichetta):
                    out["spese_struttura"][etichetta[:2]] = {"nome": etichetta[:-7], "titoli": pending, "totale": imp}
                    pending = {}
                elif tit:
                    k = tit.split(" - ")[0]
                    if k in pending:
                        raise ValueError(f"spese per struttura: titolo {k} ripetuto prima di un totale")
                    pending[k] = imp
                else:
                    raise ValueError(f"spese per struttura: riga inattesa {etichetta!r}")
        if pending:
            raise ValueError(f"righe di spesa senza totale di struttura: {pending}")
    for k in ("tot_entrate", "tot_spese", "tot_entrate_strutture", "tot_spese_strutture"):
        if out[k] is None:
            raise ValueError(f"Allegato PEG: totale {k} non trovato")
    return out


# ---------------------------------------------------------------- aggregazioni

def somma(righe, chiave_fn, nome_fn):
    agg = defaultdict(lambda: [Decimal(0)] * 4)
    nomi = {}
    for r in righe:
        k = chiave_fn(r)
        nomi[k] = nome_fn(r)
        for j in range(4):
            agg[k][j] += r["importi"][j]
    return agg, nomi


def totale(righe):
    t = [Decimal(0)] * 4
    for r in righe:
        for j in range(4):
            t[j] += r["importi"][j]
    return t


def voce(codice, nome, v, **extra):
    d = {"codice": codice, "nome": nome}
    d.update(extra)
    d.update({c: euro(v[j]) for j, c in enumerate(COLONNE)})
    return d


def lista(agg, nomi, extra_fn=None, ordina_per_importo=True):
    items = list(agg.items())
    if ordina_per_importo:
        items.sort(key=lambda kv: (-kv[1][0], kv[0]))
    else:
        items.sort(key=lambda kv: kv[0])
    return [voce(k, nomi[k], v, **(extra_fn(k) if extra_fn else {})) for k, v in items]


def verifica_somme(nome, righe, tot):
    """Controllo 5: ogni scomposizione deve tornare al totale, su tutte e 4 le colonne."""
    for etichetta, fn in (("titolo", lambda r: r["titolo"]), ("missione", lambda r: r.get("missione")),
                          ("programma", lambda r: (r.get("missione"), r.get("programma"))),
                          ("macroaggregato", lambda r: r.get("macroaggregato"))):
        if not righe:
            errori.append(f"{nome}: nessuna riga")
            return
        if etichetta != "titolo" and "missione" not in righe[0]:
            continue
        agg, _ = somma(righe, fn, fn)
        for j in range(4):
            s = sum((v[j] for v in agg.values()), Decimal(0))
            if s != tot[j]:
                errori.append(f"{nome}: somma per {etichetta} {COLONNE[j]} {s} != {tot[j]}")
    if not any(e.startswith(nome + ":") for e in errori):
        print(f"  [OK ] {nome}: scomposizioni = totale {tot[0]:,.2f} (4 colonne)")


def blocco_spese(righe, codice_struttura=None):
    tot = totale(righe)
    verifica_somme(f"spese {codice_struttura or 'Roma'}", righe, tot)
    tit, tn = somma(righe, lambda r: r["titolo"], lambda r: r["titolo_nome"])
    mis, mn = somma(righe, lambda r: r["missione"], lambda r: r["missione_nome"])
    prg, pn = somma(righe, lambda r: f'{r["missione"]}.{r["programma"]}', lambda r: r["programma_nome"])
    mac, man = somma(righe, lambda r: r["macroaggregato"], lambda r: r["macroaggregato_nome"])
    b = {
        **{c: euro(tot[j]) for j, c in enumerate(COLONNE)},
        "righe_capitolo": len(righe),
        "per_titolo": lista(tit, tn, ordina_per_importo=False),
        "per_missione": lista(mis, mn),
        "per_programma": lista(prg, pn, extra_fn=lambda k: {"missione": k.split(".")[0]}),
        "per_macroaggregato": lista(mac, man),
    }
    if codice_struttura:
        # quota dei capitoli del municipio il cui "responsabile di budget" (CRD1) è un'altra struttura
        altre = [r for r in righe if not r["crd_budget"].startswith(codice_struttura)]
        t_altre = totale(altre)
        crd, _ = somma(altre, lambda r: r["crd_budget"][:2], lambda r: r["crd_budget"][:2])
        b["di_cui_budget_gestito_da_altre_strutture"] = {
            **{c: euro(t_altre[j]) for j, c in enumerate(COLONNE)},
            "righe_capitolo": len(altre),
            "per_struttura_crd1": [{"codice": k, **{c: euro(v[j]) for j, c in enumerate(COLONNE)}}
                                   for k, v in sorted(crd.items(), key=lambda kv: -kv[1][0])],
        }
    return b


def blocco_entrate(righe, nome):
    tot = totale(righe)
    verifica_somme(f"entrate {nome}", righe, tot)
    tit, tn = somma(righe, lambda r: r["titolo"], lambda r: r["titolo_nome"])
    return {**{c: euro(tot[j]) for j, c in enumerate(COLONNE)},
            "righe_capitolo": len(righe),
            "per_titolo": lista(tit, tn, ordina_per_importo=False)}


# ---------------------------------------------------------------- main

def main():
    scarica(PDF_A, URL_ALLEGATO_A)
    scarica(PDF_PEG, URL_ALLEGATO_PEG)

    print("Leggo l'Allegato PEG (sintesi, pag. 2-5 e 8-24)...")
    peg = leggi_allegato_peg(PDF_PEG)
    print("Leggo l'Allegato A (838 pagine, qualche minuto)...")
    spese, entrate, tot_spese_a, tot_entrate_a = leggi_allegato_a(PDF_A)
    print(f"  righe di spesa: {len(spese)}, righe di entrata: {len(entrate)}")

    # --- mappatura codici -> municipio, verificata su entrambi i PDF
    print("\nMappatura strutture -> municipi")
    sommario = re.sub(r"\s+", " ", peg["sommario"])
    nomi_a = {r["struttura"]: r["struttura_nome"] for r in spese + entrate}
    mappa = {}
    for n, cod in enumerate(CODICI_MUNICIPI, start=1):
        m = re.search(rf"\b{cod}\s+Municipio ([IVX]+)\b", sommario)
        m2 = re.match(r"^Municipio Roma ([IVX]+)$", nomi_a.get(cod, ""))
        num_somm = ROMANI.get(m.group(1)) if m else None
        num_a = ROMANI.get(m2.group(1)) if m2 else None
        ok = num_somm == n and num_a == n
        print(f"  [{'OK ' if ok else 'ERR'}] {cod} = Municipio {n} (sommario: {m.group(0) if m else '-'}; "
              f"Allegato A: {nomi_a.get(cod, '-')})")
        if not ok:
            errori.append(f"mappatura {cod} -> {n} non confermata")
        mappa[cod] = n
    altri_municipi = sorted(k for k, v in nomi_a.items() if "unicipio" in v and k not in mappa)
    if altri_municipi:
        errori.append(f"strutture municipio non attese: {altri_municipi}")

    # --- controllo 1: Allegato A, somma righe = totale stampato
    print("\nControllo 1 - Allegato A: somma delle righe = 'Totale complessivo' stampato")
    for j, c in enumerate(COLONNE):
        check(f"spese {c}", tot_spese_a[j], totale(spese)[j])
        check(f"entrate {c}", tot_entrate_a[j], totale(entrate)[j])

    # --- controllo 2: per titolo = Allegato PEG pag. 8
    print("\nControllo 2 - Allegato A per titolo = Allegato PEG pag. 8 (Roma Capitale)")
    for righe, chiave, tot_key, nome in ((spese, "spese_titolo", "tot_spese", "spese"),
                                         (entrate, "entrate_titolo", "tot_entrate", "entrate")):
        agg, _ = somma(righe, lambda r: r["titolo"], lambda r: r["titolo"])
        if set(agg) != set(peg[chiave]):
            errori.append(f"{nome}: titoli diversi {sorted(agg)} vs {sorted(peg[chiave])}")
        for t in sorted(peg[chiave]):
            for j, c in enumerate(COLONNE):
                check(f"{nome} {t} {c}", peg[chiave][t][j], agg.get(t, [Decimal(0)] * 4)[j])
        for j, c in enumerate(COLONNE):
            check(f"{nome} totale {c}", peg[tot_key][j], totale(righe)[j])

    # --- controllo 6: coerenza interna delle tabelle per struttura dell'Allegato PEG
    print("\nControllo 6 - Allegato PEG: titoli = totale struttura, strutture = totale complessivo")
    for nome, tab, tot_key in (("entrate", peg["entrate_struttura"], "tot_entrate_strutture"),
                               ("spese", peg["spese_struttura"], "tot_spese_strutture")):
        s_tot = [Decimal(0)] * 4
        for cod, d in tab.items():
            for j in range(4):
                s = sum((v[j] for v in d["titoli"].values()), Decimal(0))
                if s != d["totale"][j]:
                    errori.append(f"Allegato PEG {nome} {cod}: titoli {s} != totale {d['totale'][j]}")
                s_tot[j] += d["totale"][j]
        for j, c in enumerate(COLONNE):
            check(f"{nome}: somma {len(tab)} strutture {c}", peg[tot_key][j], s_tot[j])

    # --- controllo 3: entrate per municipio
    print("\nControllo 3 - entrate per municipio: Allegato A = Allegato PEG 'Entrate per Struttura'")
    for cod in CODICI_MUNICIPI:
        righe = [r for r in entrate if r["struttura"] == cod]
        stampato = peg["entrate_struttura"].get(cod)
        if not stampato:
            errori.append(f"{cod}: assente dalla tabella entrate per struttura")
            continue
        check(f"{cod} entrate competenza 2026", stampato["totale"][0], totale(righe)[0])
        check(f"{cod} entrate cassa 2026", stampato["totale"][1], totale(righe)[1])
        agg, _ = somma(righe, lambda r: r["titolo"], lambda r: r["titolo"])
        for t in set(agg) | set(stampato["titoli"]):
            for j in range(4):
                a = agg.get(t, [Decimal(0)] * 4)[j]
                p = stampato["titoli"].get(t, [Decimal(0)] * 4)[j]
                if a != p:
                    errori.append(f"{cod} entrate {t} {COLONNE[j]}: stampato {p} ricalcolato {a}")
                    print(f"  [ERR] {cod} entrate {t} {COLONNE[j]}: stampato {p} ricalcolato {a}")
        print(f"  [{'OK ' if not any(e.startswith(cod + ' entrate') for e in errori) else 'ERR'}] "
              f"{cod} entrate: tutti i titoli x 4 colonne")

    # --- controllo 4: spese per struttura stampate nell'Allegato PEG
    print("\nControllo 4 - spese per struttura: Allegato PEG (strutture stampate) = Allegato A")
    stampate = peg["spese_struttura"]
    tutte = sorted({r["struttura"] for r in spese})
    mancanti = [c for c in tutte if c not in stampate]
    print(f"  la tabella dell'Allegato PEG stampa {len(stampate)} strutture su {len(tutte)}; "
          f"assenti: {', '.join(mancanti)}")
    for cod, d in sorted(stampate.items()):
        righe = [r for r in spese if r["struttura"] == cod]
        agg, _ = somma(righe, lambda r: r["titolo"], lambda r: r["titolo"])
        bad = [f"{t} {COLONNE[j]}" for t in set(agg) | set(d["titoli"]) for j in range(4)
               if agg.get(t, [Decimal(0)] * 4)[j] != d["titoli"].get(t, [Decimal(0)] * 4)[j]]
        bad += [f"totale {COLONNE[j]}" for j in range(4) if totale(righe)[j] != d["totale"][j]]
        print(f"  [{'OK ' if not bad else 'ERR'}] {cod} spese: totale {d['totale'][0]:,.2f} e titoli x 4 colonne")
        if bad:
            errori.append(f"{cod} spese diverse tra Allegato PEG e Allegato A: {bad}")

    # --- snapshot
    municipi = {}
    somma_mun_spese = [Decimal(0)] * 4
    somma_mun_entrate = [Decimal(0)] * 4
    righe_mun_spese, righe_mun_entrate = [], []
    for cod in CODICI_MUNICIPI:
        n = mappa[cod]
        rs = [r for r in spese if r["struttura"] == cod]
        re_ = [r for r in entrate if r["struttura"] == cod]
        righe_mun_spese += rs
        righe_mun_entrate += re_
        municipi[str(n)] = {
            "codice_struttura": cod,
            "nome_struttura": nomi_a[cod],
            "spese": blocco_spese(rs, cod),
            "entrate": blocco_entrate(re_, cod),
            "totale_spese_stampato_in_sintesi": cod in stampate,
        }
        for j in range(4):
            somma_mun_spese[j] += totale(rs)[j]
            somma_mun_entrate[j] += totale(re_)[j]

    altre_s = [r for r in spese if r["struttura"] not in mappa]
    print("\nControllo 5 - 15 municipi + altre strutture = Roma Capitale; scomposizioni = totali")
    for j, c in enumerate(COLONNE):
        check(f"spese {c}", tot_spese_a[j], somma_mun_spese[j] + totale(altre_s)[j])

    roma = {
        "nota": "Totali dell'intero bilancio di Roma Capitale (tutte le strutture), dalla stessa fonte. "
                "Comprendono partite di giro (U.7/E.9), anticipazioni di tesoreria (U.5/E.7), "
                "rimborso prestiti e avanzo/disavanzo: per confronti con i municipi usare i titoli.",
        "spese": blocco_spese(spese),
        "entrate": blocco_entrate(entrate, "Roma"),
        "somma_15_municipi": {
            "spese": blocco_spese(righe_mun_spese),
            "entrate": blocco_entrate(righe_mun_entrate, "15 municipi"),
        },
        "fonte_controllo": {
            "nome": "Allegato PEG 2026-2028 (sintesi), pag. 8: Stanziamenti di Entrata e di Spesa da Bilancio",
            "url": URL_ALLEGATO_PEG,
            "sha256": sha256(PDF_PEG),
            "esito": "totali per titolo identici al centesimo a quelli ricalcolati dall'Allegato A",
        },
    }
    for k in ("spese", "entrate"):
        b = roma["somma_15_municipi"][k]
        for chiave in ("per_missione", "per_programma", "per_macroaggregato"):
            b.pop(chiave, None)

    if errori:
        print("\nERRORI:")
        for e in errori:
            print("  - " + e)
        sys.exit(1)

    snapshot = {
        "id": "bilancio_peg_2026",
        "titolo": "Bilancio dei municipi di Roma: stanziamenti 2026 del Piano Esecutivo di Gestione 2026-2028",
        "fonte": {
            "nome": "Piano Esecutivo di Gestione 2026-2028, Allegato A \"Ripartizione delle risorse "
                    "finanziarie\" (DGC n. 110 del 16 aprile 2026), controllato con l'\"Allegato PEG 2026-2028\"",
            "ente": "Roma Capitale",
            "url": URL_ALLEGATO_A,
            "url_pagina": URL_PAGINA,
            "licenza": LICENZA_RC,
        },
        "periodo": "Esercizio 2026 (competenza e cassa); competenza 2027 e 2028 come previsione. "
                   "Risorse al 16/04/2026, assetto organizzativo al 13/04/2026.",
        "verificato": datetime.date.fromtimestamp(min(PDF_A.stat().st_mtime, PDF_PEG.stat().st_mtime)).isoformat(),
        "unita": "euro",
        "misura": "Gli stanziamenti (somme autorizzate a spendere e previsioni di entrata) che il PEG 2026 "
                  "assegna alle strutture 'Municipio' (codici TA-TQ), ripartiti per titolo, missione, "
                  "programma e macroaggregato.",
        "non_misura": [
            "Non sono pagamenti né impegni: sono stanziamenti previsti ad aprile 2026, che variano con "
            "assestamento e variazioni di bilancio durante l'anno.",
            "Non comprende la spesa che dipartimenti centrali, Polizia Locale, società partecipate "
            "(AMA, ATAC...) e altre strutture fanno sul territorio del municipio: qui c'è solo il "
            "bilancio assegnato alla struttura 'Municipio'.",
            "Non è un bilancio autonomo: i municipi non sono enti con un proprio bilancio, sono "
            "articolazioni di Roma Capitale.",
            "Parte dei capitoli assegnati al municipio ha come 'responsabile di budget' (CRD1) un'altra "
            "struttura (es. personale): vedi 'di_cui_budget_gestito_da_altre_strutture'.",
            "Le entrate del municipio non finanziano il municipio: sono le entrate che il PEG assegna "
            "alla struttura da accertare (canoni, tariffe di servizi, contributi), confluiscono nel "
            "bilancio unico di Roma Capitale.",
            "L'Allegato A dichiara di essere elaborato 'ai soli fini conoscitivi'.",
            "Il Piano investimenti per municipio non è incluso: il file disponibile (Allegato E "
            "dell'assestamento 2026) elenca solo variazioni, non stanziamenti.",
        ],
        "municipi": municipi,
        "roma": roma,
    }
    # lo schema di "fonte" ha 5 chiavi fisse: impronta del PDF e link alla delibera vanno in "roma"
    roma["fonte_dati"] = {"url": URL_ALLEGATO_A, "sha256": sha256(PDF_A), "delibera": URL_DELIBERA}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1) + "\n")

    print("\nTotali spese 2026 per municipio (competenza | cassa):")
    for n in range(1, 16):
        s = municipi[str(n)]["spese"]
        print(f"  {n:>2} {municipi[str(n)]['codice_struttura']}  {s['competenza_2026']:>16,.2f} | {s['cassa_2026']:>16,.2f}")
    print(f"  somma 15 municipi {euro(somma_mun_spese[0]):,.2f} | Roma Capitale {euro(tot_spese_a[0]):,.2f}")
    print(f"\nTutti i controlli superati. Scritto {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
