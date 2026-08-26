/**
 * render-index.js — the table view, which is now the primary view of the site.
 *
 * Everything is client-side over data/index.json. Filter, sort and selection
 * state all live in the querystring, so any view of this table is a link you can
 * send someone — which is the whole reason the site uses real URLs rather than a
 * router, and the reason shell.js's sidebar can be nothing but a list of `<a>`s.
 *
 * Three things arrived with the redesign:
 *
 *   Selection.  Checking two to four rows enables "Compare selected" in the top
 *               bar, which is just a link to compare.html?r=a,b,c. The selection
 *               is in the URL too (?sel=), so a half-built comparison survives a
 *               reload and can be handed over.
 *   Sparklines. The 7-day column is the Open-Meteo snowfall forecast, one bar
 *               per day, scaled against the deepest day on screen so the column
 *               is comparable down its own length rather than row by row.
 *   Status bar. Count, average vertical, and who is about to get the most snow.
 */

import { getIndex } from './data.js';
import { getForecasts, snowfallTotal } from './weather.js';
import { sparkline, peakDay } from './sparkline.js';
import {
  el, fill, fmt, money, formatDate, relativeTime, compareNullsLast,
  qs, qsa, setStatus, STATE_NAMES, PASS_LABELS,
} from './util.js';
import { applyCanonical } from './seo.js';
import { mountShell, setStatusStats, setLive } from './shell.js';

const PASS_ORDER = ['epic', 'ikon', 'indy', 'other', 'none'];
const MAX_COMPARE = 4;
const MIN_COMPARE = 2;

/**
 * The column set from REDESIGN.md, in its order. `num` right-aligns and applies
 * tabular figures; `w` is a fixed width so the header row cannot shift when the
 * body renders.
 */
const COLUMNS = [
  { key: 'select', label: '', type: 'select', w: '40px', sortable: false },
  { key: 'name', label: 'Resort', type: 'resort', w: '210px' },
  { key: 'town', label: 'Town', type: 'town', w: '190px' },
  { key: 'verticalDrop', label: 'Vertical', num: true, unit: ' ft', w: '86px' },
  { key: 'skiableAcres', label: 'Acres', num: true, w: '72px' },
  { key: 'trailCount', label: 'Trails', num: true, w: '64px' },
  { key: 'liftCount', label: 'Lifts', num: true, w: '58px' },
  { key: 'annualSnowfallAvg', label: 'Snowfall', num: true, unit: '"', w: '78px' },
  { key: 'passTypes', label: 'Pass', type: 'pass', w: '158px', sortable: false },
  { key: 'snow7d', label: '7-day snow', type: 'spark', num: true, w: '124px' },
];

const FEATURES = {
  park: { label: 'Park', test: (r) => r.hasPark === true },
  pipe: { label: 'Halfpipe', test: (r) => r.hasPipe === true },
  bumps: { label: 'Bumps', test: (r) => ['signature', 'common'].includes(r.mogulPresence) },
};

const MOGUL_RANK = { none: 0, rare: 1, occasional: 2, common: 3, signature: 4 };

const state = {
  q: '',
  states: new Set(),
  passes: new Set(),
  features: new Set(),
  minVertical: 0,
  nightOnly: false,
  sortBy: 'verticalDrop',
  sortDir: 'desc',
  view: 'table',
  selected: new Set(),
};

let resorts = [];
/** slug -> {status:'ok', data} | {status:'error'}; filled after first paint. */
let forecasts = new Map();

// --- filtering and sorting --------------------------------------------------

const haystack = (r) => `${r.name} ${r.town ?? ''} ${(r.aka ?? []).join(' ')}`.toLowerCase();

function matches(r) {
  if (state.q && !haystack(r).includes(state.q)) return false;
  if (state.states.size && !state.states.has(r.state)) return false;
  if (state.passes.size && !r.passTypes.some((t) => state.passes.has(t))) return false;
  if (state.nightOnly && r.nightSkiing !== true) return false;
  for (const key of state.features) if (!FEATURES[key]?.test(r)) return false;
  if (state.minVertical > 0 && !(r.verticalDrop >= state.minVertical)) return false;
  return true;
}

/** Forecast total for a resort, or null while the fetch is still in flight. */
function snow7d(slug) {
  const hit = forecasts.get(slug);
  if (!hit || hit.status !== 'ok') return null;
  const total = snowfallTotal(hit.data, 7);
  return Number.isFinite(total) ? total : null;
}

