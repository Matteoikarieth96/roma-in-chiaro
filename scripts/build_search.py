"""Indice della ricerca del sito (pagina #/cerca). Vedi RICERCA.md.

Si costruisce al build dagli snapshot, non dalla pagina già scritta. L'indice non copia i
testi: ogni "documento" è un puntatore a un record degli snapshot (che sono già nella
pagina), e la pagina ne legge testo, importo e periodo al momento della ricerca.

Tre categorie di nomi:
  P  Progetti: i titoli dei progetti di progetti.json, uniti quando il titolo è lo stesso.
  Q  Quartieri: le 457 aree di data/snapshot/quartieri.json (deliberazione 150/2026).
  V  Vie, piazze e parchi: i nomi trovati nel testo dei dati (via, piazza, largo, parco,
     villa...), riconosciuti sullo stradario ufficiale di Roma Capitale
     (data/riferimenti/stradario_roma.json, usato solo qui) e, per parchi, ville e
     giardini che lo stradario non ha, dal testo stesso.
Per ogni nome l'indice tiene tutti i documenti che lo citano.

Uso diretto (statistiche, senza scrivere niente):
    python scripts/build_search.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------- normalizzazione
# Abbreviazioni sciolte prima di confrontare. La pagina usa la stessa lista (indice["abbr"]):
# le regex devono valere sia in Python sia in JavaScript.
ABBR = [
    [r"\bp\.\s?zzale\b\.?", "piazzale "],
    [r"\bp\.\s?zzetta\b\.?", "piazzetta "],
    [r"\bp\.?\s?zz?a\b\.?", "piazza "],
    [r"\bp\.\s?le\b\.?", "piazzale "],
    [r"\bv\.\s?le\b\.?", "viale "],
    [r"\bl\.\s?go\b\.?", "largo "],
    [r"\bl\.\s?tevere\b\.?", "lungotevere "],
    [r"\blgt\b\.?", "lungotevere "],
    [r"\bcirc\.\s?ne\b\.?", "circonvallazione "],
    [r"\bc\.\s?ne\b\.?", "circonvallazione "],
    [r"\bc\.\s?so\b\.?", "corso "],
    [r"\bv\.\s?lo\b\.?", "vicolo "],
]
_ABBR_RE = [(re.compile(p, re.I), r) for p, r in ABBR]


def espandi(s):
    for rx, r in _ABBR_RE:
        s = rx.sub(r, s)
    return s


def norm_map(s):
    """Testo normalizzato (minuscole, senza accenti, solo a-z0-9 e spazi singoli) e, per ogni
    carattere del risultato, la posizione nel testo di partenza."""
    out, pos = [], []
    for i, ch in enumerate(s):
        for c in unicodedata.normalize("NFD", ch).lower():
            if unicodedata.category(c) == "Mn":
                continue
            if "a" <= c <= "z" or "0" <= c <= "9":
                out.append(c); pos.append(i)
            elif out and out[-1] != " ":
                out.append(" "); pos.append(i)
    while out and out[-1] == " ":
        out.pop(); pos.pop()
    return "".join(out), pos


def norm(s):
    return norm_map(espandi(str(s or "")))[0]


# ---------------------------------------------------------------- dove sono i testi
# Inventario dei campi di testo (RICERCA.md, "Campi coperti"). Ogni sezione dice da quale
# record vengono i documenti, quali campi contengono nomi e dove il record compare sul sito.
# path: segmenti separati da "/", {0} {1} ... sono riempiti dalle variabili del documento.
SEZIONI = [
    dict(id="prog_mun", gruppo="Progetti PNRR, Giubileo e altri fondi", nome="Progetti nella scheda del municipio", tipo="prog",
         path="progetti/municipi/{0}/progetti/{1}", campi=["titolo", "luogo", "attuatore", "municipio_evidenza"], imp="importo_programma_euro",
         dove="Tabella \"Progetti sul territorio\" della scheda del municipio", luoghi=True),
    dict(id="prog_citta", gruppo="Progetti PNRR, Giubileo e altri fondi", nome="Progetti su più municipi o su tutta la città", tipo="prog",
         path="progetti/cittadino/{0}/progetti/{1}", campi=["titolo", "luogo", "attuatore", "municipio_evidenza"], imp="importo_programma_euro",
         dove="Non elencato una per una sul sito: entra nel totale \"Dove finiscono i fondi straordinari\" della pagina iniziale", luoghi=True),
    dict(id="cig_mun", gruppo="Appalti ANAC", nome="I 10 CIG più grandi del municipio", tipo="cig",
         path="appalti_anac/municipi/{0}/{1}/top10_cig_per_importo/{2}", campi=["oggetto", "centro_di_costo"], imp="importo",
         dove="Tabella dei 10 CIG più grandi del 2025 nella scheda del municipio", dove_nascosto="Nei dati del sito, non nella tabella della scheda (che mostra solo il 2025)", luoghi=True),
    dict(id="cig_roma", gruppo="Appalti ANAC", nome="I 10 CIG più grandi di Roma Capitale (tutte le strutture)", tipo="cig",
         path="appalti_anac/roma/{0}/top10_cig_per_importo/{1}", campi=["oggetto", "centro_di_costo"], imp="importo",
         dove_nascosto="Nei dati del sito, non mostrato in una pagina", luoghi=True),
    dict(id="cpv", gruppo="Appalti ANAC", nome="Categorie CPV degli appalti del municipio", tipo="voce",
         path="appalti_anac/municipi/{0}/{1}/top5_cpv_divisioni_per_importo/{2}", campi=["etichetta"], imp="importo",
         dove="Pannello \"Cosa si compra\" della scheda del municipio", dove_nascosto="Nei dati del sito, non nella scheda (che mostra solo il 2025)"),
    dict(id="cdc", gruppo="Appalti ANAC", nome="Centri di costo ANAC attribuiti al municipio", tipo="nota",
         path="appalti_anac/municipi/{0}/centri_di_costo/{1}", campi=["denominazione", "motivo"],
         dove_nascosto="Nei dati del sito (attribuzione dei CIG al municipio), non mostrato in una pagina", luoghi=True),
    dict(id="pol_pres", gruppo="Organi politici", nome="Presidente del municipio", tipo="pers",
         path="politica/municipi/{0}", campi=["presidente", "presidente_deleghe"], titolo="presidente",
         dove="Intestazione e riquadro \"Giunta\" della scheda del municipio"),
    dict(id="pol_giunta", gruppo="Organi politici", nome="Giunta", tipo="pers",
         path="politica/municipi/{0}/giunta/{1}", campi=["nome", "ruolo", "deleghe"],
         dove="Riquadro \"Giunta\" della scheda del municipio"),
    dict(id="pol_cons", gruppo="Organi politici", nome="Consiglio", tipo="pers",
         path="politica/municipi/{0}/consiglio/consiglieri/{1}", campi=["nome", "ruolo", "gruppo", "gruppo_da_simbolo"],
         dove="Elenco dei consiglieri nella scheda del municipio"),
    dict(id="peg_prog", gruppo="Bilancio PEG 2026", nome="Programmi di spesa", tipo="voce",
         path="bilancio_peg_2026/municipi/{0}/spese/per_programma/{1}", campi=["nome", "codice"], imp="competenza_2026",
         dove="Tabella dei programmi della scheda del municipio", dove_nascosto="Nei dati del sito, non tra i 12 programmi mostrati nella scheda"),
    dict(id="peg_mis", gruppo="Bilancio PEG 2026", nome="Missioni di spesa", tipo="voce",
         path="bilancio_peg_2026/municipi/{0}/spese/per_missione/{1}", campi=["nome", "codice"], imp="competenza_2026",
         dove="Pannello \"Per missione\" della scheda del municipio", dove_nascosto="Nei dati del sito, non tra le 10 missioni mostrate nella scheda"),
    dict(id="peg_macro", gruppo="Bilancio PEG 2026", nome="Tipi di spesa (macroaggregati)", tipo="voce",
         path="bilancio_peg_2026/municipi/{0}/spese/per_macroaggregato/{1}", campi=["nome", "codice"], imp="competenza_2026",
         dove="Pannello \"Per tipo di spesa\" della scheda del municipio", dove_nascosto="Nei dati del sito, non tra gli 8 tipi mostrati nella scheda"),
    dict(id="peg_entr", gruppo="Bilancio PEG 2026", nome="Entrate per titolo", tipo="voce",
         path="bilancio_peg_2026/municipi/{0}/entrate/per_titolo/{1}", campi=["nome", "codice"], imp="competenza_2026",
         dove_nascosto="Nei dati del sito: la scheda mostra solo il totale delle entrate"),
    dict(id="nidi", gruppo="Nidi", nome="Posti per tipo di gestione", tipo="voce", unita="posti",
         path="nidi/municipi/{0}/posti_per_tipologia/{1}", campi=["@chiave"], imp="@valore",
         dove="Pannello \"Posti per tipo di gestione\" della scheda del municipio"),
    dict(id="ann", gruppo="Fonti e metodo", nome="Indicatori dell'Annuario statistico", tipo="nota",
         path="profilo_annuario/indicatori/{0}", campi=["etichetta", "misura", "non_misura", "tabella", "periodo"],
         dove="Pagina Fonti e metodo e tabella \"Profilo del territorio\" delle schede", luoghi=True),
    dict(id="meta", gruppo="Fonti e metodo", nome="Descrizione degli insiemi di dati", tipo="nota",
         path="{0}", campi=["titolo", "misura", "non_misura", "periodo"],
         dove="Pagina Fonti e metodo", luoghi=True),
]
SEZ = {s["id"]: i for i, s in enumerate(SEZIONI)}
GRUPPI_CITTADINI = ["piu_municipi", "intermunicipale", "senza_municipio"]


def get(data, path):
    o = data
    for k in path.split("/"):
        o = o[int(k)] if isinstance(o, list) else o[k]
    return o


def testo(rec, campi, path):
    parti = []
    for c in campi:
        v = path.rsplit("/", 1)[-1] if c == "@chiave" else (rec.get(c) if isinstance(rec, dict) else None)
        if isinstance(v, list):
            v = " · ".join(str(x) for x in v if x)
        elif isinstance(v, dict):
            v = " · ".join(str(x) for x in v.values() if x)
        if v:
            parti.append(str(v))
    return " · ".join(parti)


def documenti(data):
    """Tutti i record con testo: [(sezione, municipi, variabili, nascosto)]."""
    docs = []
    add = lambda sez, mun, var, nasc=False: docs.append((SEZ[sez], mun, [str(v) for v in var], bool(nasc)))
    ids = [str(i) for i in range(1, 16)]
    P = data.get("progetti")
    if P:
        for m in ids:
            for i, _ in enumerate(P["municipi"].get(m, {}).get("progetti", [])):
                add("prog_mun", int(m), [m, i])
        for g in GRUPPI_CITTADINI:
            for i, p in enumerate(P.get("cittadino", {}).get(g, {}).get("progetti", [])):
                tag = sorted({int(t) for t in (p.get("municipio_tag") or []) if str(t).isdigit()})
                add("prog_citta", tag if len(tag) > 1 else (tag[0] if tag else 0), [g, i])
    A = data.get("appalti_anac")
    if A:
        for m in ids:
            mm = A["municipi"].get(m, {})
            for anno in ("2025", "2026"):
                for i, _ in enumerate(mm.get(anno, {}).get("top10_cig_per_importo", [])):
                    add("cig_mun", int(m), [m, anno, i], anno != "2025")
                for i, _ in enumerate(mm.get(anno, {}).get("top5_cpv_divisioni_per_importo", [])):
                    add("cpv", int(m), [m, anno, i], anno != "2025")
            for i, _ in enumerate(mm.get("centri_di_costo", [])):
                add("cdc", int(m), [m, i], True)
        for anno in ("2025", "2026"):
            for i, _ in enumerate(A.get("roma", {}).get(anno, {}).get("top10_cig_per_importo", [])):
                add("cig_roma", 0, [anno, i], True)
    PO = data.get("politica")
    if PO:
        for m in ids:
            mm = PO["municipi"].get(m)
            if not mm:
                continue
            if mm.get("presidente"):
                add("pol_pres", int(m), [m])
            for i, _ in enumerate(mm.get("giunta") or []):
                add("pol_giunta", int(m), [m, i])
            for i, _ in enumerate((mm.get("consiglio") or {}).get("consiglieri") or []):
                add("pol_cons", int(m), [m, i])
    B = data.get("bilancio_peg_2026")
    if B:
        # stesse regole della scheda (sections.js): voci con competenza 2026 > 0, nell'ordine del file
        mostrate = {"per_programma": 12, "per_missione": 10, "per_macroaggregato": 8}
        for m in ids:
            sp = B["municipi"].get(m, {}).get("spese") or {}
            for key, sez in (("per_programma", "peg_prog"), ("per_missione", "peg_mis"), ("per_macroaggregato", "peg_macro")):
                pos = 0
                for i, x in enumerate(sp.get(key) or []):
                    vis = (x.get("competenza_2026") or 0) > 0 and pos < mostrate[key]
                    if (x.get("competenza_2026") or 0) > 0:
                        pos += 1
                    add(sez, int(m), [m, i], not vis)
            for i, _ in enumerate((B["municipi"].get(m, {}).get("entrate") or {}).get("per_titolo") or []):
                add("peg_entr", int(m), [m, i], True)
    N = data.get("nidi")
    if N:
        for m in ids:
            for k in (N["municipi"].get(m, {}).get("posti_per_tipologia") or {}):
                assert "/" not in k, k
                add("nidi", int(m), [m, k])
    AN = data.get("profilo_annuario")
    if AN:
        for k in AN.get("indicatori", {}):
            add("ann", 0, [k])
    for k, s in data.items():
        if isinstance(s, dict) and s.get("fonte") and k != "mappa":
            add("meta", 0, [k])
    return docs


def path_doc(d):
    return SEZIONI[d[0]]["path"].format(*d[2])


# ---------------------------------------------------------------- quartieri
# Nomi di una parola che sono anche parole comuni o cognomi: valgono solo se preceduti da
# "rione", "quartiere", "zona", "località" o "borgata", oppure (tranne RIGIDI) se il record è
# dello stesso municipio dell'area. Vedi RICERCA.md, "Limiti".
AMBIGUI = {"borgo", "colonna", "monti", "ponte", "prati", "regola", "ripa", "pigna", "italia", "trieste", "salario",
           "belvedere", "lunghezza", "salone", "mistica", "certosa", "morena", "pretorio", "giardinetti", "omo",
           "statuario", "finocchio", "flaminio", "verano", "centroni", "miani", "igea", "africano", "tecnopolo",
           "celio", "trevi", "esquilino", "nomentano", "collatino", "ardeatino", "pinciano", "parioli", "eur",
           "aurelio", "portuense", "ostiense", "tiburtino", "prenestino", "tuscolano", "trionfale", "gianicolense"}
RIGIDI = {"borgo", "colonna", "ponte", "regola", "ripa", "italia", "trieste", "salone", "salario", "belvedere",
          "pretorio", "lunghezza", "mistica", "certosa", "morena", "statuario", "finocchio", "omo", "pigna"}
QUALIFICATORI = {"rione", "quartiere", "zona", "localita", "loc", "borgata", "frazione"}
NUMERI_ROMANI = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"}


def alias_aree(aree):
    """Nome intero normalizzato di ogni area, più le parti dei nomi doppi ("Lamaro - Cinecittà")
    quando non sono il nome di un'altra area."""
    interi = {norm(a["nome"]): i for i, a in enumerate(aree)}
    alias = {}
    for i, a in enumerate(aree):
        alias.setdefault(norm(a["nome"]), set()).add(i)
        if " - " in a["nome"]:
            for parte in a["nome"].split(" - "):
                n = norm(parte)
                if n and n not in interi and len(n) >= 4:
                    alias.setdefault(n, set()).add(i)
    return alias


