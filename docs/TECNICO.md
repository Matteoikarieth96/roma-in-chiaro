# Roma in chiaro

Dove vanno i soldi dei 15 Municipi di Roma Capitale: bilancio, appalti, progetti PNRR e Giubileo, asili nido, chi governa, redditi e imprese. Ogni numero porta la fonte ufficiale, il periodo e cosa non misura.

Il progetto applica ai municipi di Roma l'impostazione di [DoveVannoINostriSoldi](https://github.com/Italian-Builders-Org/DoveVannoINostriSoldi), che fa lo stesso lavoro per lo Stato e i Comuni italiani. Il suo codice non contiene dati per municipio, quindi qui i dati vengono raccolti da zero. Lo stile e le regole editoriali sono ripresi da lì, sotto la stessa licenza AGPL-3.0. Questo sito non è affiliato a quel progetto.

## Cosa c'è

| Sezione | Fonte | Periodo | Per municipio |
| --- | --- | --- | --- |
| Bilancio: stanziamenti di spesa e entrate, per titolo, missione, programma | Roma Capitale, PEG 2026-2028, Allegato A (DGC 110/2026) | competenza e cassa 2026, competenza 2027-2028 | centri di responsabilità TA-TQ |
| Appalti avviati: CIG, importi, procedure, categorie CPV, 10 CIG più grandi | ANAC, open data CIG 2025 e aggiornamenti delta 2026 | 2025; 2026 fino al 30/9 | centro di costo "MUNICIPIO …" di Roma Capitale |
| Progetti sul territorio: PNRR, Giubileo 2025, PN Metro, fondi UE | Roma Capitale, pagine "Progetti PNRR e altri fondi straordinari" | elenco letto il 13/11/2026 | campo Municipio della scheda o, se manca, municipio indicato nel testo; per luogo, non per chi spende |
| Asili nido: posti, iscritti, domande, liste d'attesa, serie dal 2011 | Roma Capitale, Dashboard Nidi 2025 | anno educativo 2024-2025 | sì |
| Chi governa: presidente, giunta, consiglio | Roma Capitale, Organi politici dei Municipi | pagine al 13/11/2026 | sì |
| Profilo: residenti, superficie, età, stranieri, redditi IRPEF, addizionale, imprese, servizi | Roma Capitale, Annuario statistico 2025 | 31/12/2025, 2024, anno d'imposta 2023 | sì |
| Confini dei municipi | OpenStreetMap (admin_level=9) | 2026 | sì |
| Fondi straordinari (`#/pnrr`, `#/giubileo-2025`): KPI, ciambella per luogo, colonne per municipio in totale e per abitante, stato dei progetti, calendario per trimestre, 15 progetti più grandi, tabella completa | Roma Capitale, pagine "Progetti PNRR e altri fondi straordinari"; residenti dall'Annuario 2025 | elenco letto il 13/11/2026; calendario solo dal campo Periodo delle schede | come la riga dei progetti |
| Ricerca (`#/cerca`): progetti, quartieri, vie, piazze e parchi citati nei dati | indice costruito dagli snapshot; nomi delle aree e stradario dal geoportale di Roma Capitale | aree della deliberazione n. 150/2026 | vedi `RICERCA.md` |

**Cosa manca e perché**

- **Pagamenti per municipio.** SIOPE tratta Roma Capitale come un solo ente, e i file trimestrali dei pagamenti non indicano la struttura. Per questo il sito mostra stanziamenti e appalti, non pagamenti.
- **Spesa dei dipartimenti centrali sul territorio di un municipio.** Strade principali, trasporti e rifiuti, per esempio, sono gestiti centralmente e non vengono attribuiti a nessun municipio. Fanno eccezione i progetti con fondi straordinari (PNRR, Giubileo, fondi UE): sono mostrati nel municipio dove si trovano, ma li gestiscono per lo più i dipartimenti di Roma Capitale. Non sono spesa del municipio.
- **Le imprese aggiudicatarie.** Il dataset dei CIG non le contiene; ANAC le pubblica in un altro insieme di dati, non ancora collegato.

## Come funziona

```
scripts/etl_*.py    scaricano una fonte in data/raw/, la leggono e scrivono data/snapshot/<nome>.json
scripts/build_map.py   proietta i confini dei municipi in percorsi SVG
scripts/build.py       inserisce gli snapshot in scripts/template.html (+ sections.js e da-web.js) e scrive site/index.html
scripts/etl_quartieri.py  scrive quartieri.json e lo stradario (data/riferimenti/) per la ricerca
scripts/build_search.py   costruisce l'indice della ricerca; build.py lo incorpora con search.js e search.css (RICERCA.md)
```