function sortValue(r) {
  if (state.sortBy === 'mogulPresence') return MOGUL_RANK[r.mogulPresence] ?? null;
  if (state.sortBy === 'snow7d') return snow7d(r.slug);
  if (state.sortBy === 'town') return r.town ?? null;
  return r[state.sortBy];
}

function sorted(list) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const cmp = compareNullsLast(sortValue(a), sortValue(b), dir);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name, 'en');
  });
}

const visible = () => sorted(resorts.filter(matches));

// --- cells ------------------------------------------------------------------

const detailHref = (slug) => `resort.html?r=${encodeURIComponent(slug)}`;

function passTags(list, { limit = 2 } = {}) {
  const seen = new Set();
  const types = (list ?? [])
    .map((p) => p.type)
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .sort((a, b) => PASS_ORDER.indexOf(a) - PASS_ORDER.indexOf(b));
  const shown = types.slice(0, limit);
  return el('span', { class: 'tags' },
    shown.map((t) => el('span', { class: `tag tag--${t}` }, PASS_LABELS[t] ?? t)),
    types.length > shown.length
      ? el('span', { class: 'tag tag--more', title: types.slice(limit).map((t) => PASS_LABELS[t]).join(', ') },
        `+${types.length - shown.length}`)
      : null);
}

function resortCell(r) {
  return el('div', { class: 'ticker-row' },
    el('span', { class: 'tick-icon', 'aria-hidden': 'true' }, r.state),
    el('a', { class: 'ticker', href: detailHref(r.slug) }, r.name));
}

function cell(r, col, peak) {
  if (col.type === 'select') {
    const box = el('input', {
      type: 'checkbox',
      class: 'row-check',
      checked: state.selected.has(r.slug),
      'aria-label': `Select ${r.name} for comparison`,
      dataset: { slug: r.slug },
    });
    return el('td', { class: 'col-select' }, box);
  }
  if (col.type === 'resort') return el('td', { class: 'col-resort' }, resortCell(r));
  if (col.type === 'town') {
    return el('td', { class: 'col-town' },
      el('span', { class: 'name-cell' },
        [r.town, STATE_NAMES[r.state] ?? r.state].filter(Boolean).join(', ')));
  }
  if (col.type === 'pass') return el('td', { class: 'col-pass' }, passTags(r.passes));
  if (col.type === 'spark') {
    return el('td', { class: 'num col-spark' },
      sparkline(forecasts.get(r.slug), peak, snow7d(r.slug)));
  }

  const value = r[col.key];
  if (value === null || value === undefined) {
    return el('td', { class: 'num is-unknown', title: 'Not sourced' }, '—');
  }
  return el('td', { class: 'num' }, `${fmt(value)}${col.unit ?? ''}`);
}

// --- table ------------------------------------------------------------------

function headerRow(rows) {
  const allSelected = rows.length > 0 && rows.every((r) => state.selected.has(r.slug));
  const someSelected = rows.some((r) => state.selected.has(r.slug));

  return el('tr', {}, COLUMNS.map((col) => {
    if (col.type === 'select') {
      const box = el('input', {
        type: 'checkbox',
        id: 'select-all',
        class: 'row-check',
        checked: allSelected,
        'aria-label': 'Select every mountain shown',
      });
      box.indeterminate = someSelected && !allSelected;
      box.addEventListener('change', () => {
        if (box.checked) {
          for (const r of rows) {
            if (state.selected.size >= MAX_COMPARE) break;
            state.selected.add(r.slug);
          }
        } else {
          for (const r of rows) state.selected.delete(r.slug);
        }
        render();
      });
      return el('th', { scope: 'col', class: 'col-select', style: `width:${col.w}` }, box);
    }

    const isSort = state.sortBy === col.key;
    const th = el('th', {
      scope: 'col',
      class: [col.num ? 'num' : '', isSort ? 'sort-active' : ''].filter(Boolean).join(' '),
      style: col.w ? `width:${col.w}` : null,
    });
    if (isSort) th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');

    if (col.sortable === false) {
      th.append(el('span', { class: 'th-label' }, col.label));
    } else {
      th.append(el('button', {
        type: 'button',
        class: 'th-sort',
        onclick: () => {
          if (state.sortBy === col.key) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = col.key;
            state.sortDir = col.num || col.type === 'spark' ? 'desc' : 'asc';
          }
          syncControls();
          render();
        },
      }, col.label, isSort ? el('span', { class: 'th-arrow' }, state.sortDir === 'asc' ? '↑' : '↓') : null));
    }
    return th;
  }));
}

