# Ricerca (`#/cerca`)

Un pulsante con la lente, nell'intestazione di ogni pagina, apre la pagina `#/cerca`. Si scrive un nome e la pagina elenca **tutti i punti dei dati del sito in cui quel nome è citato**, raggruppati per sezione. Il tasto `/` porta il cursore nella casella. Ogni ricerca ha un indirizzo che si può condividere, per esempio `#/cerca?q=Villa%20Borghese` oppure `#/cerca?q=Ostia&c=quartieri`.

## Le tre categorie

| Categoria | Cosa contiene | Da dove vengono i nomi |
| --- | --- | --- |
| Progetti | i titoli dei progetti PNRR, Giubileo e altri fondi (385 titoli; lo stesso titolo in più schede conta una volta) | `data/snapshot/progetti.json` |
| Quartieri | le 457 aree ufficiali di Roma: 334 quartieri, 22 rioni, 101 zone funzionali, ognuna con il suo municipio | Geoportale di Roma Capitale, strato DIPCUL:vst_nuove_localita, aree della deliberazione A.C. n. 150/2026 (`data/snapshot/quartieri.json`) |
| Vie, piazze e parchi | i nomi di via, viale, piazza, piazzale, largo, lungotevere, circonvallazione, corso, vicolo, ponte, parco, villa, giardino trovati nel testo dei dati (263 nomi) | riconosciuti sullo stradario ufficiale di Roma Capitale (strato DIPPC:stradario_municipio, 14.908 vie, `data/riferimenti/stradario_roma.json`); parchi, ville e giardini che lo stradario non ha sono presi dal testo |

**Perché la terza categoria è "Vie, piazze e parchi".** Nei progetti e negli appalti il luogo è scritto quasi sempre come indirizzo ("Via dell'Archeologia", "Viale del Giardino Zoologico", "Parco di Centocelle"), molto più spesso che come nome di quartiere. Senza questa categoria la ricerca perderebbe la maggior parte dei luoghi citati. Lo stradario ufficiale permette di riconoscere i nomi veri e di dire quali municipi la via attraversa.

## Cosa mostra ogni risultato

Per ogni nome trovato: il numero di citazioni e, per ogni citazione, la sezione del sito, il municipio, il testo con il nome evidenziato, l'importo o i posti, il CIG o il CUP con la data, la fonte e il periodo della sezione, il link alla pagina del sito dove la riga compare e, quando la riga non è mostrata in nessuna pagina, una nota che lo dice. I quartieri mostrano anche tipo, municipio e fonte del nome, pure se non hanno citazioni.

Sotto "Tutte" c'è anche **"Altre citazioni nel testo"**: righe che contengono la frase cercata ma non sono legate a uno dei nomi trovati (per esempio "Ostia Nord" dentro un elenco di luoghi, o una voce di bilancio). Qui la ricerca guarda anche bilancio, organi politici e descrizioni delle fonti.

Il confronto ignora maiuscole e accenti e accetta parole parziali ("tibur" trova Via Tiburtina). Per i quartieri la parola iniziale rione, quartiere, zona o località non conta ("rione Monti" trova Monti). Le abbreviazioni P.zza, P.le, V.le, L.go, L.tevere, Lgt, Circ.ne, C.so, V.lo sono sciolte prima del confronto, sia nell'indice sia nella pagina, con la stessa lista. Se non c'è nessun risultato, la pagina propone i nomi di quartieri, vie e parchi scritti in modo simile (distanza di modifica fino a 1, 2 o 3 lettere secondo la lunghezza).

Sulla pagina ci sono tre note:

- la ricerca copre solo i dati di questo sito;
- un luogo citato non vuol dire che il progetto o l'appalto si trovi lì;
- i nomi dei quartieri vengono dalla fonte indicata, con il link.

## Campi coperti

L'inventario è in `scripts/build_search.py` (`SEZIONI`). "Luoghi" dice se nei campi si cercano anche i nomi di quartieri e vie; tutti i campi elencati entrano comunque nelle "Altre citazioni".

