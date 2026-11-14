# Roma in chiaro

> **In English.** Roma in chiaro (romainchiaro.it) shows where the money of Rome's 15 *municipi* (city districts) goes: budget allocations, public tenders, PNRR and Jubilee projects, nurseries, who governs and a statistical profile. Every figure comes from an official source and carries its period, the date it was read and what it does not measure. Python scripts turn the sources into JSON snapshots; a static site (Next.js in `web/`, plus a legacy single-file build) reads them. Code is AGPL-3.0; data keeps the licence of its source (see `LICENZE.md`). The project is in **beta**: report data errors with a link to the official source. Documentation is in Italian.

Dove vanno i soldi dei 15 Municipi di Roma Capitale: bilancio, appalti, progetti PNRR e Giubileo, asili nido, chi governa, residenti, redditi e imprese. Ogni numero porta la fonte ufficiale, il periodo e cosa non misura.

**Stato: beta.** I dati sono ancora in revisione, in particolare gli importi dei progetti PNRR, Giubileo e fondi UE. Prima di citare un numero, controllalo sulla fonte indicata sotto il blocco. Un progetto di Urbe Hub.

## Cosa misura il sito

| Sezione | Fonte | Periodo |
| --- | --- | --- |
| Bilancio: stanziamenti di spesa ed entrate per titolo, missione, programma | Roma Capitale, PEG 2026-2028, Allegato A (DGC 110/2026) | competenza e cassa 2026, competenza 2027 e 2028 |
| Appalti avviati: CIG, importi a base di gara, procedure, categorie CPV | ANAC, open data CIG 2025 e aggiornamenti delta 2026 | 2025; 2026 fino al 30/9 |
| Serie storiche: residenti, stanziamenti PEG, importi ANAC | Roma Capitale (Anagrafe, Annuario, PEG) e ANAC | residenti dal 2016; PEG 2023-2026; ANAC 2016-2025, numero di CIG solo 2024 e 2025 |
| Progetti sul territorio: PNRR, Giubileo 2025, PN Metro, fondi UE | Roma Capitale, pagine "Progetti PNRR e altri fondi straordinari" | elenco letto il 13/11/2026 |
| Asili nido: posti, iscritti, domande, liste d'attesa | Roma Capitale, Dashboard Nidi 2025 | anno educativo 2024-2025, serie dal 2011 |
| Chi governa: presidente, giunta, consiglio | Roma Capitale, Organi politici dei Municipi | pagine al 13/11/2026 |
| Profilo: residenti, superficie, età, stranieri, redditi IRPEF, imprese, servizi | Roma Capitale, Annuario statistico 2025 | 31/12/2025, 2024, anno d'imposta 2023 |
| Confini dei municipi | OpenStreetMap (admin_level=9) | 2026 |
| Quartieri, rioni e zone (mappa e ricerca) | Roma Capitale, geoportale GeoRoma, aree della deliberazione A.C. n. 150/2026 | 2026 |

Ogni snapshot in `data/snapshot/` ha la stessa forma: `fonte` (nome, ente, link, licenza), `periodo`, `verificato` (data in cui la fonte è stata letta), `misura`, `non_misura` e i valori per municipio (`"1"` ... `"15"`), con il totale di Roma dove la fonte lo stampa.

## Cosa non misura

- **Pagamenti per municipio.** SIOPE tratta Roma Capitale come un solo ente e non indica la struttura che paga. Il sito mostra stanziamenti e appalti, non pagamenti.
- **Spesa dei dipartimenti centrali in un municipio.** Strade principali, trasporti e rifiuti sono gestiti da Roma Capitale e non vengono attribuiti a nessun municipio. I progetti con fondi straordinari sono mostrati dove si trovano, ma li gestiscono per lo più i dipartimenti: non sono spesa del municipio.
- **Le imprese aggiudicatarie.** Il dataset dei CIG non le contiene.
- **L'importo aggiudicato o pagato di un appalto.** L'importo ANAC è quello a base di gara.