Il sito è una sola pagina statica (`site/index.html`), con i dati incorporati: niente database e niente server. L'unica libreria è Leaflet 1.9.4 (`scripts/vendor/`, BSD 2-Clause), incorporata nel file per la mappa della pagina iniziale; le sole richieste esterne sono le tile di OpenStreetMap di quella mappa. Le sezioni stanno nel menu a sinistra (gruppo "Fondi straordinari" per PNRR e Giubileo 2025); sotto i 960 px il menu diventa un pannello che si apre dal pulsante in alto. Ogni script stampa i propri controlli e si ferma se un totale non torna. I controlli sono: somme contro i totali stampati nella fonte, conteggi contro i contatori delle pagine, municipi contro il totale di Roma.

```bash
./aggiorna.sh         # tutto: riscarica ogni fonte (RIFRESCA=1) e ricostruisce snapshot e sito (ANAC pesa circa 1 GB)
./aggiorna.sh cache   # rifà gli snapshot dai file già scaricati in data/raw/, senza scaricare, poi il sito
./aggiorna.sh sito    # solo il sito, dagli snapshot esistenti
python3 -m http.server -d site 8000   # anteprima su http://localhost:8000
```

Ogni snapshot ha la stessa forma: `fonte` (nome, ente, url o `link`, licenza), `periodo`, `verificato`, `misura`, `non_misura`, `municipi` ("1"…"15") e, dove la fonte lo stampa, il totale di Roma. `verificato` è la data in cui sono stati scaricati i file della fonte.

Il codice sorgente pubblico va indicato in `REPO_URL`, in cima allo script di `scripts/template.html`: finché è vuoto, il piede di pagina scrive "Codice sorgente: in pubblicazione".

### Versione Next.js (`web/`)

In `web/` c'è lo stesso sito in Next.js (App Router, TypeScript, export statico), con una pagina vera per ogni sezione: `/`, `/municipio/1/` … `/municipio/15/`, `/tutti/`, `/confronto/?a=1&b=2`, `/fonti/`, `/cerca/?q=`, `/pnrr/` e `/giubileo-2025/` (codice in `web/lib/fondi.ts`). Menu, testata e grafici sono gli stessi del sito statico. I vecchi indirizzi con `#/` portano alla pagina nuova corrispondente.

Legge gli snapshot da `data/snapshot/` al momento della build: non li copia e non li modifica, gli ETL Python restano l'unica fonte dei dati. Serve il `.venv` del progetto, perché l'indice della ricerca lo costruisce `scripts/build_search.py`.

```bash
cd web && npm install     # una volta sola
npm run dev               # anteprima su http://localhost:8823
npm run build             # export statico in web/out/
npm run serve             # serve web/out/ su http://127.0.0.1:8824
node scripts/compare-text.mjs --shots   # dopo la build e ./aggiorna.sh sito: confronta testi, menu e titoli di ogni pagina con site/index.html e salva le schermate in web/screenshots/ (statico-*.png per il sito statico)
```

Per pubblicare in una sottocartella imposta `NEXT_PUBLIC_BASE_PATH` (per esempio `/municipi`) prima di `npm run build`. Il codice delle pagine è in `web/lib/` (`engine.ts` riprende `template.html` e `sections.js`, `search.ts` riprende `search.js`; lo stile `app/globals.css` è lo stesso di `template.html`): finché esistono tutti e due i siti, un testo o un'etichetta si cambia in entrambi, e `compare-text.mjs` segnala ogni differenza.

Una parte del codice non va copiata a mano: PNRR e Giubileo 2025 (`fondi.ts`), i grafici della scheda municipio (`grafici.ts`, `municipio-grafici.ts`), Confronta (`confronto.ts`) e la mappa con i quartieri (`mappa.ts`, `mappa-leaflet.ts`). Dopo ogni modifica a questi file `cd web && npm run porta` li trasforma in `scripts/da-web.js` (tipi tolti, indirizzi con `#/`), poi `./aggiorna.sh sito` li mette nel sito statico con i loro stili, Leaflet e i due file della mappa (`web/data/mappa-*.json`). `REPO_URL` va impostato anche in `web/lib/engine.ts`.

## Regole

- Nessun numero senza fonte e periodo. Un dato mancante resta "non disponibile", non diventa zero e non viene stimato.
- Stanziamenti, importi di gara e costi dei progetti restano separati: misurano cose diverse e non si sommano.
- I valori per abitante usano i residenti al 31/12/2025.
- Un valore insolito è un segnale da approfondire, non la prova di uno spreco o di un illecito.

## Licenze

- Codice: GNU AGPL-3.0 (vedi `LICENSE`), Copyright 2026 contributori di Roma in chiaro, senza alcuna garanzia. Se pubblichi il sito, anche il codice modificato deve essere pubblico: il piede di pagina deve linkarlo (`REPO_URL`).
- Dati ANAC e tabelle che ne ricaviamo (`appalti_anac.json`): CC BY-SA 4.0. Aggreghiamo e rielaboriamo i dati per municipio e rilasciamo il risultato con la stessa licenza.
- Confini (`mappa.json`): database derivato da OpenStreetMap, sotto ODbL 1.0 con attribuzione.
- Documenti di Roma Capitale e snapshot che ne ricaviamo: documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005).
- Dettaglio file per file in `THIRD_PARTY.md`.
