/**
 * render-compare.js — two to four mountains side by side, deep-linkable as
 * ?r=killington,sugarbush,jay-peak.
 *
 * Two things this page refuses to be:
 *
 *  1. A spreadsheet. A table of vertical drops cannot tell you that Okemo grooms
 *     everything and Mad River Glen grooms almost nothing, which is the entire
 *     reason somebody would pick one over the other. So the numbers table is
 *     followed by the editorial fields — difficulty, crowds, snow quality, the
 *     mogul policy, the parks — laid out in the same column order.
 *  2. A scoreboard. Rows are highlighted for the largest value (or the smallest
 *     price), and the legend says out loud that largest is not the same as best.
 *     Rows where "winning" is meaningless — terrain split, night skiing, which
 *     pass — carry no highlight at all.
 *
 * Unlike the index, this page reads whole resort files rather than the generated
 * manifest, because the editorial prose is not in the manifest and never will be
 * — putting it there would make index.json enormous for the sake of one page
 * that loads at most four records.
 */

import { getIndex, getResort } from './data.js';
import { applyCanonical } from './seo.js';
import {
  el, fill, fmt, money, qs, setStatus, STATE_NAMES, PASS_LABELS,
} from './util.js';
import { mountShell } from './shell.js';

const MAX = 4;
const MIN = 2;
const PASS_ORDER = ['epic', 'ikon', 'indy', 'other', 'none'];
const MOGUL_RANK = { none: 0, rare: 1, occasional: 2, common: 3, signature: 4 };
const MOGUL_SHORT = {
  signature: 'Signature', common: 'Common', occasional: 'Occasional',
  rare: 'Rare', none: 'None',
};

/** One slot per column. A null slot renders an empty picker. */
let slots = [];
let index = [];
const loaded = new Map(); // slug -> full resort record

// --- rows -------------------------------------------------------------------

/**
 * `best` is the direction that wins the highlight, or null where the question is
 * meaningless. Note that `high` on `mogulPresence` means "most bumps", not
 * "best mountain" — the legend is explicit about that distinction.
 */
const ROWS = [
  { group: 'Size' },
  { label: 'Vertical drop', get: (r) => r.size?.verticalDrop, unit: ' ft', best: 'high' },
  { label: 'Skiable acres', get: (r) => r.size?.skiableAcres, best: 'high' },
  { label: 'Trails', get: (r) => r.size?.trailCount, best: 'high' },
  { label: 'Lifts', get: (r) => r.size?.liftCount, best: 'high' },
  { label: 'Longest run', get: (r) => r.size?.longestRun, unit: ' mi', digits: 1, best: 'high' },
  { label: 'Summit', get: (r) => r.size?.summitElevation, unit: ' ft', best: 'high' },
  { label: 'Base', get: (r) => r.size?.baseElevation, unit: ' ft', best: null },

  { group: 'Snow' },
  { label: 'Average snowfall', get: (r) => r.size?.annualSnowfallAvg, unit: '"', best: 'high' },
  { label: 'Snowmaking coverage', get: (r) => r.size?.snowmakingPercent, unit: '%', best: 'high' },

  { group: 'Terrain' },
  { label: 'Difficulty split', type: 'terrain', best: null },
  // Boolean by schema §1.6 — marketed gladed terrain, not an acreage, so nothing wins it.
  { label: 'Marketed glades', get: (r) => r.terrain?.glades, best: null },
  { label: 'Bumps', type: 'moguls', best: 'high' },
  { label: 'Terrain parks', get: (r) => r.parks?.count, best: 'high' },
  { label: 'Halfpipe', type: 'pipe', best: null },
  { label: 'Night skiing', get: (r) => r.size?.nightSkiing, best: null },

  { group: 'Getting on the lift' },
  { label: 'Pass', type: 'passes', best: null },
  { label: 'Advance day ticket', get: (r) => r.pricing?.advanceTypical, type: 'money', best: 'low' },
  { label: 'Adult season pass', get: (r) => r.pricing?.seasonPassAdult, type: 'money', best: 'low' },
];

