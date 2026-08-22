/** render-map.js - Leaflet + OpenStreetMap, pins coloured by pass.
 *  Placeholder: wiring lands in the "polish" phase.
 *
 *  Leaflet is the one permitted CDN script in this project, and it is loaded only
 *  on this page. OSM tiles require visible attribution. */
import { getIndex } from './data.js';
import { setStatus } from './util.js';

async function main() {
  const { resorts } = await getIndex();
  setStatus(resorts.length ? '' : 'No resorts yet.');
  // TODO: add the Leaflet <script>/<link> to map.html, then plot resorts by lat/lon.
}

main().catch((e) => setStatus(`Could not load the map: ${e.message}`, { error: true }));