# ---------------------------------------------------------------- vie, piazze e parchi
PREFISSI = {"via", "viale", "piazza", "piazzale", "piazzetta", "largo", "lungotevere", "lungomare", "circonvallazione",
            "vicolo", "ponte", "corso", "salita", "clivo", "rampa", "viadotto", "galleria", "borgo", "strada", "parco",
            "villa", "giardino", "giardini"}
LIBERI = {"parco", "villa", "giardino", "giardini"}  # riconosciuti anche fuori dallo stradario
PREP = {"di", "de", "del", "della", "dello", "dei", "degli", "delle", "d", "dell", "da", "dal", "dalla", "dai", "dagli",
        "dalle", "a", "al", "alla", "allo", "ai", "agli", "alle", "e", "in", "lo", "la", "le", "il", "i", "gli", "l"}
STOP = {"e", "ed", "o", "nel", "nella", "nei", "negli", "nelle", "nello", "in", "per", "presso", "con", "tra", "fra",
        "fino", "angolo", "ang", "civico", "civ", "snc", "n", "nn", "nr", "municipio", "mun", "zona", "lotto", "lotti",
        "cig", "cup", "sito", "sita", "siti", "site", "situato", "situata", "ubicato", "ubicata", "compreso", "compresa",
        "interno", "interna", "adiacente", "lato", "tratto", "tratti", "roma", "rm", "incrocio", "altezza", "sx", "dx",
        "km", "fronte", "direzione", "uscita", "svincolo", "dal", "dalla"}