/** The comparable number behind a row, or null. Nulls never win. */
function rowValue(row, r) {
  if (row.type === 'moguls') return MOGUL_RANK[r.moguls?.presence] ?? null;
  const v = row.get?.(r);
  return typeof v === 'number' ? v : null;
}

function winners(row, records) {
  if (!row.best) return new Set();
  const values = records.map((r) => rowValue(row, r)).filter((v) => v !== null);
  if (values.length < 2) return new Set(); // nothing to win against
  const target = row.best === 'high' ? Math.max(...values) : Math.min(...values);
  // Every tied column is highlighted; a tie is a real answer, not a coin toss.
  const set = new Set();
  records.forEach((r, i) => { if (rowValue(row, r) === target) set.add(i); });
  return set.size === records.filter((r) => rowValue(row, r) !== null).length ? new Set() : set;
}

// --- cell renderers ---------------------------------------------------------

function terrainBar(r) {
  const t = r.terrain ?? {};
  const parts = [
    ['beginner', t.percentBeginner],
    ['intermediate', t.percentIntermediate],
    ['advanced', t.percentAdvanced],
    ['expert', t.percentExpert],
  ].filter(([, v]) => typeof v === 'number' && v > 0);
  if (!parts.length) return el('span', { class: 'is-unknown' }, '—');
  return el('div', {},
    el('div', { class: 'terrain-bar', role: 'img',
      'aria-label': parts.map(([k, v]) => `${v}% ${k}`).join(', ') },
    parts.map(([kind, v]) => el('span', {
      style: `flex:${v};background:var(--diff-${kind})`,
    }))),
    el('p', { class: 'vs-terrain__legend' },
      parts.map(([kind, v]) => el('span', {},
        el('i', { style: `background:var(--diff-${kind})` }), `${v}%`))));
}

function pipeCell(r) {
  const v = r.parks?.pipe;
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return el('span', { class: 'is-unknown', title: 'Not sourced' }, '—');
}

function passCell(r) {
  const list = r.passes ?? [];
  if (!list.length) return el('span', { class: 'is-unknown' }, '—');
  const seen = new Set();
  return el('ul', { class: 'pass-list' }, list
    .filter((p) => p.type && !seen.has(p.type) && seen.add(p.type))
    .sort((a, b) => PASS_ORDER.indexOf(a.type) - PASS_ORDER.indexOf(b.type))
    .map((p) => el('li', {}, el('span', {
      class: `pass pass--${p.type}`,
      title: p.access ? `${p.name} — ${p.access}` : p.name,
    }, PASS_LABELS[p.type] ?? p.type))));
}

function mogulCell(r) {
  const p = r.moguls?.presence;
  if (!p) return el('span', { class: 'is-unknown' }, '—');
  return el('span', { class: `presence__badge presence__badge--${p}` }, MOGUL_SHORT[p] ?? p);
}