function bodyRow(r, peak) {
  const row = el('tr', {
    class: state.selected.has(r.slug) ? 'is-selected' : '',
    dataset: { slug: r.slug },
  }, COLUMNS.map((col) => cell(r, col, peak)));

  // The reference selects on row click. Here the row also contains a link, so
  // the link wins inside its own hit area and the rest of the row toggles.
  row.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (e.target.matches('input.row-check')) return; // its own change handler
    toggleSelected(r.slug);
  });
  return row;
}

function toggleSelected(slug) {
  if (state.selected.has(slug)) state.selected.delete(slug);
  else if (state.selected.size < MAX_COMPARE) state.selected.add(slug);
  else {
    setStatus(`Four is the most you can compare at once. Clear one first.`);
    setTimeout(() => setStatus(''), 2600);
    return;
  }
  render();
}

// --- cards (kept: the table is primary, not exclusive) ----------------------

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
    el('div', { class: 'card__foot' }, passTags(r.passes, { limit: 3 })));
}

// --- render -----------------------------------------------------------------

function render() {
  const rows = visible();
  const peak = peakDay(forecasts, rows.map((r) => r.slug));

  fill(qs('#resort-table thead'), headerRow(rows));
  fill(qs('#resort-table tbody'), rows.map((r) => bodyRow(r, peak)));
  fill(qs('#resort-cards'), rows.map(card));

  const none = rows.length === 0;
  qs('#empty').hidden = !none;
  qs('#resort-table-wrap').hidden = none || state.view !== 'table';
  qs('#resort-cards').hidden = none || state.view !== 'cards';

  qs('#result-count').textContent = rows.length === resorts.length
    ? `${resorts.length} mountains`
    : `${rows.length} of ${resorts.length}`;
  qs('#reset-filters').hidden = !isFiltered();

  syncSelectionUi();
  renderStatusbar(rows);
  writeUrl();
}

const isFiltered = () => state.q !== '' || state.states.size > 0 || state.passes.size > 0
  || state.features.size > 0 || state.minVertical > 0 || state.nightOnly;

function renderStatusbar(rows) {
  const verticals = rows.map((r) => r.verticalDrop).filter(Number.isFinite);
  const avg = verticals.length
    ? Math.round(verticals.reduce((a, b) => a + b, 0) / verticals.length)
    : null;

  let best = null;
  for (const r of rows) {
    const total = snow7d(r.slug);
    if (total !== null && (best === null || total > best.total)) best = { r, total };
  }

  setStatusStats([
    { value: `${fmt(rows.length)} ${rows.length === 1 ? 'mountain' : 'mountains'}` },
    avg === null ? null : { label: 'Avg vertical', value: `${fmt(avg)} ft` },
    best && best.total > 0
      ? { label: 'Most snow this week', value: `${best.r.name} ${fmt(best.total, { digits: best.total < 10 ? 1 : 0 })}"`, tone: 'up' }
      : null,
    state.selected.size ? { label: 'Selected', value: fmt(state.selected.size) } : null,
  ]);
}

// --- selection and the top bar ----------------------------------------------

function syncSelectionUi() {
  const btn = qs('#compare-selected');
  if (!btn) return;
  const n = state.selected.size;
  const ok = n >= MIN_COMPARE && n <= MAX_COMPARE;
  btn.disabled = !ok;
  btn.querySelector('span:last-child').textContent =
    n === 0 ? 'Compare selected' : `Compare ${n} selected`;
  btn.dataset.href = ok
    ? `compare.html?r=${[...state.selected].map(encodeURIComponent).join(',')}`
    : '';
}

/**
 * CSV of exactly what is on screen — same rows, same order, same columns. An
 * export that quietly gives you all 45 when the table shows 8 is a bug report
 * waiting to happen.
 */
