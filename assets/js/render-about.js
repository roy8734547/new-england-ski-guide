/**
 * render-about.js — fills the counts at the top of about.html from the generated
 * manifest.
 *
 * These five figures could have been typed into the HTML in about four seconds.
 * They are not, for the same reason no resort fact is ever typed into a template
 * anywhere else in this project: the roster changes, and a hand-typed "45
 * mountains" in a paragraph is a fact with no source and no expiry date. The
 * prose around them is written so it still reads correctly if this script never
 * runs and the dashes stay put.
 */

import { getIndex } from './data.js';
import { applyCanonical } from './seo.js';
import { fmt, formatDate, qs, qsa, STATE_NAMES } from './util.js';
import { mountShell } from './shell.js';
import { supportAction } from './support.js';

/**
 * Every match, not the first. The mountain count appears twice on this page now
 * — in the stat bar and in the sentence about what the guide costs to make —
 * and a hand-typed second copy is exactly the fact-with-no-source this project
 * does not allow. The one in the markup is a fallback that reads correctly if
 * this never runs.
 */
function set(name, value) {
  if (value === null || value === undefined) return;
  for (const node of qsa(`[data-stat="${name}"]`)) node.textContent = value;
}

async function main() {
  await mountShell({
    page: 'about',
    breadcrumb: ['Guide', 'About'],
    layout: 'document',
    ownHeading: true,
    // The one action on this page. "All resorts" came off the bar rather than
    // sitting beside a second coloured button: it is the first item in the
    // sidebar on every page, including this one, and the bar reads better with
    // one thing on it.
    actions: [supportAction()],
  });

  const index = await getIndex();
  const resorts = index.resorts ?? [];
  if (!resorts.length) return;

  const verticals = resorts.map((r) => r.verticalDrop).filter((v) => typeof v === 'number');
  const states = [...new Set(resorts.map((r) => r.state))];

  set('count', fmt(resorts.length));
  set('states', String(states.length));
  set('minVert', verticals.length ? `${fmt(Math.min(...verticals))} ft` : null);
  set('maxVert', verticals.length ? `${fmt(Math.max(...verticals))} ft` : null);
  set('generated', index.generatedAt ? formatDate(index.generatedAt.slice(0, 10)) : null);

  const statesNode = qs('[data-stat="states"]');
  if (statesNode) {
    statesNode.title = states
      .map((c) => STATE_NAMES[c] ?? c)
      .sort((a, b) => a.localeCompare(b, 'en'))
      .join(', ');
  }
}

// A failure here leaves five dashes and a page that still reads correctly, so it
// is deliberately silent rather than shouting at a visitor about a manifest.
main().catch(() => {});

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