function plainCell(row, r) {
  const v = row.get?.(r);
  if (v === null || v === undefined) {
    return el('span', { class: 'is-unknown', title: 'Not sourced' }, '—');
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (row.type === 'money') return money(v);
  return `${fmt(v, { digits: row.digits ?? 0 })}${row.unit ?? ''}`;
}

function cellBody(row, r) {
  if (row.type === 'terrain') return terrainBar(r);
  if (row.type === 'passes') return passCell(r);
  if (row.type === 'moguls') return mogulCell(r);
  if (row.type === 'pipe') return pipeCell(r);
  return plainCell(row, r);
}

// --- the numbers table ------------------------------------------------------

function renderTable(records) {
  // Fixed table layout needs a floor, or four columns at 360px are unreadable.
  // Below this the surrounding .table-scroll takes over and scrolls sideways,
  // which is the documented behaviour for every wide table on this site.
  qs('#compare-table').style.minWidth = `${10 + records.length * 8}rem`;

  fill(qs('#compare-table thead'),
    el('tr', {},
      // The corner cell. Empty to a sighted reader, but a screen reader
      // announces every column header, so it needs a name.
      el('th', { scope: 'col', class: 'col-name' },
        el('span', { class: 'visually-hidden' }, 'Statistic')),
      records.map((r) => el('th', { scope: 'col', class: 'vs-head' },
        el('a', { href: `resort.html?r=${encodeURIComponent(r.identity.slug)}` }, r.identity.name),
        el('small', {}, [r.identity.town, r.identity.state].filter(Boolean).join(', '))))));

  const body = [];
  for (const row of ROWS) {
    if (row.group) {
      body.push(el('tr', { class: 'vs-group' },
        el('th', { scope: 'colgroup', colspan: records.length + 1, class: 'col-name' }, row.group)));
      continue;
    }
    const win = winners(row, records);
    body.push(el('tr', {},
      el('th', { scope: 'row', class: 'col-name' }, row.label),
      records.map((r, i) => el('td', {
        class: [
          row.type === 'terrain' || row.type === 'passes' ? 'col-text' : '',
          win.has(i) ? 'is-winner' : '',
        ].filter(Boolean).join(' '),
      },
      cellBody(row, r),
      win.has(i)
        ? el('span', { class: 'visually-hidden' },
          row.best === 'low' ? ' (lowest in this row)' : ' (highest in this row)')
        : null))));
  }
  fill(qs('#compare-table tbody'), body);
}

// --- the editorial columns --------------------------------------------------

function prose(title, text) {
  if (!text) return null;
  return el('div', { class: 'vs-prose' },
    el('h4', {}, title),
    el('p', {}, text));
}

function chips(title, items, modifier) {
  if (!items?.length) return null;
  return el('div', { class: 'vs-prose' },
    el('h4', {}, title),
    el('ul', { class: 'pill-list' },
      items.map((t) => el('li', { class: `pill ${modifier}` }, t))));
}

function parksBlock(r) {
  const p = r.parks ?? {};
  if (p.count === null || p.count === undefined) {
    return el('div', { class: 'vs-prose' },
      el('h4', {}, 'Parks'),
      el('p', { class: 'is-unknown' }, 'Park count not sourced.'));
  }
  const named = (p.parks ?? []).filter((x) => x?.name);
  return el('div', { class: 'vs-prose' },
    el('h4', {}, 'Parks'),
    el('p', {},
      p.count === 0 ? 'No terrain parks.' : `${fmt(p.count)} ${p.count === 1 ? 'park' : 'parks'}`,
      p.pipe === true ? ', including a halfpipe.' : p.count === 0 ? '' : '.'),
    named.length
      ? el('ul', { class: 'vs-parklist' }, named.map((x) => el('li', {},
        el('b', {}, x.name),
        x.size ? el('span', { class: `park__size park__size--${x.size}` }, x.size) : null)))
      : null,
    p.count > 0 && !named.length
      ? el('p', { class: 'is-unknown' }, 'The resort states a count but does not name them.')
      : null);
}

function editorialColumn(r) {
  const e = r.editorial ?? {};
  const m = r.moguls ?? {};
  return el('article', { class: 'vs-col' },
    el('h3', {},
      el('a', { href: `resort.html?r=${encodeURIComponent(r.identity.slug)}` }, r.identity.name)),
    el('p', { class: 'vs-col__where' },
      [r.identity.town, STATE_NAMES[r.identity.state] ?? r.identity.state]
        .filter(Boolean).join(', ')),

    prose('Difficulty', e.difficulty),
    prose('Crowds', e.crowds),
    prose('Snow quality', e.snowQuality),

    el('div', { class: 'vs-prose' },
      el('h4', {}, 'Bumps'),
      el('p', {},
        el('span', { class: `presence__badge presence__badge--${m.presence ?? 'none'}` },
          MOGUL_SHORT[m.presence] ?? '—'),
        m.quality ? ` ${m.quality}` : m.policy ? ` ${m.policy}` : null)),

    parksBlock(r),

    chips('Best for', e.bestFor, 'pill--good'),
    chips('Watch out for', e.watchOutFor, 'pill--bad'),

    el('p', { class: 'vs-col__more' },
      el('a', { href: `resort.html?r=${encodeURIComponent(r.identity.slug)}` },
        `Everything on ${r.identity.name} →`)));
}

// --- picker -----------------------------------------------------------------

function buildPicker() {
  const options = [...index].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  fill(qs('#compare-picker'), Array.from({ length: MAX }, (_, i) => {
    const id = `slot-${i}`;
    const select = el('select', {
      id,
      onchange: (e) => {
        const value = e.target.value || null;
        const dupe = value ? slots.findIndex((s, j) => j !== i && s === value) : -1;
        const previous = slots[i];
        slots[i] = value;
        // Picking a mountain that already occupies another column swaps the two
        // rather than quietly deleting the one you had. Reordering columns is a
        // thing people do; losing a pick to do it is not.
        if (dupe !== -1) slots[dupe] = previous;
        writeUrl();
        render();
      },
    },
    el('option', { value: '' }, i < MIN ? 'Choose a mountain…' : 'Add a mountain…'),
    options.map((r) => el('option', { value: r.slug }, `${r.name} (${r.state})`)));
    select.value = slots[i] ?? '';
    return el('div', { class: 'field' },
      el('label', { class: 'label', for: id }, `Mountain ${i + 1}`),
      select);
  }));
}

function syncPicker() {
  slots.forEach((slug, i) => {
    const select = qs(`#slot-${i}`);
    if (select) select.value = slug ?? '';
  });
}

// --- URL --------------------------------------------------------------------

function chosen() {
  return slots.filter(Boolean);
}

function readUrl() {
  const raw = (new URLSearchParams(location.search).get('r') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const valid = [];
  for (const slug of raw) {
    if (valid.length >= MAX) break;
    if (valid.includes(slug)) continue;
    if (index.some((r) => r.slug === slug)) valid.push(slug);
  }
  slots = Array.from({ length: MAX }, (_, i) => valid[i] ?? null);
}

function writeUrl() {
  const list = chosen();
  const query = list.length ? `?r=${list.map(encodeURIComponent).join(',')}` : '';
  history.replaceState(null, '', query || location.pathname);
}

// --- render -----------------------------------------------------------------

async function render() {
  const list = chosen();
  syncPicker();

  const count = qs('#result-count');
  const numbers = qs('#numbers');
  const editorial = qs('#editorial');
  const empty = qs('#empty');

  qs('#clear-all').hidden = list.length === 0;

  if (list.length < MIN) {
    numbers.hidden = true;
    editorial.hidden = true;
    empty.hidden = false;
    count.textContent = list.length === 1
      ? 'One picked — choose at least one more'
      : `${index.length} mountains to choose from`;
    return;
  }

  count.textContent = `Comparing ${list.length} mountains`;
  setStatus('Loading the full records…');

  const records = await Promise.all(list.map(async (slug) => {
    if (!loaded.has(slug)) loaded.set(slug, await getResort(slug));
    return loaded.get(slug);
  }));

  renderTable(records);
  fill(qs('#editorial-grid'), records.map(editorialColumn));
  qs('#editorial-grid').style.setProperty('--vs-cols', String(records.length));

  numbers.hidden = false;
  editorial.hidden = false;
  empty.hidden = true;
  setStatus('');
}

// --- boot -------------------------------------------------------------------

async function main() {
  await mountShell({
    page: 'compare',
    breadcrumb: ['Guide', 'Compare'],
    layout: 'app',
  });

  const manifest = await getIndex();
  index = manifest.resorts ?? [];
  if (!index.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  readUrl();
  buildPicker();

  qs('#clear-all').addEventListener('click', () => {
    slots = Array.from({ length: MAX }, () => null);
    writeUrl();
    render();
  });

  // Back and forward through comparisons behave the way the URL implies.
  window.addEventListener('popstate', () => { readUrl(); render(); });

  await render();
  setStatus('');
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
// `?r=` here is view state as far as a crawler is concerned: robots.txt disallows
// the parameterised form, so the canonical must be the bare page or the two
// signals contradict each other.
applyCanonical([]);
