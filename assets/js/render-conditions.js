/**
 * render-conditions.js - every resort's summit forecast on one screen, ranked by
 * who is about to get the most snow.
 *
 * The contract this page keeps: one failed resort degrades to a single
 * "weather unavailable" row that still links to the official report, and the
 * rest of the table renders as normal. There is no state in which a network
 * problem produces a blank page.
 */

import { getIndex, getSnowReports, isReportUsable } from './data.js';
import { applyCanonical } from './seo.js';
import {
  getForecasts, clearForecastCache, conditionLabel, isSnowing,
  snowfallTotal, snowfallToday,
} from './weather.js';
import {
  el, fill, fmt, relativeTime, compareNullsLast, qs, qsa, setStatus, STATE_NAMES,
} from './util.js';
import { mountShell, setStatusStats, setLive } from './shell.js';
import { sparkline, peakDay } from './sparkline.js';

const COLUMNS = [
  { key: 'name', label: 'Resort', type: 'resort', w: '240px' },
  { key: 'town', label: 'Town', type: 'town', w: '210px', sortable: false },
  // The forecast columns stay contiguous so a row with no forecast can span
  // exactly them and still show its reported snow figures.
  { key: 'spark', label: '7-day snow', type: 'spark', num: true, w: '108px', group: 'forecast', sortKey: 'snow7d' },
  { key: 'snow24h', label: 'Next 24h', num: true, w: '82px', group: 'forecast' },
  { key: 'temp', label: 'Temp', num: true, w: '66px', group: 'forecast' },
  { key: 'wind', label: 'Wind', num: true, w: '86px', group: 'forecast' },
  { key: 'conditions', label: 'Conditions', type: 'text', w: '120px', sortable: false, group: 'forecast' },
  // Reported = what the resort itself published, fetched by tools/fetch-snow.mjs.
  { key: 'reportedNew24h', label: 'Reported 24h', num: true, w: '96px' },
  { key: 'baseDepth', label: 'Base', num: true, w: '72px' },
  { key: 'report', label: 'Report', type: 'report', w: '92px', sortable: false },
];

const FORECAST_COLSPAN = 5;

const state = { sortBy: 'snow7d', sortDir: 'desc', q: '', states: new Set() };

let resorts = [];
let forecasts = new Map();
let snowReports = {};

// --- shaping ----------------------------------------------------------------

/** Flattens a resort plus its forecast outcome into one row model. */
function rowModel(r) {
  // The snow report is independent of the forecast: a resort can have a good
  // report and a failed forecast, or the reverse.
  const rawReport = snowReports[r.slug] ?? null;
  const report = isReportUsable(rawReport) ? rawReport : null;

  const outcome = forecasts.get(r.slug);
  if (!outcome || outcome.status !== 'ok') {
    return { r, ok: false, report, reason: outcome?.reason ?? 'Forecast unavailable' };
  }
  const { current, days, fetchedAt, cached } = outcome.data;
  return {
    r,
    ok: true,
    report,
    reportedNew24h: typeof report?.newSnow24h === 'number' ? report.newSnow24h : null,
    baseDepth: typeof report?.baseDepth === 'number' ? report.baseDepth : null,
    fetchedAt,
    cached,
    days,
    snow7d: snowfallTotal(outcome.data),
    snow24h: snowfallToday(outcome.data),
    temp: Number.isFinite(current.temp) ? current.temp : null,
    wind: Number.isFinite(current.wind) ? current.wind : null,
    gust: Number.isFinite(current.gust) ? current.gust : null,
    code: current.code,
  };
}

function sortRows(rows) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    // Rows with no forecast always sit at the bottom, whichever way we sort.
    if (a.ok !== b.ok) return a.ok ? -1 : 1;

    const value = (row) => (state.sortBy === 'name'
      ? row.r.name
      : state.sortBy === 'verticalDrop'
        ? row.r.verticalDrop
        : row[state.sortBy] ?? null);

    const cmp = compareNullsLast(value(a), value(b), state.sortBy === 'name' ? 1 : dir);
    return cmp !== 0 ? cmp : a.r.name.localeCompare(b.r.name, 'en');
  });
}

// --- cells ------------------------------------------------------------------

const inches = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(v < 10 ? 1 : 0)}"`);