FERMA_LIBERI = STOP | {"lavori", "manutenzione", "interventi", "intervento", "realizzazione", "recupero", "restauro",
                       "riqualificazione", "sistemazione", "servizio", "servizi", "fornitura", "progetto", "opere",
                       "completamento", "adeguamento", "ampliamento", "ripristino", "bonifica", "risanamento", "area",
                       "aree", "valorizzazione", "accessibilita", "messa", "nuovo", "nuova", "ingresso", "percorso",
                       "percorsi", "tramite", "mediante", "attraverso", "rm2", "fondi", "pnrr", "giubileo"}
# Parole che dopo "via", "parco", "villa"... non fanno un nome di luogo
COMUNI = {"telematica", "telematico", "sperimentale", "prioritaria", "provvisoria", "urgenza", "breve", "diretta",
          "informatica", "ordinaria", "straordinaria", "principale", "preliminare", "esclusiva", "transitoria",
          "definitiva", "generale", "residuale", "email", "mail", "pec", "web", "internet", "posta", "cavo", "radio",
          "auto", "autoveicoli", "automezzi", "mezzi", "mezzo", "veicoli", "veicolare", "macchine", "macchinari",
          "giochi", "gioco", "rotabile", "informatico", "tecnologico", "progetti", "comunale", "comunali", "pubblico",
          "pubblici", "pubblica", "pubbliche", "urbano", "urbani", "urbana", "cittadino", "attrezzato", "attrezzati",
          "scolastico", "scolastici", "scolastiche", "pensili", "infanzia", "condivisi", "storico", "storica",
          "storici", "lineare", "agricolo", "naturale", "regionale", "regionali", "nazionale", "giardino", "giardini",
          "parco", "parchi", "villa", "ville", "verde", "verdi", "aree", "area", "zona", "tematico", "tematici",
          "residenziale", "commerciale", "fotovoltaico", "eolico", "solare", "acquatico", "avventura", "lotti",
          "lotto", "esistente", "esistenti", "stesso", "stessa", "vari", "varie", "diversi", "diverse", "suddetto"}