function exportCsv() {
  const rows = visible();
  const cols = COLUMNS.filter((c) => c.type !== 'select' && c.type !== 'spark');
  const header = [...cols.map((c) => (c.type === 'town' ? 'Town' : c.label)), 'State', '7-day snow (in)'];

  const value = (r, c) => {
    if (c.type === 'resort') return r.name;
    if (c.type === 'town') return r.town ?? '';
    if (c.type === 'pass') return (r.passTypes ?? []).map((t) => PASS_LABELS[t] ?? t).join(' / ');
    const v = r[c.key];
    return v === null || v === undefined ? '' : v;
  };
  const esc = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [header.map(esc).join(',')];
  for (const r of rows) {
    const snow = snow7d(r.slug);
    lines.push([...cols.map((c) => value(r, c)), r.state, snow === null ? '' : snow.toFixed(1)]
      .map(esc).join(','));
  }

  // A BOM, because the single likeliest destination for this file is Excel on
  // Windows, which reads UTF-8 without one as Latin-1 and mangles every accent
  // and every en dash in a resort name.
  const blob = new Blob(
    ['﻿', lines.join('\r\n'), '\r\n'],
    { type: 'text/csv;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `new-england-ski-guide-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TOPBAR_ACTIONS = [
  {
    id: 'compare-selected',
    label: 'Compare selected',
    icon: 'M3 2v12M8 2v12M13 2v12',
    disabled: true,
    onClick: (e) => {
      const href = e.currentTarget.dataset.href;
      if (href) location.href = href;
    },
  },
  { separator: true },
  {
    id: 'toggle-filters',
    label: 'Filters',
    icon: 'M2 4h12M4 8h8M6 12h4',
    onClick: () => {
      const more = qs('#more-filters');
      more.hidden = !more.hidden;
      qs('#toggle-filters').setAttribute('aria-expanded', String(!more.hidden));
    },
  },
  {
    id: 'toggle-view',
    label: 'Cards',
    icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
    onClick: () => setView(state.view === 'table' ? 'cards' : 'table'),
  },
  { separator: true },
  {
    id: 'export-csv',
    label: 'Export CSV',
    icon: 'M8 2v8M5 7l3 3 3-3M3 13h10',
    onClick: exportCsv,
  },
  { label: 'Conditions', href: 'conditions.html', primary: true },
];

// --- controls ---------------------------------------------------------------

function setView(view) {
  state.view = view;
  const btn = qs('#toggle-view');
  if (btn) btn.querySelector('span:last-child').textContent = view === 'table' ? 'Cards' : 'Table';
  render();
}

function toggleChip(set, value) {
  if (set.has(value)) set.delete(value); else set.add(value);
  syncControls();
  render();
}

function buildChips() {
  const states = [...new Set(resorts.map((r) => r.state))].sort();
  fill(qs('#filter-state'), states.map((code) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false',
    dataset: { value: code }, title: STATE_NAMES[code] ?? code,
    onclick: () => toggleChip(state.states, code),
  }, code)));

  fill(qs('#filter-features'), Object.entries(FEATURES).map(([key, f]) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false',
    dataset: { value: key },
    onclick: () => toggleChip(state.features, key),
  }, f.label)));

  // The toolbar's pass row is the reference's filter-tag strip, so it gets an
  // explicit "All" that clears rather than a chip you have to un-press.
  const passes = PASS_ORDER.filter((t) => resorts.some((r) => r.passTypes.includes(t)));
  fill(qs('#filter-pass'), [
    el('button', {
      type: 'button', class: 'filter-tag', 'aria-pressed': 'true', dataset: { value: '' },
      onclick: () => { state.passes.clear(); syncControls(); render(); },
    }, 'All'),
    ...passes.map((type) => el('button', {
      type: 'button', class: 'filter-tag', 'aria-pressed': 'false', dataset: { value: type },
      onclick: () => toggleChip(state.passes, type),
    }, PASS_LABELS[type])),
  ]);
}

function syncControls() {
  qsa('#filter-state .chip').forEach((b) => b.setAttribute('aria-pressed', String(state.states.has(b.dataset.value))));
  qsa('#filter-features .chip').forEach((b) => b.setAttribute('aria-pressed', String(state.features.has(b.dataset.value))));
  qsa('#filter-pass .filter-tag').forEach((b) => {
    const pressed = b.dataset.value === '' ? state.passes.size === 0 : state.passes.has(b.dataset.value);
    b.setAttribute('aria-pressed', String(pressed));
  });
  qs('#filter-vertical').value = String(state.minVertical);
  qs('#filter-vertical-out').textContent = state.minVertical === 0 ? 'Any' : `${fmt(state.minVertical)} ft`;
  qs('#filter-night').checked = state.nightOnly;
  qs('#sort-by').value = state.sortBy;
  const dir = qs('#sort-dir');
  dir.dataset.dir = state.sortDir;
  dir.textContent = state.sortDir === 'asc' ? '↑' : '↓';
  dir.setAttribute('aria-label', `Sort direction: ${state.sortDir === 'asc' ? 'low to high' : 'high to low'}`);
  if (qs('#search').value !== state.q) qs('#search').value = state.q;
}

