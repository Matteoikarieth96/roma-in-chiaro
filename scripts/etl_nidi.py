"""Asili nido per municipio: posti, iscritti, domande, liste d'attesa.

Fonte: Roma Capitale, "Dashboard_Nidi_2025.xlsx"
https://www.comune.roma.it/web-resources/cms/documents/Dashboard_Nidi_2025.xlsx
(copia in data/raw/nidi/; se manca viene scaricata con curl).

Il file contiene due tabelle nascoste con i dati grezzi:
- "Dati_AsiliNido": una riga per struttura e anno educativo (2011-2012 ... 2024-2025) con
  Capienza, Iscritti, Iscritti DA (il file stesso li chiama "diversamente abili" nei grafici),
  Iscritti stranieri, tipologia (Tipo1/Tipo2) e data di estrazione;
- "Dati_Listeattesa": una riga per municipio e anno con domande valide pervenute,
  lista d'attesa iniziale e finale.
Le altre schede nascoste sono tabelle pivot che il file usa per i grafici: le usiamo solo come
controllo (le nostre somme devono coincidere con le loro righe "Totale complessivo").

Nessun valore stimato: si sommano solo le righe del file.
"""
import datetime
import json
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/raw/nidi/Dashboard_Nidi_2025.xlsx"
OUT = ROOT / "data/snapshot/nidi.json"
URL = "https://www.comune.roma.it/web-resources/cms/documents/Dashboard_Nidi_2025.xlsx"
UA = "Mozilla/5.0 (compatible; civic-data-research)"
# RIFRESCA=1: riscarica il file anche se è già in cache (lo usa ./aggiorna.sh senza argomenti).
RIFRESCA = os.environ.get("RIFRESCA") == "1"
LICENZA_RC = ("Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 "
              "del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).")
ROMANI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
          "XI", "XII", "XIII", "XIV", "XV"]


def pivot(wb, name):
    """Righe di una pivot 'Etichette di riga' -> valore (chiavi normalizzate)."""
    out = {}
    for r in wb[name].iter_rows(min_row=2, values_only=True):
        if r[0] is None or r[1] is None:
            continue
        k = r[0].strip() if isinstance(r[0], str) else r[0]
        out[k] = r[1]
    return out


