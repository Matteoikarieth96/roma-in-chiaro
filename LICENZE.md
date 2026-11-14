# Licenze: codice, dati, logo

Il repository contiene tre cose diverse, con regole diverse.

## 1. Codice: GNU AGPL-3.0 o successiva

Script Python (`scripts/`), sito Next.js (`web/`), modelli e stili del sito: testo completo in `LICENSE`. Chi pubblica il sito con modifiche deve offrire il codice modificato a chi lo visita, per esempio con un link nel piede di pagina (`REPO_URL`).

Fanno eccezione le parti di terzi con la propria licenza, tutte compatibili:

| Parte | Licenza |
| --- | --- |
| Palette, formato dei numeri, impostazione editoriale da DoveVannoINostriSoldi | AGPL-3.0 o successiva |
| Impostazione della mappa da Quartieri di Roma 2026 (Urbe Hub) | MIT |
| Leaflet 1.9.4 (`scripts/vendor/leaflet-1.9.4/`, `web/node_modules/leaflet`) | BSD 2-Clause |

## 2. Dati: restano sotto la licenza della fonte

La licenza AGPL non si applica ai dati. Ogni file sotto `data/` e `web/data/` resta sotto la licenza della sua fonte, scritta anche nel campo `fonte.licenza` dello snapshot.

| File | Fonte | Licenza o base del riuso |
| --- | --- | --- |
| `data/snapshot/appalti_anac.json`, `data/raw/appalti/mappa_centri_di_costo.csv` | ANAC, open data CIG e centri di costo | **CC BY-SA 4.0**. Le tabelle che ne ricaviamo sono opere derivate: chi le riusa cita ANAC e Roma in chiaro e le ridistribuisce con la stessa licenza |
| `data/snapshot/storico.json` | Roma Capitale e ANAC | contiene dati ANAC, quindi il file si distribuisce sotto **CC BY-SA 4.0**; i dati di Roma Capitale al suo interno si riusano anche da soli citando la fonte |
| `data/snapshot/mappa.json`, `web/data/mappa-municipi.json`, `data/raw/municipi-roma.geojson` | © OpenStreetMap contributors | **ODbL 1.0**: database derivati, restano sotto ODbL con attribuzione |
| `data/snapshot/bilancio_peg_2026.json`, `profilo_annuario.json`, `nidi.json`, `progetti.json`, `politica.json` | Roma Capitale | documenti pubblicati da Roma Capitale, riusati citando la fonte e senza alterarne il contenuto (art. 7 D.Lgs. 33/2013 per gli atti soggetti a pubblicazione obbligatoria; art. 52, c. 2, D.Lgs. 82/2005, CAD, per i dati pubblicati senza licenza) |
| `data/snapshot/quartieri.json`, `data/riferimenti/stradario_roma.json`, `web/data/mappa-quartieri.json` | Roma Capitale, geoportale GeoRoma (file preparati da Quartieri di Roma 2026) | dati aperti per l'art. 52, c. 2, del CAD, con citazione della fonte: il geoportale non dichiara una licenza |
| Mappa di base | tile di `tile.openstreetmap.org` | © OpenStreetMap contributors, ODbL 1.0, con la policy d'uso delle tile di OpenStreetMap Foundation |

I nomi degli amministratori in `politica.json` sono dati pubblicati da Roma Capitale per obbligo di trasparenza (art. 14 D.Lgs. 33/2013). Si riusano per la stessa finalità, informare su chi governa i municipi, e non per altri scopi.

Dettaglio file per file e testo della licenza MIT in `THIRD_PARTY.md`.

## 3. Logo di Urbe Hub

`assets/urbe-hub-donor.png` è il logo di Urbe Hub. **Non è coperto dalla licenza AGPL né da altre licenze di questo repository**: è incluso solo perché il sito lo mostra come promotore del progetto. Ai sensi della sezione 7, lettera e), della AGPL-3.0, non si concede alcun diritto sul nome o sul logo di Urbe Hub. Chi pubblica una versione modificata del sito deve togliere il logo e non può presentarla come un progetto di Urbe Hub.