| Sezione | Record | Campi di testo | Importo | Luoghi | Dove compare sul sito |
| --- | --- | --- | --- | --- | --- |
| Progetti nella scheda del municipio | `progetti.municipi[N].progetti[]` (238) | titolo, luogo, attuatore, municipio_evidenza | importo_programma_euro | sì | tabella "Progetti sul territorio" della scheda |
| Progetti su più municipi o su tutta la città | `progetti.cittadino.{piu_municipi, intermunicipale, senza_municipio}.progetti[]` (148) | titolo, luogo, attuatore, municipio_evidenza | importo_programma_euro | sì | solo nel totale della pagina iniziale |
| I 10 CIG più grandi del municipio | `appalti_anac.municipi[N].{2025,2026}.top10_cig_per_importo[]` (300) | oggetto, centro_di_costo | importo | sì | tabella della scheda (solo 2025; il 2026 è segnato come non mostrato) |
| I 10 CIG più grandi di Roma Capitale | `appalti_anac.roma.{2025,2026}.top10_cig_per_importo[]` (20) | oggetto, centro_di_costo | importo | sì | non mostrato in una pagina |
| Categorie CPV | `appalti_anac.municipi[N].{anno}.top5_cpv_divisioni_per_importo[]` (150) | etichetta | importo | no | pannello "Cosa si compra" (solo 2025) |
| Centri di costo ANAC | `appalti_anac.municipi[N].centri_di_costo[]` (25) | denominazione, motivo | | sì | non mostrato in una pagina |
| Presidente, giunta, consiglio | `politica.municipi[N]` (465) | presidente, deleghe, nome, ruolo, gruppo, gruppo_da_simbolo | | no | scheda del municipio |
| Bilancio PEG 2026: programmi, missioni, macroaggregati, entrate | `bilancio_peg_2026.municipi[N].spese.*[]`, `.entrate.per_titolo[]` (756) | nome, codice | competenza_2026 | no | scheda (le voci oltre le prime 12, 10 e 8 e le entrate sono segnate come non mostrate) |
| Nidi, posti per tipo di gestione | `nidi.municipi[N].posti_per_tipologia` (60) | il nome del tipo | posti | no | pannello della scheda |
| Indicatori dell'Annuario | `profilo_annuario.indicatori` (22) | etichetta, misura, non_misura, tabella, periodo | | sì | Fonti e metodo |
| Descrizione degli insiemi di dati | ogni snapshot con `fonte` tranne `mappa` (7) | titolo, misura, non_misura, periodo | | sì | Fonti e metodo |

Totale: 2.191 record. Organi politici e bilancio sono esclusi dal riconoscimento dei luoghi perché contengono cognomi e nomi di partito che coincidono con nomi di quartieri ("Monti", "Prati", "Fratelli d'Italia").

**Campi lasciati fuori:** etichette della procedura di scelta del contraente e tipi ANAC (non sono nomi); ripartizioni del bilancio di Roma nel suo insieme; `politica.*.consiglio.note`; `progetti.*.cup_in_piu_schede` (ripete record già indicizzati); `stato_dettaglio`, `tematica` e `programma` dei progetti (categorie, non nomi); i nidi non hanno i nomi delle singole strutture.

## Come è fatto l'indice

- `scripts/etl_quartieri.py` scrive `data/snapshot/quartieri.json` (aree e municipio, con `fonte`) e `data/riferimenti/stradario_roma.json` (nomi delle vie e municipi attraversati, usato solo al build). Parte dai file del progetto quartieri-roma-2026 di Urbe Hub, scaricati dal geoportale il 30/10/2026 e corretti negli accenti.
- `scripts/build_search.py` legge gli snapshot e costruisce l'indice. L'indice non copia i testi: ogni record è un puntatore (sezione, municipio, posizione nello snapshot), e la pagina legge testo, importo e periodo dagli stessi dati già incorporati per le altre pagine. Per ogni nome l'indice tiene la lista dei record che lo citano.
- `scripts/build.py` incorpora l'indice in `<script id="search-index" type="application/json">`, aggiunge `scripts/search.css` in fondo allo stile e `scripts/search.js` dopo `sections.js`. **Il template non cambia**: `search.js` aggiunge il pulsante accanto a quello del tema e avvolge `route()`. Nessuna libreria esterna e nessun CDN.

