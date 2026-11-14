# Materiali di terzi

| Materiale | Dove si usa | Titolare | Licenza |
| --- | --- | --- | --- |
| Palette, regole di formato dei numeri, impostazione editoriale | `scripts/template.html` | DoveVannoINostriSoldi contributors | GNU AGPL-3.0 |
| Confini dei municipi | `data/raw/municipi-roma.geojson`, `data/snapshot/mappa.json` | © OpenStreetMap contributors | ODbL 1.0 |
| CIG e centri di costo | `data/snapshot/appalti_anac.json` | ANAC | CC BY-SA 4.0 |
| PEG 2026-2028, Annuario statistico 2025, Dashboard Nidi 2025, pagine progetti, organi politici dei municipi | `data/snapshot/*.json` (vedi sotto) | Roma Capitale | Documento pubblicato da Roma Capitale. Riuso con citazione della fonte ai sensi dell'art. 7 del D.Lgs. 33/2013 e dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005). |
| Quartieri, rioni e zone funzionali (deliberazione A.C. n. 150/2026) e stradario | `data/snapshot/quartieri.json`, `data/riferimenti/stradario_roma.json` (usato solo dalla ricerca al build) | Roma Capitale, geoportale GeoRoma (`geoportale.comune.roma.it`), strati DIPCUL:vst_nuove_localita e DIPPC:stradario_municipio; file scaricati e corretti negli accenti dal progetto quartieri-roma-2026 di Urbe Hub (codice MIT) | Dati aperti ai sensi dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005), con fonte Roma Capitale. Il geoportale non dichiara una licenza per questi due strati: si indica la fonte |
| Font Geist | caricato da Google Fonts | Vercel | SIL Open Font License 1.1 |

## Licenza degli snapshot derivati

Gli snapshot in `data/snapshot/` sono ricavati dalle fonti qui sopra. Ognuno resta sotto la licenza della sua fonte.

| File | Ricavato da | Licenza |
| --- | --- | --- |
| `appalti_anac.json` | ANAC, open data CIG e centri di costo, aggregati e rielaborati per municipio | CC BY-SA 4.0, come la fonte. Citare ANAC e Roma in chiaro. |
| `mappa.json` | OpenStreetMap, confini admin_level=9, proiettati in percorsi SVG | ODbL 1.0: è un database derivato. © OpenStreetMap contributors. |
| `bilancio_peg_2026.json` | Roma Capitale, PEG 2026-2028, Allegato A | Riuso con citazione della fonte (art. 7 D.Lgs. 33/2013, art. 52, c. 2, CAD) |
| `profilo_annuario.json` | Roma Capitale, Annuario statistico 2025 | Riuso con citazione della fonte (art. 7 D.Lgs. 33/2013, art. 52, c. 2, CAD) |
| `nidi.json` | Roma Capitale, Dashboard Nidi 2025 | Riuso con citazione della fonte (art. 7 D.Lgs. 33/2013, art. 52, c. 2, CAD) |
| `progetti.json` | Roma Capitale, pagine "Progetti PNRR e altri fondi straordinari" | Riuso con citazione della fonte (art. 7 D.Lgs. 33/2013, art. 52, c. 2, CAD) |
| `politica.json` | Roma Capitale, "Organi politici dei Municipi" | Riuso con citazione della fonte (art. 7 D.Lgs. 33/2013, art. 52, c. 2, CAD) |
| `quartieri.json` | Roma Capitale, geoportale GeoRoma, aree della deliberazione A.C. n. 150/2026 (nome, tipo, codice, municipio) | Dati aperti, art. 52, c. 2, CAD, con fonte Roma Capitale |

`site/index.html` incorpora tutti questi snapshot: chi lo ripubblica mantiene le attribuzioni scritte nel piede di pagina e nella pagina "Fonti e metodo".

## Mappa della pagina iniziale (sito Next.js `web/` e sito statico `site/index.html`)

Mappa adattata da Quartieri di Roma (Urbe Hub): sito [romaquartieri.it](https://romaquartieri.it/), codice su [github.com/urbe-hub/quartieri-roma-2026](https://github.com/urbe-hub/quartieri-roma-2026) (licenza MIT). Da quel progetto riprendiamo l'impostazione della mappa (Leaflet, mappa di base di OpenStreetMap, confini delle aree della deliberazione n. 150/2026 dentro i municipi, nome dell'area al passaggio del mouse o con un tocco) e il file dei confini delle aree. Il codice di `web/lib/mappa-leaflet.ts` è scritto per questo sito; i colori dei municipi vengono dagli indicatori del sito.

| Materiale | Dove si usa | Titolare | Licenza |
| --- | --- | --- | --- |
| Impostazione della mappa e scelte di stile (Leaflet, tile OpenStreetMap, confini delle aree, nomi al passaggio) | `web/lib/mappa-leaflet.ts`, `web/lib/mappa.ts`, `web/components/Mappa.css` | Urbe Hub, progetto Quartieri di Roma 2026 | MIT (testo qui sotto) |
| Confini di quartieri, rioni e zone funzionali (deliberazione A.C. n. 150/2026) | `web/data/mappa-quartieri.json` (anche dentro `site/index.html`), ricavato da `data/quartieri-2026.simplified.geojson` di Quartieri di Roma 2026 con `web/scripts/prepara-mappa.mjs` (linee semplificate, nomi da `data/snapshot/quartieri.json`) | Roma Capitale, geoportale GeoRoma, strato DIPCUL:vst_nuove_localita | Dati aperti ai sensi dell'art. 52, c. 2, del CAD (D.Lgs. 82/2005), con fonte Roma Capitale. Il geoportale non dichiara una licenza per questo strato: si indica la fonte |
| Confini dei municipi | `web/data/mappa-municipi.json` (anche dentro `site/index.html`), ricavato da `data/raw/municipi-roma.geojson` con `web/scripts/prepara-mappa.mjs` | © OpenStreetMap contributors | ODbL 1.0: database derivato, resta sotto ODbL |
| Mappa di base | caricata dal browser da `tile.openstreetmap.org` | © OpenStreetMap contributors | ODbL 1.0, con la [policy d'uso delle tile](https://operations.osmfoundation.org/policies/tiles/) di OpenStreetMap Foundation: attribuzione visibile sulla mappa, nessun prefetch né uso offline. Il browser di chi visita contatta direttamente i server di OpenStreetMap |
| Leaflet 1.9.4 | `web/node_modules/leaflet` (npm, versione fissata), nel bundle della pagina iniziale | Volodymyr Agafonkin, CloudMade | BSD 2-Clause (`web/node_modules/leaflet/LICENSE`) |
| Leaflet 1.9.4, copia per il sito statico | `scripts/vendor/leaflet-1.9.4/` (`leaflet.js`, `leaflet.css`, `images/`, `LICENSE`, copiati da `web/node_modules/leaflet/dist`): `scripts/build.py` li mette dentro `site/index.html` con il testo della licenza in un commento, e le icone come immagini incorporate | Volodymyr Agafonkin, CloudMade | BSD 2-Clause (`scripts/vendor/leaflet-1.9.4/LICENSE`) |

Licenza MIT di Quartieri di Roma 2026:

> MIT License
>
> Copyright (c) 2026 Urbe Hub
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
