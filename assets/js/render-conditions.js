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
  el, fill, fmt, relativeTime, compareNullsLast, qs, setStatus, PASS_LABELS,
} from './util.js';
import { mountShell } from './shell.js';

const COLUMNS = [
  { key: 'name', label: 'Resort', cls: 'col-name', type: 'text' },
  { key: 'state', label: 'State', type: 'text', sortable: false },
  // Forecast columns are kept contiguous so a row with no forecast can span
  // exactly them and still show its reported snow figures.
  { key: 'snow7d', label: 'Forecast 7d', group: 'forecast' },
  { key: 'snow24h', label: 'Forecast 24h', group: 'forecast' },
  { key: 'temp', label: 'Temp', group: 'forecast' },
  { key: 'wind', label: 'Wind', group: 'forecast' },
  { key: 'conditions', label: 'Conditions', type: 'text', cls: 'col-text', sortable: false, group: 'forecast' },
  // Reported = what the resort itself published, fetched by tools/fetch-snow.mjs.
  { key: 'reportedNew24h', label: 'Reported 24h' },
  { key: 'baseDepth', label: 'Base' },
  { key: 'report', label: 'Official report', type: 'text', cls: 'col-text', sortable: false },
];

const FORECAST_COLSPAN = 5;

const state = { sortBy: 'snow7d', sortDir: 'desc' };

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
  return el('td', { class: 'col-name' },
    el('a', { href: `resort.html?r=${encodeURIComponent(r.slug)}` }, r.name));
}

function reportCell(r) {
  if (!r.officialSnowReport) return el('td', { class: 'col-text is-unknown' }, 'No link on record');
  return el('td', { class: 'col-text' },
    el('a', { href: r.officialSnowReport, rel: 'noopener' }, 'Official report ↗'));
}

function row(model, max) {
  const { r, report } = model;

  // Reported figures come from the resort's own report and are independent of
  // the forecast, so they render whether or not the forecast came back.
  const reportedCells = [
    reportedCell(model.reportedNew24h, report),
    reportedCell(model.baseDepth, report),
  ];

  if (!model.ok) {
    // Still a full row: name, state, reported figures and the link out. The
    // table never grows a hole because one request failed.
    return el('tr', { class: 'is-degraded' },
      nameCell(r),
      el('td', {}, r.state),
      el('td', { class: 'col-text is-unknown', colspan: String(FORECAST_COLSPAN) },
        'Weather unavailable — ', model.reason),
      ...reportedCells,
      reportCell(r));
  }

  return el('tr', { class: isSnowing(model.code) ? 'is-snowing' : '' },
    nameCell(r),
    el('td', {}, r.state),
    snowCell(model.snow7d, max, { emphasis: true }),
    snowCell(model.snow24h, max, { emphasis: true }),
    el('td', { class: 'num' }, model.temp === null ? '—' : `${Math.round(model.temp)}°`),
    el('td', { class: 'num' },
      model.wind === null ? '—' : `${Math.round(model.wind)}`,
      model.gust !== null ? el('small', { class: 'is-unknown' }, ` g${Math.round(model.gust)}`) : null),
    el('td', { class: 'col-text' }, conditionLabel(model.code)),
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
    const th = el('th', {
      scope: 'col',
      class: [col.cls, col.sortable === false ? '' : 'sortable'].filter(Boolean).join(' '),
    });
    if (state.sortBy === col.key) {
      th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
    }
    if (col.sortable === false) {
      th.append(el('span', {
        style: `display:block;padding:.6rem .8rem;text-align:${col.cls === 'col-text' ? 'left' : 'right'}`,
      }, col.label));
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
          qs('#sort-by').value = state.sortBy;
          qs('#sort-dir').value = state.sortDir;
          render();
        },
      }, col.label));
    }
    return th;
  }));
}

function render() {
  const models = resorts.map(rowModel);
  const max = Math.max(0, ...models.filter((m) => m.ok && m.snow7d !== null).map((m) => m.snow7d));
  const ordered = sortRows(models);

  fill(qs('#conditions-table thead'), headerRow());
  fill(qs('#conditions-table tbody'), ordered.map((m) => row(m, max)));

  const ok = models.filter((m) => m.ok);
  const failed = models.length - ok.length;
  const newest = ok.map((m) => m.fetchedAt).sort().at(-1);

  qs('#result-count').textContent = ok.length
    ? `${ok.length} of ${models.length} mountains · forecast as of ${relativeTime(newest)}`
    : `${models.length} mountains · no forecast data`;

  const note = qs('#failure-note');
  note.hidden = failed === 0;
  if (failed) {
    note.textContent = failed === models.length
      ? 'No forecasts loaded. Open-Meteo may be rate limiting or unreachable; the official report links still work.'
      : `${failed} ${failed === 1 ? 'mountain' : 'mountains'} could not be forecast. Those rows link to the resort's own report instead.`;
  }
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
  });

  const [index, reports] = await Promise.all([getIndex(), getSnowReports()]);
  resorts = index.resorts ?? [];
  snowReports = reports?.reports ?? {};

  if (!resorts.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  // Draw the table with every row already present, then fill in the forecasts.
  // The page is useful - names, states, links to official reports - before a
  // single network call has come back.
  render();

  qs('#sort-by').addEventListener('change', (e) => { state.sortBy = e.target.value; render(); });
  qs('#sort-dir').addEventListener('change', (e) => { state.sortDir = e.target.value; render(); });
  qs('#refresh').addEventListener('click', () => {
    clearForecastCache();
    loadForecasts().catch(() => setStatus('Could not refresh the forecast.', { error: true }));
  });

  await loadForecasts();
}

main().catch((e) => setStatus(`Could not load resorts: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