Regole del riconoscimento:

- **Vie:** si cerca il nome completo nello stradario, poi lo stesso nome senza preposizioni, poi una forma abbreviata ("viale Togliatti") solo se lo stradario ha una sola via con quel tipo e quell'ultima parola. Un nome non attraversa la punteggiatura forte né la fine di una frase. Una sola parola seguita da un'altra parola di nome viene scartata ("via Bruno Pontecorvo" non è "Via dei Bruno").
- **Parchi, ville e giardini fuori dallo stradario:** presi dal testo, fino a 5 parole, con una lista di parole che li interrompono. "Parco della Caffarella" e "Parco Caffarella" sono lo stesso nome; Pamphilj e Pamphili pure.
- **Quartieri:** si cerca il nome intero e, nei nomi doppi ("Lamaro - Cinecittà"), ciascuna parte. I nomi di una parola che sono anche parole comuni o cognomi ("Monti", "Prati", "Ponte", "Eur") valgono solo se preceduti da rione, quartiere, zona, località, borgata o frazione oppure, per alcuni, se il record è dello stesso municipio dell'area. Il nome di un municipio ("Municipio IX Eur") non conta. Se il nome compare solo dentro il nome di una via ("Via di Tor Bella Monaca"), la citazione resta con una nota che lo dice.

## Peso della pagina

| | Byte |
| --- | --- |
| `site/index.html` prima | 995.455 |
| `site/index.html` dopo | 1.125.991 (+130.536, +13%) |
| di cui indice della ricerca | 65.261 |
| di cui `quartieri.json` dentro i dati | 37.893 |
| di cui `search.js` e `search.css` | 27.308 |

Lo stradario (441 KB) resta fuori dalla pagina: serve solo al build. Con la nuova veste grafica (branding.patch) la pagina passa da 1.010.204 a 1.140.740 byte, lo stesso aumento.

## Prove (build del 14/11/2026)

Conteggi della pagina con la categoria "Tutte". "Nomi" sono i nomi trovati nelle tre categorie, "citazioni" i record distinti che li citano.

| Ricerca | Progetti | Quartieri | Vie, piazze e parchi | Citazioni distinte | Altre citazioni nel testo |
| --- | --- | --- | --- | --- | --- |
| Tor Bella Monaca | 1 | 1 | 0 | 1 | 0 |
| Ostia | 2 | 6 (Ostia Antica con 1 citazione, gli altri 5 con 0) | 1 | 2 | 1 ("Ostia Nord" in un elenco di luoghi) |
| Corviale | 2 | 1 | 0 | 2 | 0 |
| San Lorenzo | 0 | 2 (San Lorenzo, Scalo San Lorenzo, 0 citazioni) | 0 | 0 | 0 |
| Villa Borghese | 13 | 1 | 1 | 13 | 0 |
| Via Tiburtina | 0 | 0 | 1 | 1 | 0 |
| Prenestina | 0 | 0 | 1 (Via Prenestina) | 2 | 0 |
| Parco degli Acquedotti | 0 | 1 (0 citazioni) | 0 | 0 | 0 |
| Zzyxqv (deve dare zero) | 0 | 0 | 0 | 0 | 0: "Nessun risultato", nessun suggerimento |
| Tor Bela Monaca (errore di battitura) | 0 | 0 | 0 | 0 | 0: suggerisce "Tor Bella Monaca" |

