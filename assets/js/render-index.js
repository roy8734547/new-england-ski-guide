/**
 * render-index.js - comparison table + card grid + filters for index.html.
 *
 * Everything is client-side over data/index.json. Filter and sort state lives in
 * the querystring so a filtered view is a shareable URL, which is the whole
 * reason the site uses real links rather than a router.
 */

import { getIndex } from './data.js';
import { applyCanonical } from './seo.js';
import {
  el, fill, fmt, money, formatDate, compareNullsLast,
  qs, qsa, setStatus, STATE_NAMES, PASS_LABELS,
} from './util.js';

const PASS_ORDER = ['epic', 'ikon', 'indy', 'other', 'none'];

const COLUMNS = [
  { key: 'name', label: 'Resort', cls: 'col-name', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'verticalDrop', label: 'Vertical', unit: ' ft' },
  { key: 'skiableAcres', label: 'Acres' },
  { key: 'trailCount', label: 'Trails' },
  { key: 'liftCount', label: 'Lifts' },
  { key: 'annualSnowfallAvg', label: 'Snowfall', unit: '"' },
  { key: 'snowmakingPercent', label: 'Snowmaking', unit: '%' },
  { key: 'nightSkiing', label: 'Night' },
  { key: 'parkCount', label: 'Parks' },
  { key: 'mogulPresence', label: 'Bumps', type: 'text', cls: 'col-text' },
  { key: 'passes', label: 'Pass', type: 'passes', sortable: false, cls: 'col-text' },
  { key: 'advanceTypical', label: 'Advance', type: 'money' },
  { key: 'seasonPassAdult', label: 'Season pass', type: 'money' },
];

/**
 * Trip-planning filters over the two v3 sections. Each is a flat test against a
 * field build-index.mjs precomputes, for the same reason passTypes exists.
 */
const FEATURES = {
  park: { label: 'Park', test: (r) => r.hasPark === true },
  pipe: { label: 'Halfpipe', test: (r) => r.hasPipe === true },
  bumps: { label: 'Bumps', test: (r) => ['signature', 'common'].includes(r.mogulPresence) },
};

/** Bumps ordered worst to best so the column sorts meaningfully. */
const MOGUL_RANK = { none: 0, rare: 1, occasional: 2, common: 3, signature: 4 };

const MOGUL_SHORT = {
  signature: 'Signature',
  common: 'Common',
  occasional: 'Occasional',
  rare: 'Rare',
  none: 'None',
};

const state = {
  states: new Set(),
  passes: new Set(),
  features: new Set(),
  minVertical: 0,
  nightOnly: false,
  sortBy: 'verticalDrop',
  sortDir: 'desc',
  view: 'cards',
};

let resorts = [];

// --- filtering and sorting --------------------------------------------------

function matches(r) {
  if (state.states.size && !state.states.has(r.state)) return false;
  if (state.passes.size && !r.passTypes.some((t) => state.passes.has(t))) return false;
  if (state.nightOnly && r.nightSkiing !== true) return false;
  // Features are additive: every selected chip must hold.
  for (const key of state.features) {
    if (!FEATURES[key]?.test(r)) return false;
  }
  // A null vertical can never satisfy a minimum, but it is visible at "Any".
  if (state.minVertical > 0 && !(r.verticalDrop >= state.minVertical)) return false;
  return true;
}

function sorted(list) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  // "signature" beats "rare"; alphabetical order would say the opposite.
  const value = (r) => (state.sortBy === 'mogulPresence'
    ? MOGUL_RANK[r.mogulPresence] ?? null
    : r[state.sortBy]);
  return [...list].sort((a, b) => {
    const cmp = compareNullsLast(value(a), value(b), dir);
    // Name is the stable tiebreak so equal rows never shuffle between renders.
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name, 'en');
  });
}

// --- shared bits ------------------------------------------------------------

function passBadges(list) {
  const seen = new Set();
  return list
    .filter((p) => p.type && !seen.has(p.type) && seen.add(p.type))
    .map((p) => el('li', {}, el('span', {
      class: `pass pass--${p.type}`,
      title: p.access ? `${p.name} — ${p.access}` : p.name,
    }, PASS_LABELS[p.type] ?? p.type)));
}

const detailHref = (slug) => `resort.html?r=${encodeURIComponent(slug)}`;

// --- card grid --------------------------------------------------------------