def carica_stradario(path):
    if not path.exists():
        print(f"  ricerca: {path.relative_to(ROOT)} assente, vie riconosciute solo nel testo (parchi, ville, giardini)", file=sys.stderr)
        return None
    vie = json.loads(path.read_text(encoding="utf-8"))["vie"]
    esatti, senza_prep, larghi = {}, {}, {}
    for i, (nome, muns) in enumerate(vie):
        t = norm(nome).split()
        if not t:
            continue
        pre, cont = t[0], [x for x in t[1:] if x not in PREP]
        esatti[" ".join(t)] = i
        k = pre + " " + " ".join(cont)
        senza_prep[k] = i if k not in senza_prep else -1  # -1: ambiguo
        if cont:
            larghi.setdefault((pre, cont[-1]), []).append((i, cont))
    return dict(vie=vie, esatti=esatti, senza_prep=senza_prep, larghi=larghi)


def sottosequenza(a, b):
    it = iter(b)
    return all(x in it for x in a)


SEPARATORI = set(",;:·()[]{}\"“”«»–—/|")
VARIANTI = {"pamphilj": "pamphili"}  # stessa villa scritta in due modi
ABBREV_PUNTO = {"card", "prof", "dott", "mons", "arch", "gen", "avv", "ing", "sant", "beato", "pres"}


