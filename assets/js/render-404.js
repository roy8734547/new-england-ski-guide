/**
 * render-404.js — turns a dead URL into a guess.
 *
 * A static host serves this file for any path it cannot match, which means the
 * URL the visitor actually asked for is still in `location`. Most 404s on a site
 * like this one are a mistyped or renamed resort slug — `/mount-snow`,
 * `/shawnee-peak.html` — and those are answerable from the manifest we already
 * ship. The matching lives in suggest.js because resort.html needs the same
 * thing for an unknown `?r=`; see the note at the top of that file.
 */

import { getIndex } from './data.js';
import { applyCanonical } from './seo.js';
import { el, fill, qs, STATE_NAMES } from './util.js';
import { suggestResorts, urlTokens } from './suggest.js';
import { mountShell } from './shell.js';

async function main() {
  await mountShell({
    breadcrumb: [{ label: 'Guide', href: 'index.html' }, 'Not found'],
    layout: 'document',
    ownHeading: true,
  });

  const requested = qs('#requested');
  const path = decodeURIComponent(location.pathname + location.search);
  if (path && path !== '/404.html' && path !== '/') {
    requested.hidden = false;
    fill(requested, 'You asked for ', el('code', {}, path), '.');
  }

  const wanted = urlTokens();
  if (!wanted.size) return;

  const { resorts = [] } = await getIndex();
  const hits = suggestResorts(resorts, wanted);
  if (!hits.length) return;

  qs('#suggestions').hidden = false;
  fill(qs('#suggestion-list'), hits.map((r) => el('li', {},
    el('a', { class: 'pill', href: `resort.html?r=${encodeURIComponent(r.slug)}` },
      r.name,
      el('small', {}, ` ${STATE_NAMES[r.state] ?? r.state}`)))));
}

// A 404 page that throws is a 404 page twice over: the static half of the page
// still lists every section of the site, so a failure here stays quiet.
main().catch(() => {});

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
