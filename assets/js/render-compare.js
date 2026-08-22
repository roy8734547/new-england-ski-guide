/** render-compare.js - side-by-side comparison of 2-4 resorts, chosen via ?r=a,b,c.
 *  Placeholder: wiring lands in the "polish" phase. */
import { getIndex } from './data.js';
import { param, setStatus } from './util.js';

async function main() {
  const { resorts } = await getIndex();
  const picked = (param('r') ?? '').split(',').filter(Boolean).slice(0, 4);
  setStatus(resorts.length ? '' : 'No resorts yet.');
  void picked;
  // TODO: render the picker and the side-by-side table.
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));