def main():
    if RIFRESCA or not SRC.exists():
        SRC.parent.mkdir(parents=True, exist_ok=True)
        tmp = SRC.with_suffix(".part")
        subprocess.run(["curl", "-sS", "-L", "--fail", "-A", UA, "-o", str(tmp), URL], check=True)
        if not tmp.read_bytes()[:2] == b"PK":
            sys.exit(f"ERRORE: {URL} non ha restituito un file Excel")
        tmp.replace(SRC)
    verificato = datetime.date.fromtimestamp(SRC.stat().st_mtime).isoformat()
    wb = openpyxl.load_workbook(SRC, data_only=True)

    ws = wb["Dati_AsiliNido"]
    header = [c.value for c in ws[1]]
    idx = {h: i for i, h in enumerate(header)}
    rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[idx["Anno_educ"]]]

    anni = sorted({r[idx["Anno_educ"]] for r in rows})
    ultimo = anni[-1]

    def zero():
        return {"n_strutture": 0, "posti": 0, "iscritti": 0, "iscritti_stranieri": 0,
                "iscritti_diversamente_abili": 0, "posti_per_tipologia": defaultdict(int),
                "strutture_per_tipologia": defaultdict(int), "strutture_capienza_zero": 0,
                "righe_senza_dato_disabili": 0}

    agg = defaultdict(zero)           # (anno, mun) -> totali
    tot_anno = defaultdict(zero)      # anno -> totali Roma
    estrazioni = defaultdict(set)
    incoerenze = []
    for r in rows:
        anno, mun = r[idx["Anno_educ"]], r[idx["Municipio New"]]
        if str(r[idx["Municipio2"]]).strip() != ROMANI[mun - 1]:
            incoerenze.append((anno, r[idx["Nome"]], mun, r[idx["Municipio2"]]))
        tipo = f"{r[idx['Tipo1']]} - {r[idx['Tipo2']]}"
        for a in (agg[(anno, mun)], tot_anno[anno]):
            a["n_strutture"] += 1
            a["posti"] += r[idx["Capienza"]] or 0
            a["iscritti"] += r[idx["Iscritti"]] or 0
            a["iscritti_stranieri"] += r[idx["Iscritti stranieri"]] or 0
            if r[idx["Iscritti DA"]] is None:
                a["righe_senza_dato_disabili"] += 1
            else:
                a["iscritti_diversamente_abili"] += r[idx["Iscritti DA"]]
            a["posti_per_tipologia"][tipo] += r[idx["Capienza"]] or 0
            a["strutture_per_tipologia"][tipo] += 1
            if not r[idx["Capienza"]]:
                a["strutture_capienza_zero"] += 1
        d = r[idx["Data_estraz_MESIS"]]
        estrazioni[anno].add(d.date().isoformat() if d else None)

    wl = wb["Dati_Listeattesa"]
    wh = [c.value for c in wl[1]]
    wi = {h: i for i, h in enumerate(wh) if h}
    liste = {}
    for r in wl.iter_rows(min_row=2, values_only=True):
        if not r[wi["Anno_educ"]]:
            continue
        mun = r[wi["MunicipioNew"]]
        liste[(r[wi["Anno_educ"]], mun)] = {
            "domande_valide": r[wi["Somma di Domande_valide_pervenute"]],
            "lista_attesa_iniziale": r[wi["Somma di Lista_attesa_iniziale"]],
            "lista_attesa_finale": r[wi["Somma di Lista_attesa_finale"]],
        }
        if str(r[wi["Municipio"]]).strip() != ROMANI[mun - 1]:
            incoerenze.append((r[wi["Anno_educ"]], "liste", mun, r[wi["Municipio"]]))

    def fmt(a, lst):
        out = {k: v for k, v in a.items() if k not in ("posti_per_tipologia", "strutture_per_tipologia")}
        out["posti_per_tipologia"] = dict(sorted(a["posti_per_tipologia"].items()))
        out["strutture_per_tipologia"] = dict(sorted(a["strutture_per_tipologia"].items()))
        out.update(lst if lst else {"domande_valide": None, "lista_attesa_iniziale": None, "lista_attesa_finale": None})
        return out

    municipi = {}
    for m in range(1, 16):
        serie = {}
        for anno in anni:
            a = agg.get((anno, m))
            l = liste.get((anno, m))
            if a is None and l is None:
                continue
            s = fmt(a, l) if a else {"n_strutture": None, "posti": None, "iscritti": None, **(l or {})}
            serie[anno] = {k: s[k] for k in ("n_strutture", "posti", "iscritti", "iscritti_stranieri",
                                             "iscritti_diversamente_abili", "domande_valide",
                                             "lista_attesa_iniziale", "lista_attesa_finale") if k in s}
        municipi[str(m)] = {
            "anno_educativo": ultimo,
            **fmt(agg[(ultimo, m)], liste.get((ultimo, m))),
            "serie_storica": serie,
        }

    roma_liste = defaultdict(lambda: {"domande_valide": 0, "lista_attesa_iniziale": 0, "lista_attesa_finale": 0})
    for (anno, m), v in liste.items():
        for k in roma_liste[anno]:
            roma_liste[anno][k] += v[k] or 0
    roma = {"anno_educativo": ultimo, **fmt(tot_anno[ultimo], roma_liste.get(ultimo)),
            "serie_storica": {anno: {k: v for k, v in fmt(tot_anno[anno], roma_liste.get(anno)).items()
                                     if k in ("n_strutture", "posti", "iscritti", "iscritti_stranieri",
                                              "iscritti_diversamente_abili", "domande_valide",
                                              "lista_attesa_iniziale", "lista_attesa_finale")}
                              for anno in anni}}

    # ---- controlli contro le pivot del file
    checks = []
    for name, field in [("Anno_cap", "posti"), ("Anno_iscr", "iscritti"), ("Anno_iscrS", "iscritti_stranieri")]:
        pv = pivot(wb, name)
        for anno in anni:
            checks.append((f"{name} {anno}: file {pv.get(anno)} vs somma {tot_anno[anno][field]}",
                           pv.get(anno) == tot_anno[anno][field]))
        checks.append((f"{name} Totale complessivo: file {pv.get('Totale complessivo')} vs somma "
                       f"{sum(tot_anno[a][field] for a in anni)}",
                       pv.get("Totale complessivo") == sum(tot_anno[a][field] for a in anni)))
    for name, field in [("Mun_cap", "posti"), ("Mun_iscr", "iscritti"), ("Mun_iscrS", "iscritti_stranieri")]:
        pv = pivot(wb, name)
        for m in range(1, 16):
            s = sum(agg[(a, m)][field] for a in anni if (a, m) in agg)
            checks.append((f"{name} mun {m} (tutti gli anni): file {pv.get(m)} vs somma {s}", pv.get(m) == s))
    for name, field in [("Listattesa_anno", "lista_attesa_finale"), ("Domande_anno", "domande_valide")]:
        pv = pivot(wb, name)
        for anno in anni:
            checks.append((f"{name} {anno}: file {pv.get(anno)} vs somma {roma_liste[anno][field]}",
                           pv.get(anno) == roma_liste[anno][field]))
    for name, field in [("Listattesa_mun", "lista_attesa_finale"), ("Domande_mun", "domande_valide")]:
        pv = pivot(wb, name)
        for m in range(1, 16):
            s = sum(v[field] for (a, mm), v in liste.items() if mm == m)
            checks.append((f"{name} mun {m}: file {pv.get(m)} vs somma {s}", pv.get(m) == s))
    pv = pivot(wb, "Tipo_cap")
    checks.append((f"Tipo_cap Totale complessivo {pv.get('Totale complessivo')} vs somma posti "
                   f"{sum(tot_anno[a]['posti'] for a in anni)}",
                   pv.get("Totale complessivo") == sum(tot_anno[a]["posti"] for a in anni)))
    # la pivot "Iscritti DA" del file è un CONTEGGIO di righe, non una somma: lo verifichiamo
    pv = pivot(wb, "Anno_iscrDA")
    n_da = {a: sum(1 for r in rows if r[idx["Anno_educ"]] == a and r[idx["Iscritti DA"]] is not None) for a in anni}
    checks.append(("Anno_iscrDA del file = numero di righe con dato (conteggio, non somma): "
                   + str(all(pv.get(a) == n_da[a] for a in anni)), all(pv.get(a) == n_da[a] for a in anni)))
    for m in range(1, 16):
        checks.append((f"mun {m}: presente in {ultimo} con strutture e liste",
                       (ultimo, m) in agg and (ultimo, m) in liste))
    checks.append((f"codici municipio coerenti (numero vs romano): {len(incoerenze)} incoerenze", not incoerenze))

    print("CONTROLLI")
    fail = [c for c in checks if not c[1]]
    print(f"  {len(checks) - len(fail)}/{len(checks)} OK")
    for msg, ok in checks:
        if not ok or msg.startswith(("Anno_cap Totale", "Anno_iscr Totale", "Listattesa_anno " + ultimo,
                                     "Domande_anno " + ultimo, "Anno_cap " + ultimo, "Anno_iscr " + ultimo, "Anno_iscrDA")):
            print(("  OK   " if ok else "  FAIL ") + msg)
    for x in incoerenze[:10]:
        print("   incoerenza", x)
    if fail:
        print(f"\nERRORE: {len(fail)} controlli FAIL: snapshot non scritto", file=sys.stderr)
        sys.exit(1)
    print(f"\nanno educativo più recente: {ultimo}; data estrazione: {sorted(estrazioni[ultimo])}")
    print(f"{'mun':>3} {'strutt':>6} {'posti':>6} {'iscritti':>8} {'domande':>7} {'att.iniz':>8} {'att.fin':>7}")
    for k, m in municipi.items():
        print(f"{k:>3} {m['n_strutture']:>6} {m['posti']:>6} {m['iscritti']:>8} {m['domande_valide']:>7} "
              f"{m['lista_attesa_iniziale']:>8} {m['lista_attesa_finale']:>7}")
    print(f"Roma {roma['n_strutture']:>5} {roma['posti']:>6} {roma['iscritti']:>8} {roma['domande_valide']:>7} "
          f"{roma['lista_attesa_iniziale']:>8} {roma['lista_attesa_finale']:>7}")

    snap = {
        "id": "nidi",
        "titolo": "Asili nido per municipio: posti, iscritti, domande e liste d'attesa",
        "fonte": {
            "nome": "Dashboard Nidi 2025 (file Excel)",
            "ente": "Roma Capitale",
            "url": URL,
            "licenza": LICENZA_RC,
            "metadati_file": {"ultima_modifica": wb.properties.modified.date().isoformat() if wb.properties.modified else None},
        },
        "periodo": f"Anno educativo {ultimo} (serie storica {anni[0]} - {ultimo}); "
                   f"data di estrazione dei dati sulle strutture per {ultimo}: {', '.join(d for d in sorted(estrazioni[ultimo]) if d)}",
        "verificato": verificato,
        "misura": ("Per municipio: numero di strutture (righe del file), posti (colonna 'Capienza'), iscritti, "
                   "iscritti stranieri, iscritti diversamente abili ('Iscritti DA'), domande valide pervenute, "
                   "lista d'attesa iniziale e finale. Somme delle righe del file, nessuna stima."),
        "non_misura": [
            "Comprende nidi comunali (gestione capitolina, in appalto, 'ponte') e privati convenzionati, aziendali, in project financing e spazi gioco privati in convenzione presenti nel file; non i nidi privati senza rapporto con Roma Capitale.",
            "Le domande e le liste d'attesa riguardano le domande al servizio comunale; non sono il numero di bambini senza posto in assoluto.",
            "Iscritti può superare i posti (Capienza) in alcune strutture: è il dato del file, non un errore di calcolo.",
            "Alcune strutture hanno capienza zero nell'anno (chiuse o nuove): sono contate in n_strutture e indicate in strutture_capienza_zero.",
            "Il grafico 'Iscritti diversamente abili' del file conta le righe invece di sommare: qui il valore è la somma della colonna.",
            "Non è un dato di spesa: il costo dei nidi non è in questo file.",
            "Gli anni educativi 2011-2012 e 2012-2013 precedono il riordino dei municipi del 2013: il file li attribuisce già ai municipi attuali (colonna 'Municipio New', es. 'MUNICIPIO ROMA VIII (ex XI)').",
        ],
        "municipi": municipi,
        "roma": roma,
    }
    OUT.write_text(json.dumps(snap, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nscritto {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
