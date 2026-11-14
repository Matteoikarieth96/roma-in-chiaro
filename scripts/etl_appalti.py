"""Appalti (CIG ANAC) di Roma Capitale per municipio, 2025 e 2026 fino all'ultimo aggiornamento.

Fonte: ANAC, Banca Dati Nazionale dei Contratti Pubblici, open data (CC BY-SA 4.0)
  - "CIG anno 2025" (dataset cig-2025): 12 file mensili cig_csv_2025_MM.zip, pubblicati il
    16-19/01/2026, con tutti i CIG pubblicati nel 2025.
  - "CIG aggiornamenti delta" (dataset cig): file YYYYMMDD-cig_csv.zip con i CIG nuovi o
    modificati dall'ultimo dataset full. Non esiste ancora un dataset "CIG anno 2026": il 2026
    si ricostruisce solo dai delta (20260401 ... 20261101).
  - "Centri di costo" (dataset centri-di-costo): anagrafica dei centri di costo, usata per
    vedere indirizzo, stato e date dei centri di costo dei municipi.

I municipi non sono stazioni appaltanti a sé: sono centri di costo di Roma Capitale
(cf 02438750586, AUSA 0000207775), con denominazione "MUNICIPIO I" ... "MUNICIPIO XV" e
alcuni nomi storici (numerazione dei 19 municipi prima della riforma del 2013).

Passi:
  1. download (curl) dei zip in data/raw/appalti/zip/ se mancano;
  2. lettura in streaming di ogni zip, riga per riga, tenendo solo le righe con
     cf_amministrazione_appaltante = 02438750586 -> data/raw/appalti/roma_cig_righe.csv
     (più l'estratto dei centri di costo di Roma Capitale);
  3. consolidamento: un record per CIG, vince la versione del file più recente
     (2025 full < delta 20260401 < ... < delta 20261101); le righe multiple dello stesso CIG
     (una per CPV) si riducono alla riga con flag_prevalente=1;
  4. aggregati per municipio e anno di data_pubblicazione -> data/snapshot/appalti_anac.json.

Importo: importo_lotto (un valore per CIG = lotto). importo_complessivo_gara si ripete su
ogni lotto della stessa gara e sommarlo conterebbe più volte la stessa gara: non si usa.

I file scaricati sono dati non fidati: si leggono solo come CSV, niente viene eseguito.
Aggiornamento (RIFRESCA=1, lo usa ./aggiorna.sh senza argomenti): per ogni zip in cache si chiede
al server solo il primo byte (richiesta HTTP Range) per leggerne dimensione e data; lo zip si
riscarica solo se dimensione o data sono cambiate. Se il server non le dice, i file mensili del 2025
(dataset chiuso) restano quelli in cache, i delta e i centri di costo si riscaricano.

Uso: .venv/bin/python -I scripts/etl_appalti.py [--no-download]
"""
import csv
import datetime
import email.utils
import html
import io
import json
import os
import re
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/appalti"
ZIPS = RAW / "zip"
EXTRACT = RAW / "roma_cig_righe.csv"
EXTRACT_CDC = RAW / "roma_centri_di_costo.csv"
MAPPING_OUT = RAW / "mappa_centri_di_costo.csv"
OUT = ROOT / "data/snapshot/appalti_anac.json"

RIFRESCA = os.environ.get("RIFRESCA") == "1"
CF_ROMA = "02438750586"
AUSA_ROMA = "0000207775"
BASE = "https://dati.anticorruzione.it/opendata/download/dataset"
FILES_2025 = [f"cig_csv_2025_{m:02d}.zip" for m in range(1, 13)]
FILES_DELTA = [f"{d}-cig_csv.zip" for d in
               ("20260401", "20260501", "20260601", "20260701",
                "20260801", "20260901", "20261001", "20261101")]
# Data di rilascio di ogni delta su dati.anticorruzione.it (campo "created" della risorsa).
DELTA_RILASCIO = {
    "20260401": "2026-04-02", "20260501": "2026-05-22", "20260601": "2026-06-11",
    "20260701": "2026-07-08", "20260801": "2026-08-06", "20260901": "2026-09-02",
    "20261001": "2026-10-05", "20261101": "2026-11-03",
}
CDC_ZIP = "centri-di-costo_csv.zip"
ANNI = ("2025", "2026")
# Data di taglio del 2026. L'ultimo delta (20261101, rilasciato il 2026-11-03) contiene i CIG di
# ottobre 2026 solo in parte: per Roma Capitale ~60 CIG di ottobre contro ~250-300 per ciascun
# mese gennaio-settembre (e i CIG di un mese continuano ad arrivare nei delta successivi).
# Ottobre 2026 quindi si esclude; i conteggi per mese sono in dettagli_tecnici.
TAGLIO_2026 = "2026-09-30"

csv.field_size_limit(10_000_000)


def url_for(name):
    if name.startswith("cig_csv_2025_"):
        return f"{BASE}/cig-2025/filesystem/{name}"
    if name == CDC_ZIP:
        return f"{BASE}/centri-di-costo/filesystem/{name}"
    return f"{BASE}/cig/filesystem/{name}"