def confini(raw, pos, n):
    """Inizi dei token preceduti da punteggiatura forte nel testo originale: un nome non la attraversa."""
    out = set()
    for m in re.finditer(r"[a-z0-9]+", n):
        s = m.start()
        if s == 0:
            continue
        gap = raw[pos[s - 2] + 1:pos[s]] if s >= 2 else ""
        if any(c in SEPARATORI for c in gap) or " - " in gap or gap.strip() == "-":
            out.add(s)
        # fine frase ("A NORD DI VIA PRENESTINA. PRIMO CONTRATTO"), non un'abbreviazione ("S. Maria", "Card. Rossi")
        elif gap.startswith(".") and gap[1:2].isspace():
            prima = n[:s - 1].rsplit(" ", 1)[-1]
            if len(prima) >= 4 and prima not in ABBREV_PUNTO:
                out.add(s)
    return out


def trova_vie(n, S, stop_at=frozenset()):
    """Nomi di vie e luoghi nel testo normalizzato n: [(inizio, fine, chiave, nome, municipi, fonte)].
    fonte 0 = stradario, 1 = solo testo. stop_at: inizi di token dopo punteggiatura forte."""
    toks = [(m.start(), m.end(), m.group()) for m in re.finditer(r"[a-z0-9]+", n)]
    out, i = [], 0
    while i < len(toks):
        pre = toks[i][2]
        if pre not in PREFISSI:
            i += 1; continue
        seg = []
        for j in range(i + 1, min(i + 10, len(toks))):
            w = toks[j][2]
            if w in STOP or any(c.isdigit() for c in w) or toks[j][0] in stop_at:
                break
            seg.append(w)
        trovato = None
        if S:
            for k in range(len(seg), 0, -1):
                c = seg[:k]
                cont = [x for x in c if x not in PREP]
                if not cont or (len(cont) == 1 and (cont[0] in COMUNI or len(cont[0]) < 3)):
                    continue
                # un nome di una sola parola seguito da un'altra parola di nome è probabilmente un
                # nome più lungo che lo stradario non ha ("via Bruno Pontecorvo" non è "Via dei Bruno")
                if len(cont) == 1 and k < len(seg) and seg[k] not in PREP:
                    continue
                idx = S["esatti"].get(" ".join([pre] + c))
                if idx is None:
                    v = S["senza_prep"].get(pre + " " + " ".join(cont))
                    idx = v if v is not None and v >= 0 else None
                if idx is not None:
                    trovato = (k, idx); break
            if trovato is None and seg:
                # forma abbreviata ("viale Togliatti"): solo sul segmento intero, e solo se
                # lo stradario ha una sola via con quel tipo, quell'ultima parola e quelle parole
                cont = [x for x in seg if x not in PREP]
                if cont and not (len(cont) == 1 and (cont[0] in COMUNI or len(cont[0]) < 4)):
                    cand = [e for e in S["larghi"].get((pre, cont[-1]), []) if sottosequenza(cont, e[1])]
                    if len(cand) == 1:
                        trovato = (len(seg), cand[0][0])
        if trovato:
            k, idx = trovato
            nome, muns = S["vie"][idx]
            fine = toks[i + k][1]
            out.append((toks[i][0], fine, norm(nome), nome, muns, 0))
            i += k + 1; continue
        if pre in LIBERI:
            c = []
            for w in seg:
                if w in FERMA_LIBERI or len(c) >= 5:
                    break
                c.append(w)
            while c and c[-1] in PREP:
                c.pop()
            cont = [VARIANTI.get(x, x) for x in c if x not in PREP]
            if cont and not all(x in COMUNI for x in cont) and all(len(x) >= 2 for x in cont) and len("".join(cont)) >= 4:
                fine = toks[i + len(c)][1]
                # chiave senza preposizioni: "Parco Caffarella" e "Parco della Caffarella" sono lo stesso nome
                out.append((toks[i][0], fine, " ".join([pre] + cont), None, [], 1))
                i += len(c) + 1; continue
        i += 1
    return out