function card(r) {
  return el('li', { class: 'card' },
    el('h2', { class: 'card__name' }, el('a', { href: detailHref(r.slug) }, r.name)),
    el('p', { class: 'card__where' },
      [r.town, STATE_NAMES[r.state] ?? r.state].filter(Boolean).join(', '),
      r.region ? ` · ${r.region}` : null),

    el('p', { class: 'card__vert' },
      el('b', { class: 'num' }, r.verticalDrop === null ? '—' : fmt(r.verticalDrop)),
      el('span', {}, 'ft vertical')),

    el('dl', { class: 'card__stats' },
      el('div', {}, el('dt', {}, 'Acres'),
        el('dd', { class: r.skiableAcres === null ? 'is-unknown' : '' }, fmt(r.skiableAcres))),
      el('div', {}, el('dt', {}, 'Trails'),
        el('dd', { class: r.trailCount === null ? 'is-unknown' : '' }, fmt(r.trailCount))),
      el('div', {}, el('dt', {}, 'Snowfall'),
        el('dd', { class: r.annualSnowfallAvg === null ? 'is-unknown' : '' },
          r.annualSnowfallAvg === null ? '—' : `${fmt(r.annualSnowfallAvg)}"`))),

    r.bestFor?.length
      ? el('ul', { class: 'tags' }, r.bestFor.slice(0, 3).map((t) => el('li', { class: 'tag' }, t)))
      : null,

    el('div', { class: 'card__foot' },
      el('ul', { class: 'pass-list' }, passBadges(r.passes)),
      r.nightSkiing === true ? el('span', { class: 'tag' }, 'Night skiing') : null)
  );
}

// --- comparison table -------------------------------------------------------

function headerRow() {
  return el('tr', {}, COLUMNS.map((col) => {
    const isSort = state.sortBy === col.key;
    const th = el('th', {
      scope: 'col',
      class: [col.cls, col.sortable === false ? '' : 'sortable'].filter(Boolean).join(' '),
    });
    if (isSort) th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');

    if (col.sortable === false) {
      th.append(el('span', { style: 'display:block;padding:.6rem .8rem;text-align:left' }, col.label));
    } else {
      th.append(el('button', {
        type: 'button',
        onclick: () => {
          if (state.sortBy === col.key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = col.key;
            state.sortDir = col.type === 'text' ? 'asc' : 'desc';
          }
          syncControls();
          render();
        },
      }, col.label));
    }
    return th;
  }));
}

function cell(r, col) {
  const value = r[col.key];

  if (col.type === 'passes') {
    return el('td', { class: col.cls },
      el('ul', { class: 'pass-list' }, passBadges(r.passes)));
  }
  if (col.key === 'name') {
    return el('td', { class: 'col-name' }, el('a', { href: detailHref(r.slug) }, r.name));
  }
  if (value === null || value === undefined) {
    return el('td', { class: `${col.cls ?? ''} is-unknown`.trim(), title: 'Not sourced' }, '—');
  }
  if (col.key === 'mogulPresence') {
    return el('td', { class: col.cls },
      el('span', { class: `presence__badge presence__badge--${value}` }, MOGUL_SHORT[value] ?? value));
  }
  if (col.type === 'money') return el('td', { class: col.cls }, money(value));
  if (typeof value === 'boolean') return el('td', { class: col.cls }, value ? 'Yes' : 'No');
  return el('td', { class: col.cls }, `${fmt(value)}${col.unit ?? ''}`);
}

// --- render -----------------------------------------------------------------

function render() {
  const visible = sorted(resorts.filter(matches));

  const cards = qs('#resort-cards');
  const tableWrap = qs('#resort-table-wrap');
  const empty = qs('#empty');

  fill(cards, visible.map(card));
  fill(qs('#resort-table thead'), headerRow());
  fill(qs('#resort-table tbody'),
    visible.map((r) => el('tr', {}, COLUMNS.map((col) => cell(r, col)))));

  const none = visible.length === 0;
  empty.hidden = !none;
  cards.hidden = none || state.view !== 'cards';
  tableWrap.hidden = none || state.view !== 'table';

  const total = resorts.length;
  qs('#result-count').textContent = visible.length === total
    ? `${total} ${total === 1 ? 'mountain' : 'mountains'}`
    : `${visible.length} of ${total} mountains`;

  qs('#reset-filters').hidden = !isFiltered();
  writeUrl();
}

const isFiltered = () =>
  state.states.size > 0 || state.passes.size > 0 || state.features.size > 0 ||
  state.minVertical > 0 || state.nightOnly;

// --- controls ---------------------------------------------------------------

function toggleChip(set, value) {
  if (set.has(value)) set.delete(value); else set.add(value);
  syncControls();
  render();
}