function wireControls() {
  qs('#search').addEventListener('input', (e) => {
    state.q = e.target.value.trim().toLowerCase();
    render();
  });
  qs('#filter-vertical').addEventListener('input', (e) => {
    state.minVertical = Number(e.target.value);
    qs('#filter-vertical-out').textContent = state.minVertical === 0 ? 'Any' : `${fmt(state.minVertical)} ft`;
    render();
  });
  qs('#filter-night').addEventListener('change', (e) => { state.nightOnly = e.target.checked; render(); });
  qs('#sort-by').addEventListener('change', (e) => { state.sortBy = e.target.value; render(); });
  qs('#sort-dir').addEventListener('click', () => {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    syncControls();
    render();
  });
  qs('#reset-filters').addEventListener('click', () => {
    state.q = '';
    state.states.clear();
    state.passes.clear();
    state.features.clear();
    state.minVertical = 0;
    state.nightOnly = false;
    syncControls();
    render();
  });

  // Delegated so it survives every re-render of the tbody.
  qs('#resort-table').addEventListener('change', (e) => {
    const box = e.target.closest('input.row-check[data-slug]');
    if (box) toggleSelected(box.dataset.slug);
  });
}

/**
 * The hook shell.js's sidebar calls. Applying a sidebar link means replacing the
 * filter state with what that link encodes, exactly as if it had been followed.
 */
function applyQuery(query) {
  state.q = '';
  state.states.clear();
  state.passes.clear();
  state.features.clear();
  state.minVertical = 0;
  state.nightOnly = false;
  readParams(new URLSearchParams(query));
  syncControls();
  render();
  qs('#view').scrollTo({ top: 0 });
}

// --- URL round-trip ---------------------------------------------------------

function readParams(p) {
  if (p.has('q')) state.q = p.get('q').toLowerCase();
  p.get('state')?.split(',').filter(Boolean).forEach((s) => state.states.add(s));
  p.get('pass')?.split(',').filter(Boolean).forEach((s) => state.passes.add(s));
  p.get('feat')?.split(',').filter(Boolean).forEach((s) => { if (FEATURES[s]) state.features.add(s); });
  if (p.has('vert')) state.minVertical = Number(p.get('vert')) || 0;
  if (p.get('night') === '1') state.nightOnly = true;
  if (p.has('sort')) state.sortBy = p.get('sort');
  if (p.has('dir')) state.sortDir = p.get('dir') === 'asc' ? 'asc' : 'desc';
  if (p.has('view')) state.view = p.get('view') === 'cards' ? 'cards' : 'table';
  p.get('sel')?.split(',').filter(Boolean).slice(0, MAX_COMPARE)
    .forEach((s) => state.selected.add(s));
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.states.size) p.set('state', [...state.states].join(','));
  if (state.passes.size) p.set('pass', [...state.passes].join(','));
  if (state.features.size) p.set('feat', [...state.features].join(','));
  if (state.minVertical) p.set('vert', String(state.minVertical));
  if (state.nightOnly) p.set('night', '1');
  if (state.sortBy !== 'verticalDrop') p.set('sort', state.sortBy);
  if (state.sortDir !== 'desc') p.set('dir', state.sortDir);
  if (state.view !== 'table') p.set('view', state.view);
  if (state.selected.size) p.set('sel', [...state.selected].join(','));
  const query = p.toString();
  history.replaceState(null, '', query ? `?${query}` : location.pathname);
}

// --- forecasts --------------------------------------------------------------

/**
 * Fetched after the table is on screen, never before it. The sparkline column
 * has a fixed width and its bars have a reserved height, so filling 45 of them
 * in moves nothing.
 */
async function loadForecasts() {
  const withCoords = resorts.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  if (!withCoords.length) return;
  setLive('Loading forecast…', { tone: 'stale' });
  try {
    forecasts = await getForecasts(withCoords);
    const ok = [...forecasts.values()].filter((v) => v.status === 'ok').length;
    const stamp = [...forecasts.values()].find((v) => v.status === 'ok')?.data?.fetchedAt;
    setLive(ok
      ? `Forecast ${stamp ? relativeTime(stamp) : 'loaded'}`
      : 'Forecast unavailable', { tone: ok ? 'ok' : 'error' });
    render();
  } catch (e) {
    setLive('Forecast unavailable', { tone: 'error' });
  }
}

// --- boot -------------------------------------------------------------------

async function main() {
  await mountShell({
    page: 'resorts',
    breadcrumb: ['Guide', 'All resorts'],
    layout: 'app',
    actions: TOPBAR_ACTIONS,
  });

  const index = await getIndex();
  resorts = index.resorts ?? [];
  if (!resorts.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  readParams(new URLSearchParams(location.search));
  buildChips();
  wireControls();
  syncControls();
  qs('#toggle-filters')?.setAttribute('aria-expanded', 'false');
  if (isFiltered()) qs('#more-filters').hidden = false;
  render();
  setStatus('');

  window.__skiApplyQuery = applyQuery;
  loadForecasts();
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