Pochi numeri non vogliono dire che la ricerca perda dei record: il sito contiene solo i 10 CIG più grandi per municipio e anno e i progetti con fondi straordinari. Tor Bella Monaca, per esempio, è citata in un solo progetto ("comparto R5 a Tor Bella Monaca").

**Controllo a campione contro i JSON** (tutti corrispondono):

1. Tor Bella Monaca: progetto CUP J84E21001160005, Municipio VI, 15.000.000 €, attuazione dal 1/10/2021 al 31/3/2026.
2. Via Prenestina: CIG B7F3C31DD7, Municipio VI, 675.447,80 € (mostrato arrotondato all'euro come nel resto del sito), pubblicato l'11/8/2025.
3. Corviale: "Piani Urbani Integrati Corviale", CUP J84D22000070001, Municipio XI, 50.043.779 €.
4. Villa Borghese: "Casino del Graziano", CUP J89D22001290006, Municipio II, 797.000 €.
5. Via Tiburtina: area archeologica di Settecamini, CUP J89D22001150006, Municipio IV, 1.755.000 €, luogo "Via Tiburtina Km 1,400 ...".

**Pagina:** il pulsante c'è su `#/`, `#/municipio/6`, `#/confronto`, `#/fonti` e `#/cerca`; `/` porta il cursore nella casella da ogni pagina; `#/cerca?q=...` riempie la casella e mostra i risultati; a 375 px nessuno scorrimento orizzontale (`scrollWidth` 375); tema chiaro e scuro; nessun errore in console. Le stesse prove passano con la nuova veste grafica (branding.patch), dove il pulsante prende il cerchio da 34 px del pulsante del tema e c'è anche su `#/tutti`. Schermate in `screenshots/` (`con-branding-*` per la nuova veste).

## Applicare la patch

La patch non tocca `scripts/template.html` né `scripts/sections.js`, quindi si applica sia sul modello di prima sia su quello con branding.patch, in qualunque ordine.

```bash
cd municipi-roma-soldi   # dalla cartella che contiene il progetto
patch -p1 --dry-run < ../municipi-roma-soldi-ricerca/ricerca.patch
patch -p1 < ../municipi-roma-soldi-ricerca/ricerca.patch
.venv/bin/python -I scripts/build.py
```

## Limiti noti

- La ricerca vede solo ciò che il sito contiene: i 10 CIG più grandi per municipio e anno (non tutti gli appalti), i progetti con fondi straordinari, il bilancio per voce. Un luogo senza citazioni può avere comunque progetti o appalti.
- Essere citati non vuol dire trovarsi lì: un nome può indicare un confine, un tratto di strada, una sede o un esempio.
- I nomi dei quartieri sono quelli della deliberazione n. 150/2026. Toponimi diffusi ma non ufficiali (per esempio "Ostia Lido") non sono quartieri: si trovano nei titoli dei progetti o tra le "Altre citazioni".
- I nomi di una parola ambigui (vedi sopra) possono essere persi quando il testo non li qualifica.
- Le citazioni dei progetti su più municipi e dei CIG di Roma Capitale non sono elencate in nessuna pagina del sito: la ricerca le mostra con una nota.
- Le varianti di grafia unite sono solo quelle note (Pamphilj e Pamphili). Altri nomi scritti in due modi restano due nomi.
- Le abbreviazioni sciolte sono solo quelle della lista; forme rare ("V." per via) non sono riconosciute.
- I dati del geoportale non hanno una licenza dichiarata per questi due strati: si usano come dati aperti ai sensi dell'art. 52, c. 2, del CAD, con la fonte (vedi `THIRD_PARTY.md`).

## Rigenerare

```bash
.venv/bin/python -I scripts/etl_quartieri.py ../quartieri-roma-2026/data   # solo se cambiano aree o stradario
.venv/bin/python -I scripts/build_search.py -v                             # statistiche dell'indice, senza scrivere
.venv/bin/python -I scripts/build.py                                       # sito con la ricerca
```