function buildChips() {
  const states = [...new Set(resorts.map((r) => r.state))].sort();
  fill(qs('#filter-state'), states.map((code) => el('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': 'false',
    dataset: { value: code },
    title: STATE_NAMES[code] ?? code,
    onclick: () => toggleChip(state.states, code),
  }, code)));

  fill(qs('#filter-features'), Object.entries(FEATURES).map(([key, f]) => el('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': 'false',
    dataset: { value: key },
    onclick: () => toggleChip(state.features, key),
  }, f.label)));

  const passes = PASS_ORDER.filter((t) => resorts.some((r) => r.passTypes.includes(t)));
  fill(qs('#filter-pass'), passes.map((type) => el('button', {
    type: 'button',
    class: 'chip',
    style: `--chip-accent: var(--pass-${type})`,
    'aria-pressed': 'false',
    dataset: { value: type },
    onclick: () => toggleChip(state.passes, type),
  }, PASS_LABELS[type])));
}

function syncControls() {
  qsa('#filter-state .chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(state.states.has(b.dataset.value)));
  });
  qsa('#filter-pass .chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(state.passes.has(b.dataset.value)));
  });
  qsa('#filter-features .chip').forEach((b) => {
    b.setAttribute('aria-pressed', String(state.features.has(b.dataset.value)));
  });
  qs('#filter-vertical').value = String(state.minVertical);
  qs('#filter-vertical-out').textContent =
    state.minVertical === 0 ? 'Any' : `${fmt(state.minVertical)} ft`;
  qs('#filter-night').checked = state.nightOnly;
  qs('#sort-by').value = state.sortBy;
  qs('#sort-dir').value = state.sortDir;
  qs('#view-cards').setAttribute('aria-pressed', String(state.view === 'cards'));
  qs('#view-table').setAttribute('aria-pressed', String(state.view === 'table'));
}

function wireControls() {
  qs('#filter-vertical').addEventListener('input', (e) => {
    state.minVertical = Number(e.target.value);
    qs('#filter-vertical-out').textContent =
      state.minVertical === 0 ? 'Any' : `${fmt(state.minVertical)} ft`;
    render();
  });
  qs('#filter-night').addEventListener('change', (e) => {
    state.nightOnly = e.target.checked;
    render();
  });
  qs('#sort-by').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    render();
  });
  qs('#sort-dir').addEventListener('change', (e) => {
    state.sortDir = e.target.value;
    render();
  });
  qs('#view-cards').addEventListener('click', () => setView('cards'));
  qs('#view-table').addEventListener('click', () => setView('table'));
  qs('#reset-filters').addEventListener('click', () => {
    state.states.clear();
    state.passes.clear();
    state.features.clear();
    state.minVertical = 0;
    state.nightOnly = false;
    syncControls();
    render();
  });
}

function setView(view) {
  state.view = view;
  syncControls();
  render();
}

// --- URL round-trip ---------------------------------------------------------

function readUrl() {
  const p = new URLSearchParams(location.search);
  p.get('state')?.split(',').filter(Boolean).forEach((s) => state.states.add(s));
  p.get('pass')?.split(',').filter(Boolean).forEach((s) => state.passes.add(s));
  p.get('feat')?.split(',').filter(Boolean)
    .forEach((s) => { if (FEATURES[s]) state.features.add(s); });
  if (p.has('vert')) state.minVertical = Number(p.get('vert')) || 0;
  if (p.get('night') === '1') state.nightOnly = true;
  if (p.has('sort')) state.sortBy = p.get('sort');
  if (p.get('dir') === 'asc') state.sortDir = 'asc';
  if (p.get('view') === 'table') state.view = 'table';
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.states.size) p.set('state', [...state.states].join(','));
  if (state.passes.size) p.set('pass', [...state.passes].join(','));
  if (state.features.size) p.set('feat', [...state.features].join(','));
  if (state.minVertical) p.set('vert', String(state.minVertical));
  if (state.nightOnly) p.set('night', '1');
  if (state.sortBy !== 'verticalDrop') p.set('sort', state.sortBy);
  if (state.sortDir !== 'desc') p.set('dir', state.sortDir);
  if (state.view !== 'cards') p.set('view', state.view);
  const query = p.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

// --- boot -------------------------------------------------------------------

async function main() {
  const index = await getIndex();
  resorts = index.resorts ?? [];

  if (!resorts.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  readUrl();
  buildChips();
  wireControls();
  syncControls();
  render();
  setStatus('');

  if (index.generatedAt) {
    qs('.site-footer .shell').append(
      el('p', { class: 'provenance' }, `Resort data last rebuilt ${formatDate(index.generatedAt.slice(0, 10))}.`)
    );
  }
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