def nome_da_testo(raw_espanso, pos, a, b):
    """Il nome come è scritto nel record, con gli accenti; in maiuscolo/minuscolo leggibile."""
    s = raw_espanso[pos[a]:pos[b - 1] + 1].strip(" .,;:-'")
    if s.isupper() or s.islower():
        minus = PREP
        s = " ".join(w if (k and w.lower() in minus) else w[:1].upper() + w[1:] for k, w in enumerate(s.lower().split()))
        s = re.sub(r"'(\w)", lambda m: "'" + m.group(1).upper(), s)
    return re.sub(r"\s+", " ", s)


# ---------------------------------------------------------------- indice
def build_index(data, root=ROOT):
    docs = documenti(data)
    aree = (data.get("quartieri") or {}).get("aree") or []
    S = carica_stradario(root / "data/riferimenti/stradario_roma.json")
    alias = alias_aree(aree)
    alias_rx = re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(a) for a in sorted(alias, key=len, reverse=True)) + r")(?![a-z0-9])") if alias else None

    P, Q, Q_via, V = {}, {}, {}, {}
    for di, d in enumerate(docs):
        sez = SEZIONI[d[0]]
        rec = get(data, path_doc(d))
        if sez["tipo"] == "prog":
            P.setdefault(norm(rec.get("titolo")), []).append(di)
        if not sez.get("luoghi"):
            continue
        raw = espandi(testo(rec, sez["campi"], path_doc(d)))
        n, pos = norm_map(raw)
        muns = d[1] if isinstance(d[1], list) else [d[1]]
        vie = trova_vie(n, S, confini(raw, pos, n))
        for a, b, key, nome, vm, fonte in vie:
            e = V.setdefault(key, {"nome": nome, "mun": vm, "doc": [], "fonte": fonte, "forme": {}})
            if nome is None:
                f = nome_da_testo(raw, pos, a, b); e["forme"][f] = e["forme"].get(f, 0) + 1
            if di not in e["doc"]:
                e["doc"].append(di)
        if not alias_rx:
            continue
        for m in alias_rx.finditer(n):
            a, b, w = m.start(), m.end(), m.group(1)
            # "Municipio Roma IX Eur", "Municipio XIII Aurelio": è il nome del municipio, non l'area
            prima2 = n[:a].split()[-2:]
            if len(prima2) == 2 and prima2[1] in NUMERI_ROMANI and prima2[0] in ("municipio", "roma"):
                continue
            # dentro il nome di una via dello stradario ("Via di Tor Bella Monaca"): la citazione resta,
            # con la nota; un parco o una villa riconosciuti dal testo non contano come via
            dentro_via = any(va <= a and b <= vb and fonte == 0 for va, vb, _k, _n, _m, fonte in vie)
            for ai in alias[w]:
                if w in AMBIGUI and not dentro_via:
                    prima = n[:a].split()[-1:] or [""]
                    stesso = aree[ai]["municipio"] in muns
                    if prima[0] not in QUALIFICATORI and (w in RIGIDI or not stesso):
                        continue
                q = Q.setdefault(ai, {})
                # True finché ogni occorrenza è dentro il nome di una via
                q[di] = q.get(di, True) and dentro_via
    # nomi di parchi e ville presi dal testo: per ogni nome, la forma scritta più frequente (scelta stabile tra un build e l altro)
    Vout = []
    for key, e in sorted(V.items(), key=lambda kv: (-len(kv[1]["doc"]), kv[0])):
        nome = e["nome"] or sorted(e["forme"], key=lambda s: (s.isupper(), -e["forme"][s], len(s), s))[0]  # la forma più usata, a parità la più corta
        Vout.append([nome, e["mun"], e["doc"], e["fonte"]])
    Qout = [[ai, sorted(q), sorted(k for k, v in q.items() if v)] for ai, q in sorted(Q.items())]
    sez_out = []
    for s in SEZIONI:
        snap = s["path"].split("/")[0]
        sez_out.append({k: s[k] for k in ("id", "gruppo", "nome", "tipo", "path", "campi") if k in s}
                       | {k: s[k] for k in ("imp", "titolo", "unita", "dove", "dove_nascosto") if k in s}
                       | ({"snap": snap} if snap != "{0}" else {}))
    doc_out = [[d[0], d[1], d[2]] + ([1] if d[3] else []) for d in docs]
    return {"v": 1, "abbr": ABBR, "sez": sez_out, "doc": doc_out,
            "P": sorted(P.values(), key=lambda l: l[0]), "Q": Qout, "V": Vout}


def statistiche(idx):
    from collections import Counter
    c = Counter(idx["sez"][d[0]]["id"] for d in idx["doc"])
    print("documenti per sezione:", dict(c), "totale", len(idx["doc"]))
    print(f"nomi: progetti {len(idx['P'])}, aree citate {len(idx['Q'])}, vie/piazze/parchi {len(idx['V'])} "
          f"(stradario {sum(1 for v in idx['V'] if v[3] == 0)}, dal testo {sum(1 for v in idx['V'] if v[3] == 1)})")
    size = len(json.dumps(idx, ensure_ascii=False, separators=(",", ":")).encode())
    print(f"indice: {size:,} byte")


if __name__ == "__main__":
    data = {f.stem: json.loads(f.read_text()) for f in sorted((ROOT / "data/snapshot").glob("*.json"))}
    idx = build_index(data)
    statistiche(idx)
    if "-v" in sys.argv:
        for v in idx["V"]:
            print(("S " if v[3] == 0 else "T ") + v[0], len(v[2]))