/** A snowfall figure with a proportional bar behind it, so the table scans. */
function snowCell(value, max, { emphasis = false } = {}) {
  if (value === null || value === undefined) {
    return el('td', { class: 'is-unknown' }, '—');
  }
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return el('td', { class: `wx-snowcell${value >= 1 && emphasis ? ' is-snowy' : ''}` },
    el('span', { class: 'wx-snowcell__bar', style: `width:${pct}%`, 'aria-hidden': 'true' }),
    el('span', { class: 'wx-snowcell__val' }, inches(value)));
}

function nameCell(r) {
  return el('td', { class: 'col-resort' },
    el('div', { class: 'ticker-row' },
      el('span', { class: 'tick-icon', 'aria-hidden': 'true' }, r.state),
      el('a', { class: 'ticker', href: `resort.html?r=${encodeURIComponent(r.slug)}` }, r.name)));
}

function townCell(r) {
  return el('td', { class: 'col-town' },
    el('span', { class: 'name-cell' },
      [r.town, STATE_NAMES[r.state] ?? r.state].filter(Boolean).join(', ')));
}

function reportCell(r) {
  if (!r.officialSnowReport) return el('td', { class: 'is-unknown' }, 'No link');
  return el('td', {},
    el('a', { class: 'report-link', href: r.officialSnowReport, rel: 'noopener' }, 'Report ↗'));
}

function row(model, peak) {
  const { r, report } = model;

  // Reported figures come from the resort's own report and are independent of
  // the forecast, so they render whether or not the forecast came back.
  const reportedCells = [
    reportedCell(model.reportedNew24h, report),
    reportedCell(model.baseDepth, report),
  ];

  if (!model.ok) {
    // Still a full row: name, town, reported figures and the link out. The table
    // never grows a hole because one request failed.
    return el('tr', { class: 'is-degraded' },
      nameCell(r),
      townCell(r),
      el('td', { class: 'is-unknown', colspan: String(FORECAST_COLSPAN) },
        'Weather unavailable — ', model.reason),
      ...reportedCells,
      reportCell(r));
  }

  return el('tr', { class: isSnowing(model.code) ? 'is-snowing' : '' },
    nameCell(r),
    townCell(r),
    el('td', { class: 'num col-spark' },
      sparkline(forecasts.get(r.slug), peak, model.snow7d)),
    el('td', { class: 'num' }, model.snow24h === null ? '—' : inches(model.snow24h)),
    el('td', { class: 'num' }, model.temp === null ? '—' : `${Math.round(model.temp)}°`),
    el('td', { class: 'num' },
      model.wind === null ? '—' : `${Math.round(model.wind)}`,
      model.gust !== null ? el('small', { class: 'is-unknown' }, ` g${Math.round(model.gust)}`) : null),
    el('td', {}, conditionLabel(model.code)),
    ...reportedCells,
    reportCell(r));
}

/** A figure from the resort's own report, stamped with when we fetched it. */
function reportedCell(value, report) {
  if (typeof value !== 'number') {
    return el('td', { class: 'is-unknown', title: 'No current report' }, '—');
  }
  return el('td', {
    class: 'num',
    title: `Resort report, fetched ${relativeTime(report?.fetchedAt)}`,
  }, inches(value));
}

// --- table ------------------------------------------------------------------

function headerRow() {
  return el('tr', {}, COLUMNS.map((col) => {
    const sortKey = col.sortKey ?? col.key;
    const isSort = state.sortBy === sortKey;
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
          if (state.sortBy === sortKey) {
            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = sortKey;
            state.sortDir = col.num ? 'desc' : 'asc';
          }
          syncControls();
          render();
        },
      }, col.label, isSort ? el('span', { class: 'th-arrow' }, state.sortDir === 'asc' ? '↑' : '↓') : null));
    }
    return th;
  }));
}

/** Name, town and former names — the same haystack the index searches. */
const haystack = (r) => `${r.name} ${r.town ?? ''} ${(r.aka ?? []).join(' ')}`.toLowerCase();

function matches(r) {
  if (state.q && !haystack(r).includes(state.q)) return false;
  if (state.states.size && !state.states.has(r.state)) return false;
  return true;
}

function render() {
  const models = resorts.filter(matches).map(rowModel);
  const peak = peakDay(forecasts, models.map((m) => m.r.slug));
  const ordered = sortRows(models);

  fill(qs('#conditions-table thead'), headerRow());
  fill(qs('#conditions-table tbody'), ordered.map((m) => row(m, peak)));

  const ok = models.filter((m) => m.ok);
  const failed = models.length - ok.length;
  const newest = ok.map((m) => m.fetchedAt).sort().at(-1);

  qs('#result-count').textContent = models.length === resorts.length
    ? `${resorts.length} mountains`
    : `${models.length} of ${resorts.length}`;

  const note = qs('#failure-note');
  note.hidden = failed === 0;
  if (failed) {
    note.textContent = failed === models.length
      ? 'No forecasts loaded. Open-Meteo may be rate limiting or unreachable; the official report links still work.'
      : `${failed} ${failed === 1 ? 'mountain' : 'mountains'} could not be forecast. Those rows link to the resort's own report instead.`;
  }

  renderStatusbar(models, ok, newest);
}