def remote_info(url):
    """(dimensione, data di modifica) del file remoto, chiedendo solo il primo byte; None se non note."""
    r = subprocess.run(["curl", "-sS", "--fail", "--max-time", "60", "-r", "0-0", "-D", "-", "-o", os.devnull, url],
                       capture_output=True, text=True)
    if r.returncode:
        return None, None
    size = re.search(r"^content-range:\s*bytes\s+0-0/(\d+)", r.stdout, re.I | re.M)
    lm = re.search(r"^last-modified:\s*(.+?)\s*$", r.stdout, re.I | re.M)
    try:
        ts = email.utils.parsedate_to_datetime(lm.group(1)).timestamp() if lm else None
    except (TypeError, ValueError):
        ts = None
    return (int(size.group(1)) if size else None), ts


def download(names):
    ZIPS.mkdir(parents=True, exist_ok=True)
    for name in names:
        dest = ZIPS / name
        if dest.exists() and zipfile.is_zipfile(dest):
            if not RIFRESCA:
                continue
            size, ts = remote_info(url_for(name))
            st = dest.stat()
            if size is not None and size == st.st_size and (ts is None or ts <= st.st_mtime):
                print(f"{name}: invariato sul server ({size} byte), tengo la copia", flush=True)
                os.utime(dest)  # verificato oggi contro il server
                continue
            if size is None and name in FILES_2025:
                print(f"{name}: il server non dice dimensione e data; dataset 2025 chiuso, tengo la copia", flush=True)
                continue
        print(f"download {name}", flush=True)
        tmp = dest.with_suffix(".part")
        subprocess.run(["curl", "-sS", "--fail", "--retry", "3", "--max-time", "3600",
                        "-o", str(tmp), url_for(name)], check=True)
        if not zipfile.is_zipfile(tmp):
            raise SystemExit(f"{name}: il file scaricato non è uno zip (pagina di errore?)")
        tmp.rename(dest)


def iter_zip_csv(path):
    """Righe (dict) di ogni CSV dentro lo zip, lette in streaming."""
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if not info.filename.lower().endswith(".csv"):
                continue
            with z.open(info) as fh:
                text = io.TextIOWrapper(fh, encoding="utf-8-sig", newline="")
                yield from csv.DictReader(text, delimiter=";")


def extract():
    """Filtra le righe di Roma Capitale da tutti gli zip (solo se gli zip sono più recenti)."""
    sources = FILES_2025 + FILES_DELTA
    newest = max((ZIPS / n).stat().st_mtime for n in sources + [CDC_ZIP])
    if EXTRACT.exists() and EXTRACT_CDC.exists() and EXTRACT.stat().st_mtime > newest:
        return
    header = None
    stats = {}
    with open(EXTRACT, "w", encoding="utf-8", newline="") as out:
        w = None
        for order, name in enumerate(sources):
            n_all = n_roma = 0
            max_pub = ""
            for r in iter_zip_csv(ZIPS / name):
                n_all += 1
                dp = (r.get("data_pubblicazione") or "")[:10]
                if dp > max_pub:
                    max_pub = dp
                if (r.get("cf_amministrazione_appaltante") or "").strip() != CF_ROMA:
                    continue
                n_roma += 1
                if w is None:
                    header = ["_ordine", "_file"] + list(r.keys())
                    w = csv.DictWriter(out, fieldnames=header, delimiter=";",
                                       extrasaction="ignore")
                    w.writeheader()
                r["_ordine"] = order
                r["_file"] = name
                w.writerow(r)
            stats[name] = {"righe_totali": n_all, "righe_roma": n_roma,
                           "max_data_pubblicazione": max_pub}
            print(f"  {name}: {n_all} righe, {n_roma} Roma Capitale, "
                  f"data_pubblicazione max {max_pub}", flush=True)
    (RAW / "estrazione_stats.json").write_text(json.dumps(stats, indent=1), encoding="utf-8")
    with open(EXTRACT_CDC, "w", encoding="utf-8", newline="") as out:
        w = None
        for r in iter_zip_csv(ZIPS / CDC_ZIP):
            if (r.get("stazione_appaltante_codice_fiscale") or "").strip() != CF_ROMA:
                continue
            if w is None:
                w = csv.DictWriter(out, fieldnames=list(r.keys()), delimiter=";")
                w.writeheader()
            w.writerow(r)


# ---------------------------------------------------------------- mappa centri di costo

ROMANI = {"I": 1, "V": 5, "X": 10, "L": 50}


def roman(s):
    tot, prev = 0, 0
    for ch in reversed(s):
        v = ROMANI[ch]
        tot = tot - v if v < prev else tot + v
        prev = max(prev, v)
    return tot


# Nomi del tipo "MUNICIPIO XII" (centri di costo attivi registrati nel 2015-2020, dopo la
# riforma del 2013 che ha portato i municipi da 19 a 15): numerazione attuale.
PLAIN = re.compile(r"^MUNICIPIO ([IVXL]+)$")

