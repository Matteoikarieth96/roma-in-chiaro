"""Controlli offline sugli snapshot in data/snapshot/: nessun download, nessun numero cambiato.

Li lancia la CI a ogni push e pull request; si lanciano anche a mano:
    .venv/bin/python -I scripts/controlla_snapshot.py

Controlla che:
- ogni file sia JSON valido, senza NaN o Infinity;
- ogni snapshot abbia una fonte con nome e licenza e, dove serve, periodo, verificato, misura, non_misura;
- ci siano esattamente i municipi "1" ... "15" (quartieri.json: ogni area in un municipio da 1 a 15);
- la data `verificato` non sia nel futuro;
- le somme interne tornino: appalti (procedure contro totale, municipi contro somma di Roma),
  bilancio (titoli e missioni contro il totale del municipio).
Esce con codice 1 se un controllo fallisce.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP = ROOT / "data/snapshot"
MUN = [str(i) for i in range(1, 16)]
TOLL = 0.015  # euro: arrotondamenti al centesimo
# snapshot con una forma diversa, documentata nello snapshot stesso
SENZA_CAMPI_TESTO = {"mappa": {"periodo", "verificato", "misura", "non_misura"},
                     "profilo_annuario": {"periodo", "misura", "non_misura"}}  # sono per indicatore

errori = []


def errore(msg):
    errori.append(msg)


def no_costanti(x):
    raise ValueError(f"valore non ammesso nel JSON: {x}")


def quasi(a, b):
    return abs((a or 0) - (b or 0)) <= TOLL


def controlla_forma(nome, d):
    fonte = d.get("fonte")
    if isinstance(fonte, dict):
        for k in ("nome", "licenza"):
            if not fonte.get(k):
                errore(f"{nome}: fonte.{k} mancante")
        if not (fonte.get("url") or fonte.get("link")):
            errore(f"{nome}: fonte senza url o link")
    elif not (isinstance(fonte, str) and fonte.strip()):
        errore(f"{nome}: fonte mancante")
    for k in ("periodo", "verificato", "misura", "non_misura"):
        if k not in d and k not in SENZA_CAMPI_TESTO.get(nome, set()):
            errore(f"{nome}: campo {k} mancante")
    v = d.get("verificato")
    if isinstance(v, str):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", v)
        if m and date(*map(int, m.groups())) > date.today():
            errore(f"{nome}: verificato {v} nel futuro")
    if nome == "quartieri":
        aree = d.get("aree") or []
        if not aree:
            errore("quartieri: nessuna area")
        for a in aree:
            if a.get("municipio") not in range(1, 16):
                errore(f"quartieri: area {a.get('nome')!r} con municipio {a.get('municipio')!r}")
        return
    m = d.get("municipi")
    if nome == "mappa" and isinstance(m, list):  # mappa.json: un percorso SVG per municipio
        m = {str(x.get("municipio")): x for x in m}
    if not isinstance(m, dict) or sorted(m, key=int) != MUN:
        errore(f"{nome}: municipi diversi da 1-15: {sorted(m) if isinstance(m, dict) else type(m).__name__}")


def controlla_appalti(d):
    anni = [a for a in d["roma"] if a.isdigit()]
    for a in anni:
        tot = n = 0
        for mu in MUN:
            r = d["municipi"][mu].get(a)
            if not r:
                continue
            tot += r["importo_totale"]
            n += r["n_cig"]
            psc = r.get("per_scelta_contraente") or []
            if psc:
                if not quasi(sum(x["importo"] for x in psc), r["importo_totale"]):
                    errore(f"appalti {a} municipio {mu}: procedure {sum(x['importo'] for x in psc):.2f} contro totale {r['importo_totale']:.2f}")
                if sum(x["n_cig"] for x in psc) != r["n_cig"]:
                    errore(f"appalti {a} municipio {mu}: CIG per procedura {sum(x['n_cig'] for x in psc)} contro {r['n_cig']}")
        sm = d["roma"][a].get("somma_municipi") or {}
        if "importo" not in sm or "n_cig" not in sm:
            errore(f"appalti {a}: roma.somma_municipi senza importo o n_cig")
        elif not quasi(sm["importo"], tot):
            errore(f"appalti {a}: somma dei municipi {tot:.2f} contro roma.somma_municipi {sm['importo']:.2f}")
        if "n_cig" in sm and sm["n_cig"] != n:
            errore(f"appalti {a}: CIG dei municipi {n} contro roma.somma_municipi {sm['n_cig']}")


def controlla_bilancio(d):
    for mu in MUN:
        s = d["municipi"][mu]["spese"]
        for gruppo in ("per_titolo", "per_missione"):
            righe = s.get(gruppo) or []
            for col in ("competenza_2026", "cassa_2026", "competenza_2027", "competenza_2028"):
                if col in s and righe and not quasi(sum(x.get(col) or 0 for x in righe), s[col]):
                    errore(f"bilancio municipio {mu}: {gruppo} {col} {sum(x.get(col) or 0 for x in righe):.2f} contro {s[col]:.2f}")


def main():
    files = sorted(SNAP.glob("*.json"))
    if not files:
        sys.exit(f"nessuno snapshot in {SNAP}")
    dati = {}
    for f in files:
        try:
            dati[f.stem] = json.loads(f.read_text(encoding="utf-8"), parse_constant=no_costanti)
        except ValueError as e:
            errore(f"{f.name}: {e}")
    for nome, d in dati.items():
        controlla_forma(nome, d)
    if "appalti_anac" in dati:
        controlla_appalti(dati["appalti_anac"])
    if "bilancio_peg_2026" in dati:
        controlla_bilancio(dati["bilancio_peg_2026"])
    print(f"snapshot controllati: {len(dati)} ({', '.join(dati)})")
    if errori:
        print("\n".join("ERRORE: " + e for e in errori))
        sys.exit(1)
    print("tutti i controlli passati")


if __name__ == "__main__":
    main()