function renderStatusbar(models, ok, newest) {
  const totals = ok.map((m) => m.snow7d).filter((v) => typeof v === 'number');
  const deepest = ok
    .filter((m) => typeof m.snow7d === 'number')
    .sort((a, b) => b.snow7d - a.snow7d)[0];
  const snowing = ok.filter((m) => isSnowing(m.code)).length;
  const sum = totals.reduce((a, b) => a + b, 0);

  setStatusStats([
    { value: `${fmt(models.length)} ${models.length === 1 ? 'mountain' : 'mountains'}` },
    deepest && deepest.snow7d > 0
      ? {
        label: 'Most snow this week',
        value: `${deepest.r.name} ${inches(deepest.snow7d)}`,
        tone: 'up',
      }
      : { label: 'Most snow this week', value: 'nothing forecast' },
    sum > 0 ? { label: 'Region total', value: inches(sum) } : null,
    snowing ? { label: 'Snowing now', value: fmt(snowing), tone: 'up' } : null,
  ]);

  setLive(
    ok.length ? `Forecast ${relativeTime(newest)}` : 'Forecast unavailable',
    { tone: ok.length ? 'ok' : 'error' },
  );
}

function syncControls() {
  qsa('#filter-state .filter-tag').forEach((b) => {
    const pressed = b.dataset.value === '' ? state.states.size === 0 : state.states.has(b.dataset.value);
    b.setAttribute('aria-pressed', String(pressed));
  });
  qs('#sort-by').value = state.sortBy;
  const dir = qs('#sort-dir');
  dir.dataset.dir = state.sortDir;
  dir.textContent = state.sortDir === 'asc' ? '↑' : '↓';
  dir.setAttribute('aria-label', `Sort direction: ${state.sortDir === 'asc' ? 'low to high' : 'high to low'}`);
}

function buildStateTags() {
  const states = [...new Set(resorts.map((r) => r.state))].sort();
  fill(qs('#filter-state'), [
    el('button', {
      type: 'button', class: 'filter-tag', 'aria-pressed': 'true', dataset: { value: '' },
      onclick: () => { state.states.clear(); syncControls(); render(); },
    }, 'All'),
    ...states.map((code) => el('button', {
      type: 'button', class: 'filter-tag', 'aria-pressed': 'false', dataset: { value: code },
      title: STATE_NAMES[code] ?? code,
      onclick: () => {
        if (state.states.has(code)) state.states.delete(code);
        else state.states.add(code);
        syncControls();
        render();
      },
    }, code)),
  ]);
}

// --- boot -------------------------------------------------------------------

async function loadForecasts() {
  setStatus('Fetching forecasts…');
  forecasts = await getForecasts(resorts.map((r) => ({ slug: r.slug, lat: r.lat, lon: r.lon })));
  render();
  setStatus('');
}

async function main() {
  await mountShell({
    page: 'conditions',
    breadcrumb: ['Guide', 'Conditions'],
    layout: 'app',
    actions: [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: 'M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3',
        onClick: () => {
          clearForecastCache();
          loadForecasts().catch(() => setStatus('Could not refresh the forecast.', { error: true }));
        },
      },
      { separator: true },
      { label: 'All resorts', href: 'index.html', primary: true },
    ],
  });

  const [index, reports] = await Promise.all([getIndex(), getSnowReports()]);
  resorts = index.resorts ?? [];
  snowReports = reports?.reports ?? {};

  if (!resorts.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  buildStateTags();
  syncControls();

  // Drawn with every row already present, then the forecasts fill in. The page
  // is useful — names, towns, links to official reports — before a single
  // network call has come back.
  render();

  qs('#search').addEventListener('input', (e) => {
    state.q = e.target.value.trim().toLowerCase();
    render();
  });
  qs('#sort-by').addEventListener('change', (e) => { state.sortBy = e.target.value; render(); });
  qs('#sort-dir').addEventListener('click', () => {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    syncControls();
    render();
  });

  await loadForecasts();
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