# Centri di costo con nome diverso da "MUNICIPIO <numero>", decisi uno per uno guardando
# nome, indirizzo e CAP nell'anagrafica ANAC dei centri di costo. Chiave: id_centro_costo.
# I nomi con numero da XVI a XX (o "19", "20") seguono per forza la vecchia numerazione a
# 19+1 municipi; per i numeri fino a XV serve un indizio (EX ..., indirizzo, CAP).
# Corrispondenza vecchia -> nuova numerazione (Deliberazione Assemblea Capitolina 11/2013):
# I+XVII->I, II+III->II, IV->III, V->IV, VI+VII->V, VIII->VI, IX+X->VII, XI->VIII,
# XII->IX, XIII->X, XV->XI, XVI->XII, XVIII->XIII, XIX->XIV, XX->XV.
OVERRIDE = {
    "3A45EF22-A8EC-4A3C-8663-62C5A3C9E2E5": (4, "IV MUNICIPIO, registrato nel 2015 (nuova numerazione), CAP 00156"),
    "2D768E99-34D3-4FBC-A18D-F973F2339F5D": (1, "MUNICIPIO ROMA I CENTRO: nome della nuova numerazione, CAP 00186"),
    "EA0B2360-84F8-491B-AD00-63EC7FA2F741": (3, "MUNICIPIO ROMA III, registrato nel 2014, CAP 00141"),
    "7F6139EA-7927-42C0-81DF-A3C60C69790E": (3, "MUNICIPIO ROMA III (EX IV): il nome indica la nuova numerazione, CAP 00137"),
    "F8511391-30DF-444F-9177-06AD05F386B5": (3, "MUNICIPIO ROMA III, registrato nel 2016, CAP 00139"),
    "513F646C-1A47-407B-83A0-13B8183EB073": (7, "MUNICIPIO ROMA VII (EX IX): il nome indica la nuova numerazione, CAP 00179"),
    "34FFD79E-05BD-48E0-A4CD-84BF744A299F": (7, "MUNICIPIO VII EX IX - EX X: nuova numerazione, CAP 00174"),
    "FBD0CDA2-98F2-4987-82DA-3A289474CEBC": (15, "MUNICIPIO XV registrato nel 2015 (nuova numerazione), CAP 00191 (Flaminio)"),
    "96C46BFB-C644-45A2-90FE-EEC21F618536": (11, "MUNICIPIO XV della vecchia numerazione: via Lupatelli 7, CAP 00149 (Portuense), oggi Municipio XI"),
    "C1FD8479-3238-4CF1-81CE-5B4C8EEB0D0D": (15, "MUNICIPIO XX della vecchia numerazione: via Flaminia 872, oggi Municipio XV"),
}
# Centri di costo con indizi in conflitto: non attribuiti a nessun municipio (restano nel
# totale di Roma Capitale e sono contati a parte).
AMBIGUI = {
    "7B6C2D66-01B6-407F-9A3C-6451F8101229": "MUNICIPIO XII - U.O.S.E.C.S., registrato nel 2025: il nome dice XII, "
    "ma indirizzo (via Ignazio Silone) e CAP 00143 sono quelli del Municipio IX; non attribuito",
}


