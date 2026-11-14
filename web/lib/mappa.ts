/* Mappa della pagina iniziale: indirizzi, mappa di base e testo del credito.
   La mappa è adattata da Quartieri di Roma 2026 di Urbe Hub (github.com/urbe-hub/quartieri-roma-2026,
   codice MIT, vedi THIRD_PARTY.md): stessa libreria (Leaflet), stessa mappa di base (OpenStreetMap)
   e stesso file dei confini delle aree. Questo modulo non carica Leaflet: lo fa lib/mappa-leaflet.ts,
   solo nel browser. */
import { aLink } from "./engine";

export const QR_SITO = "https://romaquartieri.it/";
export const QR_REPO = "https://github.com/urbe-hub/quartieri-roma-2026";
export const QR_LICENZA = QR_REPO + "/blob/main/LICENSE";
export const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
export const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";
export const OSM_SEGNALA = "https://www.openstreetmap.org/fixthemap";

/* Mappa di base: le tile di OpenStreetMap, come in Quartieri di Roma 2026, con la policy d'uso di
   OpenStreetMap Foundation (operations.osmfoundation.org/policies/tiles/): attribuzione visibile sulla
   mappa, nessun prefetch, nessun uso offline, Referer del browser lasciato com'è. Se il traffico cresce
   si passa a un fornitore con un piano adatto cambiando NEXT_PUBLIC_MAPPA_TILE_URL al build
   (e l'attribuzione qui sotto, se cambia il fornitore). */
export const TILE_URL = process.env.NEXT_PUBLIC_MAPPA_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUZIONE = `© <a href="${OSM_COPYRIGHT}" target="_blank" rel="noopener">OpenStreetMap</a> contributors`;

/* Riga sotto la mappa */
export function creditoMappa() {
  return `<p class="map-credit">Mappa adattata da Quartieri di Roma (Urbe Hub): ${aLink(QR_SITO, "romaquartieri.it")} e ${aLink(QR_REPO, "codice su GitHub")} (licenza ${aLink(QR_LICENZA, "MIT")}). Confini dei municipi e mappa di base © ${aLink(OSM_COPYRIGHT, "OpenStreetMap contributors")}, ${aLink(ODBL, "ODbL")}. Quartieri: Roma Capitale, GeoRoma (deliberazione n. 150/2026).</p>`;
}

/* Riquadro della pagina Fonti */
export function fontiMappa() {
  return `<div class="panel"><h3>Mappa della pagina iniziale</h3>
    ${creditoMappa().replace('class="map-credit"', 'class="src" style="margin-top:0"')}
    <ul>
      <li>Da ${aLink(QR_REPO, "Quartieri di Roma 2026")} di Urbe Hub riprendiamo l'impostazione della mappa (Leaflet, mappa di base di OpenStreetMap, i confini delle 457 aree della deliberazione n. 150/2026 dentro i municipi, il nome dell'area al passaggio del mouse o con un tocco) e il file dei confini delle aree, che semplifichiamo ancora per il sito.</li>
      <li>Il codice di Quartieri di Roma 2026 è sotto licenza MIT, compatibile con la AGPL-3.0 di questo sito. I confini delle aree sono dati aperti di Roma Capitale (art. 52, c. 2, del CAD), con fonte Roma Capitale. I confini dei municipi e la mappa di base sono © OpenStreetMap contributors, sotto ${aLink(ODBL, "ODbL 1.0")}.</li>
      <li>I colori dei municipi vengono dagli indicatori del sito, non da Quartieri di Roma.</li>
      <li>La mappa di base arriva dai server di OpenStreetMap (tile.openstreetmap.org): il browser li contatta direttamente, quindi ricevono l'indirizzo IP di chi visita. Un errore nella mappa di base si segnala a OpenStreetMap: ${aLink(OSM_SEGNALA, "segnala un errore")}.</li>
      <li>Libreria della mappa: ${aLink("https://leafletjs.com/", "Leaflet")} 1.9.4, licenza BSD 2-Clause.</li>
    </ul></div>`;
}