Stanziamenti, importi di gara e costi dei progetti misurano cose diverse e non si sommano. Un dato mancante resta "non disponibile": non diventa zero e non viene stimato. Un valore insolito è un segnale da approfondire, non la prova di uno spreco o di un illecito.

## Come si ricostruisce

Servono Python 3.12 o più recente e Node.js 24.

```bash
./aggiorna.sh sito    # solo il sito statico, dagli snapshot già presenti (nessun download)
./aggiorna.sh cache   # rifà gli snapshot dai file in data/raw/, scarica solo quelli che mancano
./aggiorna.sh         # tutto: riscarica ogni fonte (circa 1 GB, soprattutto ANAC), poi snapshot e sito
```

`aggiorna.sh` crea il `.venv` alla prima esecuzione. I file scaricati finiscono in `data/raw/`, che non è nel repository: per rifare gli snapshot da zero serve la versione completa. Ogni script ETL stampa i propri controlli (somme contro i totali della fonte, conteggi contro i contatori delle pagine, municipi contro il totale di Roma) e si ferma se un controllo fallisce.

Il sito Next.js in `web/` legge gli snapshot al momento della build e richiede il `.venv` del progetto (l'indice della ricerca lo costruisce `scripts/build_search.py`):

```bash
cd web
npm ci                # una volta sola
npm run dev           # anteprima su http://localhost:8823
npm run build         # export statico in web/out/
npm run serve         # serve web/out/ su http://127.0.0.1:8824
```

Il vecchio sito in un solo file (`site/index.html`, scritto da `scripts/build.py`) si apre con `python3 -m http.server -d site 8000` e poi http://localhost:8000. Dettagli tecnici (struttura degli script, sito Next.js, codice condiviso tra i due siti): `docs/TECNICO.md`; la ricerca: `RICERCA.md`.

Controlli che si fanno senza rete, gli stessi della CI:

```bash
.venv/bin/python -I scripts/controlla_snapshot.py
```

## Segnalare un errore nei dati

Un numero sbagliato su questo sito può essere usato nel dibattito pubblico, quindi ogni segnalazione conta.

- Apri una [segnalazione di errore nei dati](../../issues/new/choose) con il link alla fonte ufficiale, oppure
- scrivi all'indirizzo indicato nella sezione Contatti del sito.

Una correzione richiede sempre una fonte ufficiale: vedi `CONTRIBUTING.md`. Per problemi di sicurezza: `SECURITY.md`.

## Licenze

- **Codice**: GNU AGPL-3.0 o successiva (`LICENSE`). Chi pubblica una versione modificata del sito deve rendere disponibile il codice modificato.
- **Dati**: ogni snapshot resta sotto la licenza della sua fonte. I dati ricavati da ANAC sono CC BY-SA 4.0, i confini da OpenStreetMap ODbL 1.0, i dati di Roma Capitale si riusano citando la fonte. Riepilogo in `LICENZE.md`, dettaglio file per file in `THIRD_PARTY.md`.
- **Logo di Urbe Hub** (`assets/`): non è coperto dalla licenza del codice. Vedi `LICENZE.md`.

## Crediti

- **Urbe Hub**, che promuove il progetto.
- **[DoveVannoINostriSoldi](https://github.com/Italian-Builders-Org/DoveVannoINostriSoldi)** (AGPL-3.0): da lì vengono la palette, le regole di formato dei numeri e l'impostazione editoriale. Questo progetto non è affiliato a DoveVannoINostriSoldi e non ne usa nome né logo.
- **[Quartieri di Roma 2026](https://github.com/urbe-hub/quartieri-roma-2026)** di Urbe Hub (MIT): impostazione della mappa e file dei confini delle aree.
- **[Leaflet](https://leafletjs.com/)** (BSD 2-Clause) e **© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors** per la mappa.

Sito indipendente: non è un sito di Roma Capitale e non usa stemmi, loghi o marchi di Roma Capitale.