def load_cdc():
    reg = {}
    with open(EXTRACT_CDC, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            reg[r["id_centro_di_costo"]] = r
    return reg


def map_centro(cid, nome, reg):
    """(municipio | None, regola, motivo)."""
    up = re.sub(r"\s+", " ", (nome or "").upper()).strip()
    if cid in AMBIGUI:
        return None, "ambiguo", AMBIGUI[cid]
    if cid in OVERRIDE:
        n, why = OVERRIDE[cid]
        return n, "manuale", why
    m = PLAIN.match(up)
    if m:
        n = roman(m.group(1))
        if 1 <= n <= 15:
            return n, "nome", "MUNICIPIO <numero>, numerazione attuale"
    if "MUNICIPIO" in up or "CIRCOSCRIZ" in up or "MUNICIPALE" in up:
        r = reg.get(cid, {})
        return None, "da_rivedere", (f"nome non standard, indirizzo {r.get('indirizzo') or '-'}, "
                                     f"CAP {r.get('cap') or '-'}: da decidere a mano")
    return None, "non_municipio", "centro di costo centrale (dipartimento, ufficio, ecc.)"


# ---------------------------------------------------------------- consolidamento

def num(s):
    s = (s or "").strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def consolidate():
    """Un record per CIG, dalla versione del file più recente."""
    by_cig = {}
    with open(EXTRACT, encoding="utf-8", newline="") as fh:
        for r in csv.DictReader(fh, delimiter=";"):
            cig = r["cig"].strip()
            order = int(r["_ordine"])
            cur = by_cig.get(cig)
            if cur is None or order > cur["_ordine"]:
                by_cig[cig] = {"_ordine": order, "rows": [r]}
            elif order == cur["_ordine"]:
                cur["rows"].append(r)
    recs = {}
    for cig, v in by_cig.items():
        rows = v["rows"]
        prev = [r for r in rows if (r.get("flag_prevalente") or "").strip() == "1"]
        main = prev[0] if prev else rows[0]
        recs[cig] = main
    return recs


def cancellato(r):
    return bool((r.get("DATA_CANCELLAZIONE") or "").strip()
                or (r.get("COD_MOTIVO_CANCELLAZIONE") or "").strip()
                or "CANCELL" in (r.get("stato") or "").upper())


def classe_scelta(t):
    t = (t or "").upper()
    if "ADESIONE" in t or "ACCORDO QUADRO" in t or "CONVENZIONE" in t:
        return "adesione_accordo_quadro"
    if t.startswith("AFFIDAMENTO DIRETTO") or "IN HOUSE" in t:
        return "affidamento_diretto"
    if "PROCEDURA APERTA" in t or "PROCEDURA RISTRETTA" in t:
        return "procedura_aperta_ristretta"
    if "NEGOZIATA" in t:
        return "procedura_negoziata"
    return "altro"


CLASSI = {
    "affidamento_diretto": "Affidamento diretto (anche a società in house)",
    "adesione_accordo_quadro": "Accordo quadro o adesione ad accordo quadro/convenzione",
    "procedura_aperta_ristretta": "Procedura aperta o ristretta",
    "procedura_negoziata": "Procedura negoziata (con o senza bando)",
    "altro": "Altre procedure o non indicata",
}

# Divisioni CPV (prime 2 cifre), Vocabolario comune per gli appalti, Reg. (CE) 213/2008.
CPV_DIV = {
    "03": "Prodotti dell'agricoltura, dell'allevamento, della pesca, della silvicoltura e affini",
    "09": "Prodotti derivati dal petrolio, combustibili, elettricità e altre fonti di energia",
    "14": "Prodotti delle miniere, dei metalli di base e affini",
    "15": "Prodotti alimentari, bevande, tabacco e prodotti affini",
    "16": "Macchinari agricoli",
    "18": "Indumenti, calzature, articoli da viaggio e accessori",
    "19": "Pelle e tessuti, materiali in plastica e gomma",
    "22": "Stampati e prodotti affini",
    "24": "Prodotti chimici",
    "30": "Macchine per ufficio ed elaboratori elettronici, attrezzature e forniture",
    "31": "Macchine, apparecchi, attrezzature e articoli elettrici; illuminazione",
    "32": "Apparecchiature radiotelevisive, per la comunicazione e le telecomunicazioni",
    "33": "Apparecchiature mediche, prodotti farmaceutici e per la cura della persona",
    "34": "Attrezzature di trasporto e prodotti ausiliari per il trasporto",
    "35": "Attrezzature di sicurezza, antincendio, per la polizia e di difesa",
    "37": "Strumenti musicali, articoli sportivi, giochi, giocattoli, articoli artistici",
    "38": "Attrezzature di laboratorio, ottiche e di precisione",
    "39": "Mobili, arredamento, elettrodomestici e prodotti per la pulizia",
    "41": "Acqua raccolta e depurata",
    "42": "Macchine industriali",
    "43": "Macchinari per l'industria mineraria, le cave e attrezzature per l'edilizia",
    "44": "Strutture e materiali per costruzione; prodotti ausiliari per costruzione",
    "45": "Lavori di costruzione",
    "48": "Pacchetti software e sistemi di informazione",
    "50": "Servizi di riparazione e manutenzione",
    "51": "Servizi di installazione (escluso software)",
    "55": "Servizi alberghieri, di ristorazione e di vendita al dettaglio",
    "60": "Servizi di trasporto (escluso il trasporto di rifiuti)",
    "63": "Servizi di supporto e ausiliari nel campo dei trasporti; agenzie di viaggio",
    "64": "Servizi di poste e telecomunicazioni",
    "65": "Servizi pubblici (acqua, gas, elettricità)",
    "66": "Servizi finanziari e assicurativi",
    "70": "Servizi immobiliari",
    "71": "Servizi architettonici, di costruzione, ingegneria e ispezione",
    "72": "Servizi informatici: consulenza, sviluppo di software, Internet e supporto",
    "73": "Servizi di ricerca e sviluppo e relativi servizi di consulenza",
    "75": "Servizi della pubblica amministrazione, della difesa e di previdenza sociale",
    "76": "Servizi connessi all'industria petrolifera e del gas",
    "77": "Servizi agricoli, forestali, orticoli, di acquacoltura e di apicoltura",
    "79": "Servizi per le imprese: legge, marketing, consulenza, reclutamento, stampa e sicurezza",
    "80": "Servizi di istruzione e formazione",
    "85": "Servizi sanitari e di assistenza sociale",
    "90": "Servizi fognari, di raccolta dei rifiuti, di pulizia e ambientali",
    "92": "Servizi ricreativi, culturali e sportivi",
    "98": "Altri servizi di comunità, sociali e personali",
}


def aggrega(items):
    """Aggregati su una lista di record CIG già consolidati."""
    n = len(items)
    tot = sum(it["importo"] for it in items)
    by_cls = defaultdict(lambda: [0, 0.0])
    tipi = defaultdict(set)
    for it in items:
        c = by_cls[it["classe"]]
        c[0] += 1
        c[1] += it["importo"]
        tipi[it["classe"]].add(it["scelta"])
    scelta = []
    for k, label in CLASSI.items():
        c, a = by_cls.get(k, [0, 0.0])
        scelta.append({
            "classe": k, "etichetta": label, "n_cig": c, "importo": round(a, 2),
            "quota_n": round(c / n, 4) if n else None,
            "quota_importo": round(a / tot, 4) if tot else None,
            "tipi_anac": sorted(tipi.get(k, ())),
        })
    by_cpv = defaultdict(lambda: [0, 0.0])
    for it in items:
        d = it["cpv_div"] or "nd"
        by_cpv[d][0] += 1
        by_cpv[d][1] += it["importo"]
    cpv = sorted(by_cpv.items(), key=lambda kv: (-kv[1][1], -kv[1][0], kv[0]))[:5]
    top = sorted(items, key=lambda it: (-it["importo"], it["cig"]))[:10]
    n_senza = sum(1 for it in items if it["importo_mancante"])
    return {
        "n_cig": n,
        "importo_totale": round(tot, 2),
        "n_cig_importo_zero_o_mancante": n_senza,
        "n_cig_attuativi_di_accordo_quadro": sum(1 for it in items if it["cig_aq"]),
        "importo_cig_attuativi_di_accordo_quadro": round(sum(it["importo"] for it in items if it["cig_aq"]), 2),
        "per_scelta_contraente": scelta,
        "top5_cpv_divisioni_per_importo": [
            {"divisione": d, "etichetta": CPV_DIV.get(d, "CPV non indicato" if d == "nd" else "Divisione non in elenco"),
             "n_cig": c, "importo": round(a, 2), "quota_importo": round(a / tot, 4) if tot else None}
            for d, (c, a) in cpv],
        "top10_cig_per_importo": [
            {"cig": it["cig"], "oggetto": it["oggetto"], "importo": it["importo"],
             "data_pubblicazione": it["data"], "scelta_contraente": it["scelta"],
             "centro_di_costo": it["centro"]}
            for it in top],
    }


# ---------------------------------------------------------------- sovrapposizioni

GIORNI_RILANCIO = 30
REGOLA_RILANCIO = (
    "Gara rilanciata: una gara (numero_gara) dello stesso centro di costo di un'altra gara dello stesso "
    "insieme, con lo stesso numero di lotti e, lotto per lotto, lo stesso oggetto (normalizzato: maiuscole, "
    "solo lettere e cifre) e lo stesso importo_lotto; nessun suo lotto ha un esito nei dati ANAC (campo ESITO "
    "vuoto), almeno un lotto dell'altra gara ce l'ha, e l'altra gara è pubblicata lo stesso giorno o entro "
    f"{GIORNI_RILANCIO} giorni dopo. Si sottraggono i CIG della gara senza esito.")


def norm_oggetto(t):
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", (t or "").upper())).strip()


def sovrapposizioni(sel):
    """CIG di un insieme (municipio-anno o Roma-anno) il cui importo è già contato in un altro CIG dello stesso insieme."""
    cigs = {it["cig"] for it in sel}
    aq = [it for it in sel if it["cig_aq"] and it["cig_aq"] != it["cig"] and it["cig_aq"] in cigs]
    gare = defaultdict(list)
    for it in sel:
        if it["gara"]:
            gare[(it["centro_id"], it["gara"])].append(it)
    firma = {k: sorted((norm_oggetto(it["oggetto"]), it["importo"]) for it in v) for k, v in gare.items()}
    ril = []
    for k, lotti in gare.items():
        if any(it["esito"] for it in lotti):
            continue
        d0 = datetime.date.fromisoformat(max(it["data"] for it in lotti))
        for k2, lotti2 in gare.items():
            if k2 == k or k2[0] != k[0] or firma[k2] != firma[k] or not any(it["esito"] for it in lotti2):
                continue
            d1 = datetime.date.fromisoformat(min(it["data"] for it in lotti2))
            if 0 <= (d1 - d0).days <= GIORNI_RILANCIO:
                ril.extend(lotti)
                break
    union = {it["cig"]: it["importo"] for it in aq + ril}
    return {
        "attuativi_aq": {"n_cig": len(aq), "importo": round(sum(it["importo"] for it in aq), 2)},
        "gare_rilanciate": {"n_cig": len(ril), "importo": round(sum(it["importo"] for it in ril), 2),
                            "cig": sorted(it["cig"] for it in ril)},
        "importo": round(sum(union.values()), 2),
    }


def build():
    reg = load_cdc()
    stats = json.loads((RAW / "estrazione_stats.json").read_text(encoding="utf-8"))
    recs = consolidate()
    taglio = TAGLIO_2026
    max_pub_delta = stats[FILES_DELTA[-1]]["max_data_pubblicazione"]
    mesi_2026 = Counter()
    dopo_taglio = 0
    items = []
    n_canc = 0
    fuori = Counter()
    mapping = {}
    for cig, r in recs.items():
        if cancellato(r):
            n_canc += 1
            continue
        data = (r.get("data_pubblicazione") or "").strip()[:10]
        anno = data[:4]
        if anno not in ANNI:
            fuori[anno or "nd"] += 1
            continue
        if anno == "2026":
            mesi_2026[data[:7]] += 1
            if data > taglio:
                dopo_taglio += 1
                continue
        cid = (r.get("id_centro_costo") or "").strip()
        nome = re.sub(r"\s+", " ", (r.get("denominazione_centro_costo") or "").strip())
        key = (cid, nome)
        if key not in mapping:
            mapping[key] = map_centro(cid, nome, reg)
        mun = mapping[key][0]
        imp = num(r.get("importo_lotto"))
        cpv = (r.get("cod_cpv") or "").strip()
        items.append({
            "cig": cig, "anno": anno, "data": data, "municipio": mun, "centro": nome,
            "centro_id": cid,
            "importo": round(imp, 2) if imp is not None else 0.0,
            "importo_mancante": imp is None or imp == 0,
            "classe": classe_scelta(r.get("tipo_scelta_contraente")),
            "scelta": (r.get("tipo_scelta_contraente") or "").strip() or "ND",
            "cpv_div": cpv[:2] if re.match(r"^\d{2}", cpv) else None,
            "oggetto": re.sub(r"\s+", " ", html.unescape((r.get("oggetto_lotto") or r.get("oggetto_gara") or "").strip())),
            "cig_aq": (r.get("cig_accordo_quadro") or "").strip(),
            "gara": (r.get("numero_gara") or "").strip(),
            "esito": (r.get("ESITO") or "").strip(),
            "ausa": (r.get("codice_ausa") or "").strip(),
            "file": r["_file"],
        })

    # ---- controlli e stampa mappatura
    righe_cc = Counter()
    for it in items:
        righe_cc[(it["centro_id"], it["centro"])] += 1
    print("\nCentri di costo (CIG 2025-2026):")
    with open(MAPPING_OUT, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["id_centro_costo", "denominazione_centro_costo", "municipio", "regola", "motivo",
                    "n_cig_2025_2026", "stato_anagrafica", "indirizzo", "cap"])
        for (cid, nome), n in sorted(righe_cc.items(), key=lambda kv: (str(mapping[kv[0]][0] or 99).zfill(2), kv[0][1])):
            mun, regola, why = mapping[(cid, nome)]
            rg = reg.get(cid, {})
            w.writerow([cid, nome, mun or "", regola, why, n, rg.get("stato", ""),
                        rg.get("indirizzo", ""), rg.get("cap", "")])
            if regola != "non_municipio":
                print(f"  {str(mun or '-'):>2}  {regola:<11} {n:>5}  {nome}")
    da_rivedere = [k for k, v in mapping.items() if v[1] == "da_rivedere"]
    if da_rivedere:
        # un centro di costo con "MUNICIPIO" nel nome non attribuito va deciso a mano (OVERRIDE o AMBIGUI)
        for cid, nome in da_rivedere:
            print(f"  FAIL centro di costo da rivedere: {cid} {nome!r}: {mapping[(cid, nome)][2]}")
        raise SystemExit(f"ERRORE: {len(da_rivedere)} centri di costo con 'MUNICIPIO' non attribuiti: snapshot non scritto")
    n_map = sum(1 for it in items if it["municipio"])
    n_unmapped_mun = sum(1 for it in items if mapping[(it["centro_id"], it["centro"])][1] in ("da_rivedere", "ambiguo"))
    n_central = sum(1 for it in items if mapping[(it["centro_id"], it["centro"])][1] == "non_municipio")
    print(f"\nCIG 2025-2026 Roma Capitale: {len(items)}; attribuiti a un municipio: {n_map}; "
          f"municipio non attribuito (ambiguo o da rivedere): {n_unmapped_mun}; centri di costo centrali: {n_central}")
    print(f"Centri di costo con 'MUNICIPIO' da rivedere: {len(da_rivedere)} {da_rivedere}")
    print(f"CIG esclusi perché cancellati: {n_canc}; CIG di Roma con data_pubblicazione fuori 2025-2026: {dict(sorted(fuori.items()))}")
    print(f"CIG 2026 per mese di pubblicazione (prima del taglio al {taglio}): {dict(sorted(mesi_2026.items()))}; "
          f"esclusi perché dopo il taglio: {dopo_taglio}")
    ausa = Counter(it["ausa"] for it in items)
    print(f"Codici AUSA nei CIG di Roma Capitale: {dict(ausa)}")

    # ---- aggregati
    municipi = {}
    for m in range(1, 16):
        municipi[str(m)] = {}
        for a in ANNI:
            sel = [it for it in items if it["municipio"] == m and it["anno"] == a]
            municipi[str(m)][a] = aggrega(sel)
            sov = sovrapposizioni(sel)
            municipi[str(m)][a]["sovrapposizioni"] = sov
            municipi[str(m)][a]["importo_netto"] = round(municipi[str(m)][a]["importo_totale"] - sov["importo"], 2)
        municipi[str(m)]["varianti_nome"] = sorted({
            nome for (cid, nome), v in mapping.items() if v[0] == m})
        municipi[str(m)]["centri_di_costo"] = [
            {"id_centro_costo": cid, "denominazione": nome, "regola": v[1], "motivo": v[2],
             "n_cig_2025_2026": righe_cc[(cid, nome)]}
            for (cid, nome), v in sorted(mapping.items(), key=lambda kv: kv[0][1]) if v[0] == m]
    roma = {"descrizione": "Roma Capitale, tutti i centri di costo (dipartimenti, uffici centrali e municipi)"}
    for a in ANNI:
        all_a = [it for it in items if it["anno"] == a]
        agg = aggrega(all_a)
        mun_a = [it for it in all_a if it["municipio"]]
        n_m, imp_m = len(mun_a), sum(it["importo"] for it in mun_a)
        nonattr = [it for it in all_a if mapping[(it["centro_id"], it["centro"])][1] in ("da_rivedere", "ambiguo")]
        agg["somma_municipi"] = {
            "n_cig": n_m, "importo": round(imp_m, 2),
            "quota_n": round(n_m / len(all_a), 4) if all_a else None,
            "quota_importo": round(imp_m / agg["importo_totale"], 4) if agg["importo_totale"] else None,
        }
        agg["municipio_non_attribuito"] = {"n_cig": len(nonattr),
                                           "importo": round(sum(it["importo"] for it in nonattr), 2)}
        # CIG attuativi il cui accordo quadro è a sua volta un CIG di Roma Capitale in questo
        # snapshot: sommandoli al CIG dell'accordo quadro lo stesso valore sarebbe contato due volte.
        all_roma_cigs = {it["cig"] for it in items}
        dop = [it for it in all_a if it["cig_aq"] and it["cig_aq"] in all_roma_cigs]
        agg["attuativi_di_accordo_quadro_di_roma"] = {
            "n_cig": len(dop), "importo": round(sum(it["importo"] for it in dop), 2),
            "nota": "CIG derivati da un accordo quadro che è anch'esso un CIG di Roma Capitale 2025-2026: "
                    "il loro importo è già compreso nell'importo dell'accordo quadro."}
        sov = sovrapposizioni(all_a)
        agg["sovrapposizioni"] = sov
        agg["importo_netto"] = round(agg["importo_totale"] - sov["importo"], 2)
        netto_m = round(sum(municipi[str(m)][a]["importo_netto"] for m in range(1, 16)), 2)
        agg["somma_municipi"]["importo_netto"] = netto_m
        agg["somma_municipi"]["quota_importo_netto"] = round(netto_m / agg["importo_netto"], 4) if agg["importo_netto"] else None
        roma[a] = agg
        for k, g in [*((str(m), municipi[str(m)][a]) for m in range(1, 16)), ("roma", agg)]:
            ok_s = 0 <= g["sovrapposizioni"]["importo"] <= g["importo_totale"] + 0.01
            if not ok_s:
                raise SystemExit(f"ERRORE {a} {k}: sovrapposizioni {g['sovrapposizioni']['importo']} fuori da 0..importo_totale")
        # controllo: somma municipi <= totale Roma
        s_n = sum(municipi[str(m)][a]["n_cig"] for m in range(1, 16))
        s_i = sum(municipi[str(m)][a]["importo_totale"] for m in range(1, 16))
        ok = s_n <= agg["n_cig"] and s_i <= agg["importo_totale"] + 0.01
        print(f"Controllo {a}: somma municipi {s_n} CIG / {s_i:,.2f} EUR  <=  Roma {agg['n_cig']} CIG / "
              f"{agg['importo_totale']:,.2f} EUR  -> {'OK' if ok else 'ERRORE'}")
        if not ok:
            raise SystemExit("somma dei municipi superiore al totale di Roma Capitale")

    src_rows = {n: stats[n]["righe_roma"] for n in FILES_2025 + FILES_DELTA}
    out = {
        "id": "appalti_anac",
        "titolo": "Appalti avviati da Roma Capitale per municipio (CIG ANAC), 2025 e 2026",
        "fonte": {
            "nome": "Banca Dati Nazionale dei Contratti Pubblici, open data CIG: \"CIG anno 2025\" "
                    "(12 file mensili) e \"CIG aggiornamenti delta\" (file da 20260401 a 20261101); "
                    "anagrafica \"Centri di costo\"",
            "ente": "ANAC, Autorità Nazionale Anticorruzione",
            "url": "https://dati.anticorruzione.it/opendata/dataset/cig-2025",
            "link": [
                {"nome": "CIG anno 2025", "url": "https://dati.anticorruzione.it/opendata/dataset/cig-2025"},
                {"nome": "CIG aggiornamenti delta", "url": "https://dati.anticorruzione.it/opendata/dataset/cig"},
                {"nome": "Centri di costo", "url": "https://dati.anticorruzione.it/opendata/dataset/centri-di-costo"},
            ],
            "licenza": "CC BY-SA 4.0",
            "licenza_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.it",
        },
        "periodo": {
            "2025": "CIG con data_pubblicazione dal 2025-01-01 al 2025-12-31 (dataset CIG anno 2025, "
                    "pubblicato a gennaio 2026, aggiornato con i delta 2026 per i CIG modificati dopo)",
            "2026": f"CIG con data_pubblicazione dal 2026-01-01 fino al {taglio} (9 mesi), dai delta ANAC "
                    f"20260401-20261101 (ultimo rilasciato il {DELTA_RILASCIO['20261101']}). Ottobre 2026 escluso "
                    "perché nell'ultimo delta è presente solo in parte. Anno in corso, non confrontabile con un anno intero",
        },
        "verificato": datetime.date.fromtimestamp(
            min((ZIPS / n).stat().st_mtime for n in FILES_2025 + FILES_DELTA + [CDC_ZIP])).isoformat(),
        "misura": (
            "Per ogni municipio e anno: numero di CIG (codici identificativi di gara, uno per lotto) "
            "avviati dai centri di costo del municipio, somma di importo_lotto (importo del lotto a base di "
            "gara/affidamento, IVA esclusa come dichiarato dalla stazione appaltante), quote per tipo di "
            "scelta del contraente, prime 5 divisioni CPV per importo, 10 CIG più grandi. Anno = anno di "
            "data_pubblicazione del CIG. Stesse misure per Roma Capitale nel complesso (tutti i centri di "
            "costo, cf 02438750586, AUSA 0000207775). importo_totale è la somma lorda; importo_netto toglie "
            "le sovrapposizioni dentro lo stesso insieme (municipio e anno, oppure Roma e anno): i CIG attuativi "
            "di un accordo quadro il cui CIG è nello stesso insieme (attuativi_aq: il loro importo è già "
            "nell'accordo quadro) e le gare rilanciate (gare_rilanciate). " + REGOLA_RILANCIO +
            " Un CIG che rientra in entrambi i casi è tolto una volta sola (sovrapposizioni.importo)."),
        "non_misura": [
            "CIG = importo a base di gara/aggiudicazione, non pagamenti: non dice quanto è stato davvero speso né quando.",
            "Si somma importo_lotto (uno per CIG); importo_complessivo_gara non si usa perché si ripete su ogni lotto della stessa gara.",
            "Un importo grande può coprire più anni (contratti pluriennali, accordi quadro): non è la spesa di un anno.",
            "I CIG attuativi di un accordo quadro ripetono una parte dell'importo dell'accordo quadro: importo_netto li toglie solo se l'accordo quadro è nello stesso insieme (stesso municipio e anno, o Roma e anno). Un attuativo di un accordo quadro di un altro anno, di un altro municipio o di un dipartimento centrale resta nel netto del municipio. Per Roma, attuativi_di_accordo_quadro_di_roma conta anche gli accordi quadro dell'altro anno.",
            "Le gare rilanciate sono riconosciute solo con la regola scritta in misura (stesso centro di costo, stessi lotti, nessun esito, entro 30 giorni): altre ripetizioni non sono tolte.",
            "Contano solo gli appalti avviati dai centri di costo intestati al municipio: lavori, servizi e forniture che riguardano il territorio del municipio ma sono gestiti da dipartimenti centrali, società partecipate o altri enti non sono attribuiti al municipio.",
            "Il centro di costo è quello registrato dalla stazione appaltante su ANAC: errori o nomi storici (vecchia numerazione a 19+1 municipi) sono stati ricondotti a mano solo con indizi espliciti; i casi dubbi restano non attribuiti.",
            "ANAC pubblica i CIG attivi: i CIG cancellati non compaiono nei file e non sono contati (nessuna riga marcata come cancellata nei file di Roma).",
            "Il 2026 è ricostruito dai soli file delta di ANAC (non esiste ancora un dataset annuale 2026) e arriva solo fino alla data di taglio indicata.",
            "Una quota alta di affidamenti diretti o un importo alto sono un dato da leggere nel contesto (soglie di legge, tipo di servizio), non un indizio di irregolarità.",
        ],
        "municipi": municipi,
        "roma": roma,
    }
    roma["note_tecniche"] = {
            "campo_importo": "importo_lotto",
            "campo_anno": "data_pubblicazione",
            "consolidamento": "un record per CIG; vince la versione del file più recente (2025 full < delta in ordine di data); "
                              "con più righe per lo stesso CIG (una per codice CPV) si usa quella con flag_prevalente=1",
            "classi_scelta_contraente": CLASSI,
            "data_taglio_2026": taglio,
            "max_data_pubblicazione_ultimo_delta": max_pub_delta,
            "cig_roma_2026_per_mese_pubblicazione": dict(sorted(mesi_2026.items())),
            "cig_roma_2026_esclusi_dopo_taglio": dopo_taglio,
            "cig_roma_fuori_2025_2026_nei_file": dict(sorted(fuori.items())),
            "nota_cig_fuori_periodo": "I file 2025 e i delta contengono anche CIG pubblicati prima del 2025 "
                                      "(aggiornati dopo): sono letti ma non contati.",
            "righe_roma_capitale_per_file": src_rows,
            "cig_esclusi_cancellati": n_canc,
            "mappa_centri_di_costo": "data/raw/appalti/mappa_centri_di_costo.csv",
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nScritto {OUT.relative_to(ROOT)}")
    print("\n2025 per municipio (n CIG, importo_lotto):")
    for m in range(1, 16):
        a = municipi[str(m)]["2025"]
        b = municipi[str(m)]["2026"]
        print(f"  {m:>2}: 2025 {a['n_cig']:>5} {a['importo_totale']:>17,.2f}   2026 {b['n_cig']:>5} {b['importo_totale']:>17,.2f}")
    for a in ANNI:
        print(f"  Roma {a}: {roma[a]['n_cig']} CIG, {roma[a]['importo_totale']:,.2f} EUR; municipi "
              f"{roma[a]['somma_municipi']['quota_n']:.1%} dei CIG, {roma[a]['somma_municipi']['quota_importo']:.1%} dell'importo")


if __name__ == "__main__":
    if "--no-download" not in sys.argv:
        download(FILES_2025 + FILES_DELTA + [CDC_ZIP])
    extract()
    build()
