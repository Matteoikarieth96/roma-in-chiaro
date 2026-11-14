"""Nomi di quartieri, rioni e zone funzionali di Roma e stradario, per la ricerca del sito.

Scrive due file:
  - data/snapshot/quartieri.json: le 457 aree della deliberazione dell'Assemblea
    Capitolina n. 150/2026 (334 quartieri, 22 rioni, 101 zone funzionali) con il
    municipio di ciascuna. Entra nella pagina come gli altri snapshot.
  - data/riferimenti/stradario_roma.json: i nomi ufficiali delle vie (14.908) con i
    municipi che attraversano. NON entra nella pagina: build_search.py lo usa solo per
    riconoscere i nomi di vie e piazze scritti nei dati.

Fonte ufficiale: Geoportale di Roma Capitale, strati WFS DIPCUL:vst_nuove_localita
(aree) e DIPPC:stradario_municipio (vie), open data. I file di partenza sono quelli già
scaricati e corretti dal progetto quartieri-roma-2026 (Urbe Hub), che ripara gli
accenti persi nel WFS ("CINECITTA'") e alcuni nomi di via troncati.

Uso:
    python scripts/etl_quartieri.py [cartella data/ di quartieri-roma-2026]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT.parent / "quartieri-roma-2026" / "data"
OUT_SNAP = ROOT / "data/snapshot/quartieri.json"
OUT_STRADE = ROOT / "data/riferimenti/stradario_roma.json"

ROMANI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"]
TIPO = {"QUARTIERE": "quartiere", "RIONE": "rione", "ZONA FUNZIONALE": "zona funzionale"}


def nome_leggibile(s):
    """MONTI -> Monti, TOR DE' CENCI -> Tor de' Cenci, SANT'ANGELO -> Sant'Angelo."""
    minuscole = {"di", "de", "del", "della", "dei", "degli", "delle", "dello", "dell", "d", "e", "a", "al", "alla", "in", "da"}
    out = []
    for i, w in enumerate(s.lower().split(" ")):
        parti = w.split("'")
        parti = [p if (i > 0 and p in minuscole and j == 0) else (p[:1].upper() + p[1:]) for j, p in enumerate(parti)]
        w = "'".join(parti)
        # numerali romani in fondo al nome (TIBURTINO III)
        if all(c in "ivx" for c in w.lower()) and len(w) <= 4 and i > 0:
            w = w.upper()
        out.append(w)
    return " ".join(out)


def municipio_da_codice(cod, mappa):
    """QU.XI.20 / ZF.IV.01 -> numero del municipio; i rioni (R.VI) sono tutti nel I."""
    if cod in mappa:
        return mappa[cod]
    if cod.startswith("R."):
        return 1
    parti = cod.split(".")
    if len(parti) >= 2 and parti[1] in ROMANI:
        return ROMANI.index(parti[1])
    return None


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    geo = json.loads((src / "quartieri-2026.simplified.geojson").read_text(encoding="utf-8"))
    aree, mappa = [], {}
    for f in geo["features"]:
        p = f["properties"]
        mappa[p["codice"]] = p["municipio_num_arabo"]
        aree.append({"nome": nome_leggibile(p["denominazione"]), "tipo": TIPO.get(p["tipo"], p["tipo"].lower()),
                     "codice": p["codice"], "municipio": p["municipio_num_arabo"]})
    aree.sort(key=lambda a: (a["municipio"], a["nome"]))
    conta = {t: sum(1 for a in aree if a["tipo"] == t) for t in TIPO.values()}
    snap = {
        "id": "quartieri",
        "titolo": "Quartieri, rioni e zone funzionali di Roma con il loro municipio (usati dalla ricerca)",
        "fonte": {
            "nome": "Geoportale di Roma Capitale, strato DIPCUL:vst_nuove_localita (aree della deliberazione A.C. n. 150/2026)",
            "ente": "Roma Capitale",
            "url": "https://geoportale.comune.roma.it/",
            "licenza": "Dati aperti di Roma Capitale (art. 52, c. 2, del CAD), con citazione della fonte",
        },
        "periodo": "Geografia della deliberazione n. 150/2026, file scaricati il 2026-10-30",
        "verificato": "2026-10-30",
        "misura": (f"Nome e municipio di {len(aree)} aree: {conta['quartiere']} quartieri, {conta['rione']} rioni, "
                   f"{conta['zona funzionale']} zone funzionali. Servono alla ricerca per riconoscere i nomi dei luoghi."),
        "non_misura": [
            "Non sono le 155 zone urbanistiche usate dall'Annuario statistico: la deliberazione 150/2026 ha ridisegnato la geografia.",
            "Un nome citato in un progetto o in un appalto non vuol dire che il progetto si trovi in quell'area.",
            "I nomi sono presi dal progetto quartieri-roma-2026 di Urbe Hub, che li ha scaricati dal geoportale e ne ha corretto gli accenti.",
        ],
        "aree": aree,
    }
    OUT_SNAP.write_text(json.dumps(snap, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    indice = json.loads((src / "strade" / "indice.json").read_text(encoding="utf-8"))
    vie = {}
    for nome, codici in indice["vie"]:
        ms = {m for m in (municipio_da_codice(c, mappa) for c in codici) if m}
        vie.setdefault(nome, set()).update(ms)
    righe = [json.dumps([n, sorted(ms)], ensure_ascii=False) for n, ms in sorted(vie.items())]
    OUT_STRADE.parent.mkdir(parents=True, exist_ok=True)
    head = ('{"fonte":{"nome":"Geoportale di Roma Capitale, strato DIPPC:stradario_municipio","ente":"Roma Capitale",'
            '"url":"https://geoportale.comune.roma.it/","verificato":"2026-10-30",'
            '"nota":"Nomi ufficiali delle vie con i municipi che attraversano. Usato solo al build, non entra nella pagina."},\n"vie":[\n')
    OUT_STRADE.write_text(head + ",\n".join(righe) + "\n]}\n", encoding="utf-8")
    print(f"quartieri.json: {len(aree)} aree {conta}; stradario_roma.json: {len(righe)} vie")


if __name__ == "__main__":
    main()
