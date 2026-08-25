/**
 * render-resort.js - detail page for resort.html?r=<slug>.
 *
 * Renders every section of the schema. A section whose data is entirely null is
 * omitted, never rendered empty - a null means "we could not source this", and a
 * heading over an em dash tells the reader nothing they want to know. Individual
 * nulls inside an otherwise-populated table do show as an em dash, because there
 * the absence is informative against its neighbours.
 */

import {
  getIndex, getResort, getSnowReport, isReportUsable, reportUnavailableReason,
} from './data.js';
import { getForecast, conditionLabel, isSnowing, snowfallTotal } from './weather.js';
import {
  el, fill, fmt, money, formatDate, relativeTime, param, setStatus,
  STATE_NAMES, PASS_LABELS,
} from './util.js';
import { suggestResorts, tokens } from './suggest.js';

const has = (v) => v !== null && v !== undefined && v !== '';
const hasAny = (...vals) => vals.some(has);

/** A titled block. Returns null when `body` is empty, so callers can just spread. */
function section(title, ...body) {
  const children = body.flat(Infinity).filter(Boolean);
  if (!children.length) return null;
  return el('section', { class: 'section' },
    el('div', { class: 'shell' },
      title ? el('h2', {}, title) : null,
      ...children));
}

function prose(heading, text, modifier = '') {
  if (!has(text)) return null;
  return el('div', { class: `prose ${modifier}`.trim() },
    heading ? el('h3', {}, heading) : null,
    ...String(text).split(/\n\s*\n/).map((para) => el('p', {}, para)));
}

/** Rows whose value is null are dropped entirely rather than shown as dashes. */
function dataTable(rows) {
  const live = rows.filter(([, value]) => has(value));
  if (!live.length) return null;
  return el('table', { class: 'data' },
    el('tbody', {}, live.map(([label, value]) =>
      el('tr', {},
        el('th', { scope: 'row' }, label),
        el('td', {}, value)))));
}

// --- head -------------------------------------------------------------------

function head(r) {
  const { identity: id, passes, links } = r;
  const seen = new Set();

  return el('div', { class: 'shell resort-head' },
    el('div', { class: 'resort-head__eyebrow' },
      el('span', { class: 'label' },
        [id.town, STATE_NAMES[id.state] ?? id.state].filter(Boolean).join(', ')),
      el('ul', { class: 'pass-list' },
        passes.filter((p) => p.type && !seen.has(p.type) && seen.add(p.type))
          .map((p) => el('li', {}, el('span', {
            class: `pass pass--${p.type}`,
            title: p.access,
          }, PASS_LABELS[p.type] ?? p.type))))),

    el('h1', {}, id.name),

    id.aka?.length ? el('p', { class: 'resort-head__aka' }, `Also known as ${id.aka.join(', ')}`) : null,

    el('p', { class: 'resort-head__links' },
      has(id.website) ? el('a', { href: id.website, rel: 'noopener' }, 'Official site ↗') : null,
      has(links.officialSnowReport)
        ? el('a', { href: links.officialSnowReport, rel: 'noopener' }, 'Snow report ↗') : null,
      has(links.trailMap) ? el('a', { href: links.trailMap, rel: 'noopener' }, 'Trail map ↗') : null,
      has(links.webcams) ? el('a', { href: links.webcams, rel: 'noopener' }, 'Webcams ↗') : null),

    statbar(r));
}

function statbar(r) {
  const s = r.size;
  const stats = [
    ['Vertical drop', s.verticalDrop, ' ft'],
    ['Skiable acres', s.skiableAcres, ''],
    ['Trails', s.trailCount, ''],
    ['Lifts', s.liftCount, ''],
    ['Annual snowfall', s.annualSnowfallAvg, ' in'],
    ['Snowmaking', s.snowmakingPercent, '%'],
  ].filter(([, value]) => has(value));

  if (!stats.length) return null;

  return el('dl', { class: 'statbar' },
    stats.map(([label, value, unit]) =>
      el('div', {},
        el('dt', {}, label),
        el('dd', {}, fmt(value), unit ? el('small', {}, unit) : null))));
}

// --- live panels -------------------------------------------------------------

function livePanels(r) {
  return el('div', { class: 'panels' },
    el('div', { class: 'panel', id: 'weather-panel' },
      el('div', { class: 'panel__head' },
        el('h3', {}, 'Weather at the summit'),
        el('span', { class: 'panel__stamp', id: 'weather-stamp' })),
      el('div', { class: 'panel__body', id: 'weather-body' },
        el('p', { class: 'is-unknown' }, 'Loading forecast…'))),

    el('div', { class: 'panel', id: 'snow-panel' },
      el('div', { class: 'panel__head' },
        el('h3', {}, 'Snow report'),
        el('span', { class: 'panel__stamp', id: 'snow-stamp' })),
      el('div', { class: 'panel__body', id: 'snow-body' },
        el('p', { class: 'is-unknown' }, 'Loading report…'))));
}

const DAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

function dayName(iso, index) {
  if (index === 0) return 'Today';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DAY_FMT.format(d);
}

/** The seven-day strip. Snow is the only figure given emphasis. */
function forecastStrip(days) {
  return el('ol', { class: 'wx-strip' }, days.map((d, i) => {
    const snowy = Number.isFinite(d.snow) && d.snow >= 0.1;
    return el('li', { class: `wx-day${snowy ? ' is-snowy' : ''}` },
      el('span', { class: 'wx-day__name' }, dayName(d.date, i)),
      el('span', {
        class: 'wx-day__icon',
        title: conditionLabel(d.code),
        'aria-hidden': 'true',
      }, glyph(d.code)),
      el('span', { class: 'wx-day__temps' },
        el('b', {}, Number.isFinite(d.high) ? `${Math.round(d.high)}°` : '—'),
        ' ',
        el('span', {}, Number.isFinite(d.low) ? `${Math.round(d.low)}°` : '—')),
      el('span', { class: 'wx-day__snow' },
        snowy ? `${d.snow.toFixed(d.snow < 10 ? 1 : 0)}"` : '—'));
  }));
}

/** A text glyph rather than an icon file - nothing to load, scales with type. */
function glyph(code) {
  if (code === null || code === undefined) return '·';
  if (isSnowing(code)) return '❄';
  if ([0, 1].includes(code)) return '☀';
  if ([2, 3].includes(code)) return '☁';
  if ([45, 48].includes(code)) return '≡';
  if (code >= 95) return '⚡';
  return '☂';
}

function renderWeather(r, outcome) {
  const body = document.getElementById('weather-body');
  const stamp = document.getElementById('weather-stamp');
  const panel = document.getElementById('weather-panel');
  if (!body) return;

  if (!outcome || outcome.status !== 'ok') {
    panel.classList.add('panel--pending');
    stamp.textContent = '';
    fill(body,
      el('p', {}, 'Weather unavailable — ', outcome?.reason ?? 'the forecast could not be loaded', '.'),
      el('p', { class: 'is-unknown' }, 'Open-Meteo may be rate limiting or offline. Reload to try again.'));
    return;
  }

  const { current, days, elevation } = outcome.data;
  const total = snowfallTotal(outcome.data);

  stamp.textContent = outcome.data.cached
    ? `cached ${relativeTime(outcome.data.fetchedAt)}`
    : `as of ${relativeTime(outcome.data.fetchedAt)}`;

  fill(body,
    el('div', { class: 'wx-now' },
      el('div', { class: 'wx-now__temp' },
        Number.isFinite(current.temp) ? `${Math.round(current.temp)}°` : '—',
        el('small', {}, 'F')),
      el('div', { class: 'wx-now__meta' },
        el('strong', {}, conditionLabel(current.code)),
        el('span', {},
          Number.isFinite(current.wind) ? `Wind ${Math.round(current.wind)} mph` : 'Wind —',
          Number.isFinite(current.gust) ? `, gusting ${Math.round(current.gust)}` : ''),
        Number.isFinite(current.feelsLike)
          ? el('span', {}, `Feels like ${Math.round(current.feelsLike)}°`)
          : null)),

    total !== null
      ? el('p', { class: `wx-total${total >= 1 ? ' is-snowy' : ''}` },
          el('b', {}, `${total.toFixed(total < 10 ? 1 : 0)}"`),
          ' forecast over the next 7 days')
      : null,

    forecastStrip(days),

    el('p', { class: 'provenance' },
      'Forecast for the summit',
      Number.isFinite(elevation) ? ` at ${fmt(Math.round(elevation * 3.28084))} ft` : '',
      ' · ',
      el('a', { href: 'https://open-meteo.com/', rel: 'noopener' }, 'Open-Meteo')));
}

/** One figure in the report grid. Nulls are dropped, not dashed. */
function reportStat(label, value, unit = '') {
  if (typeof value !== 'number') return null;
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return el('div', {},
    el('dt', {}, label),
    el('dd', {}, shown, unit ? el('small', {}, unit) : null));
}

function renderSnowReport(r, report) {
  const body = document.getElementById('snow-body');
  const stamp = document.getElementById('snow-stamp');
  const panel = document.getElementById('snow-panel');
  if (!body) return;

  const official = r.links.officialSnowReport;
  const officialLink = has(official)
    ? el('a', { href: official, rel: 'noopener' }, "the resort's official report ↗")
    : null;

  // Missing, errored, out of season, or older than 24 hours: the link, never
  // stale numbers presented as today's.
  if (!isReportUsable(report)) {
    panel.classList.add('panel--pending');
    stamp.textContent = report?.fetchedAt ? `checked ${relativeTime(report.fetchedAt)}` : '';
    fill(body,
      el('p', {}, reportUnavailableReason(report), '.'),
      officialLink
        ? el('p', {}, 'For live numbers, go straight to ', officialLink, '.')
        : el('p', { class: 'is-unknown' }, 'No official report URL on record for this mountain.'));
    return;
  }

  panel.classList.remove('panel--pending');
  stamp.textContent = `as of ${relativeTime(report.fetchedAt)}`;

  const stats = [
    reportStat('New 24h', report.newSnow24h, '"'),
    reportStat('New 48h', report.newSnow48h, '"'),
    reportStat('New 7d', report.newSnow7d, '"'),
    reportStat('Base', report.baseDepth, '"'),
    reportStat('Season', report.seasonTotal, '"'),
  ].filter(Boolean);

  const openOf = (open, total) => {
    if (typeof open !== 'number') return null;
    return typeof total === 'number' ? `${open} / ${total}` : String(open);
  };

  fill(body,
    stats.length ? el('dl', { class: 'report-grid' }, stats) : null,

    dataTable([
      ['Trails open', openOf(report.trailsOpen, report.trailsTotal)],
      ['Lifts open', openOf(report.liftsOpen, report.liftsTotal)],
      ['Acres open', typeof report.acresOpen === 'number' ? fmt(report.acresOpen) : null],
      ['Surface', report.surface],
    ]),

    el('p', { class: 'provenance' },
      report.lastUpdated
        ? `Resort reported ${relativeTime(report.lastUpdated)} · `
        : '',
      officialLink ?? 'No source link on record',
      report.tier ? ` · via ${report.tier}` : ''));
}

async function loadSnowReport(r) {
  const report = await getSnowReport(r.identity.slug);
  renderSnowReport(r, report);
}

/** Fired after the page paints, so a slow forecast never delays the article. */
async function loadWeather(r) {
  const outcome = await getForecast({
    slug: r.identity.slug, lat: r.identity.lat, lon: r.identity.lon,
  });
  renderWeather(r, outcome);
}


// --- fieldNotes and dataDisputes (schema.md §12, §13) ----------------------

/** The fieldNote for a dotted path, or null. */
const noteFor = (r, path) => r.fieldNotes?.[path] ?? null;

/**
 * A field with status "absent" is a fact, not a gap: we checked and the resort
 * genuinely does not have it. It renders as a definite statement rather than
 * being omitted, which is the entire reason the status exists.
 */
function absentRow(r, path, label, phrasing) {
  const note = noteFor(r, path);
  if (!note || note.status !== 'absent') return null;
  return [label, el('span', { class: 'stated-absent', title: note.note ?? '' },
    phrasing,
    note.source
      ? el('a', { class: 'stated-absent__src', href: note.source, rel: 'noopener' }, 'source')
      : null)];
}

/** Disputes attached to any field inside `group`. */
const disputesIn = (r, group) =>
  (r.dataDisputes ?? []).filter((d) => typeof d.field === 'string' && d.field.startsWith(`${group}.`));

const FIELD_LABELS = {
  'terrain.percentBeginner': 'beginner terrain',
  'terrain.percentIntermediate': 'intermediate terrain',
  'terrain.percentAdvanced': 'advanced terrain',
  'terrain.percentExpert': 'expert terrain',
  'size.annualSnowfallAvg': 'annual snowfall',
  'size.skiableAcres': 'skiable acres',
  'size.verticalDrop': 'vertical drop',
  'size.trailCount': 'trail count',
};

/** "The resort says X, independent sources say Y" - never buried in prose. */
function disputeCallout(dispute) {
  const label = FIELD_LABELS[dispute.field] ?? dispute.field;
  const unit = dispute.field.startsWith('terrain.percent') ? '%' : '';
  return el('aside', { class: 'dispute' },
    el('p', { class: 'dispute__head' }, 'We disagree with this figure'),
    el('p', { class: 'dispute__claims' },
      'On ', el('b', {}, label), ' the resort says ',
      el('b', { class: 'dispute__resort' }, `${dispute.resortClaim}${unit}`),
      '; ',
      el('a', { href: dispute.independentSource, rel: 'noopener' }, 'independent figures'),
      ' say ',
      el('b', { class: 'dispute__independent' }, `${dispute.independentClaim}${unit}`),
      '.'),
    el('p', { class: 'dispute__note' }, dispute.note));
}

// --- terrain ----------------------------------------------------------------

const TIERS = [
  ['percentBeginner', 'Beginner', 'var(--diff-beginner)'],
  ['percentIntermediate', 'Intermediate', 'var(--diff-intermediate)'],
  ['percentAdvanced', 'Advanced', 'var(--diff-advanced)'],
  ['percentExpert', 'Expert', 'var(--diff-expert)'],
];

function terrainBreakdown(t) {
  const tiers = TIERS.filter(([key]) => has(t[key]));
  if (!tiers.length) return null;
  const total = tiers.reduce((sum, [key]) => sum + t[key], 0);

  return [
    el('div', {
      class: 'terrain-bar',
      role: 'img',
      'aria-label': tiers.map(([key, label]) => `${label} ${t[key]}%`).join(', '),
    }, tiers.map(([key, , colour]) =>
      el('span', { style: `width:${(t[key] / total) * 100}%;background:${colour}` }))),

    el('ul', { class: 'terrain-key' }, tiers.map(([key, label, colour]) =>
      el('li', {},
        el('i', { style: `background:${colour}` }),
        label, ' ', el('b', {}, `${t[key]}%`)))),
  ];
}

function terrainSection(r) {
  const t = r.terrain;
  const features = dataTable([
    ['Glades', has(t.glades) ? (t.glades ? 'Yes' : 'No') : null],
    // Checked and confirmed: say so outright rather than dropping the row.
    absentRow(r, 'size.nightSkiing', 'Night skiing', 'None — confirmed ') ??
      ['Night skiing', has(r.size.nightSkiing) ? (r.size.nightSkiing ? 'Yes' : 'No') : null],
    ['Longest run', has(r.size.longestRun) ? `${fmt(r.size.longestRun, { digits: 1 })} mi` : null],
    ['Summit', has(r.size.summitElevation) ? `${fmt(r.size.summitElevation)} ft` : null],
    ['Base', has(r.size.baseElevation) ? `${fmt(r.size.baseElevation)} ft` : null],
  ]);

  const bar = terrainBreakdown(t);
  const disputes = disputesIn(r, 'terrain');
  if (!bar && !features && !has(t.difficultyNotes) && !disputes.length) return null;

  return section('Terrain',
    el('div', { class: 'twocol' },
      el('div', {},
        bar ?? el('p', { class: 'is-unknown' }, 'No published difficulty split.'),
        disputes.map(disputeCallout)),
      features),
    has(t.difficultyNotes) ? el('p', { class: 'note' }, t.difficultyNotes) : null,
    provenance(t));
}


// --- moguls and parks (schema.md 14, 15) -----------------------------------

const MOGUL_PRESENCE_LABEL = {
  signature: 'A defining feature',
  common: 'Common',
  occasional: 'Occasional',
  rare: 'Rare',
  none: 'None',
};

const DIFFICULTY_LABEL = {
  green: 'Green',
  blue: 'Blue',
  black: 'Black',
  'double-black': 'Double black',
  'triple-black': 'Triple black',
};

const RELIABILITY_LABEL = {
  reliable: 'Reliably bumped',
  'late-season': 'Late season only',
  variable: 'Depends on grooming',
};

/** The named trails that bump up - the whole reason this section exists. */
function namedRunList(runs) {
  if (!runs?.length) return null;
  return el('ul', { class: 'trails bump-runs' }, runs.map((r) =>
    el('li', {},
      el('h3', {},
        r.name,
        el('span', { class: `bump-tag bump-tag--${r.difficulty}` }, DIFFICULTY_LABEL[r.difficulty] ?? r.difficulty),
        el('span', { class: `bump-rel bump-rel--${r.reliability}` }, RELIABILITY_LABEL[r.reliability] ?? r.reliability)),
      el('p', {}, r.note))));
}

function mogulsSection(r) {
  const m = r.moguls;
  if (!m) return null;

  const runs = namedRunList(m.namedRuns);
  const prose = [
    ['Grooming policy', m.policy],
    ['What the bumps are like', m.quality],
    ['When they are good', m.bestTiming],
    ['Bump scene', m.bumpCulture],
  ].filter(([, v]) => has(v));

  if (!runs && !prose.length && !has(m.presence)) return null;

  return section('Moguls',
    el('p', { class: 'presence' },
      el('span', { class: `presence__badge presence__badge--${m.presence}` },
        MOGUL_PRESENCE_LABEL[m.presence] ?? m.presence),
      m.namedRuns?.length
        ? `${m.namedRuns.length} named bump ${m.namedRuns.length === 1 ? 'run' : 'runs'}`
        : 'No bump runs recorded'),
    runs,
    prose.length
      ? el('div', { class: 'prose-grid' }, prose.map(([label, text]) => prose2(label, text)))
      : null,
    provenance(m));
}

/** Small labelled prose block, distinct from the editorial `prose()` helper. */
function prose2(heading, text) {
  return el('div', { class: 'prose' },
    el('h3', {}, heading),
    ...String(text).split(/\n\s*\n/).map((para) => el('p', {}, para)));
}

const PARK_SIZE_LABEL = {
  progression: 'Progression',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

function parkCards(list) {
  if (!list?.length) return null;
  return el('ul', { class: 'park-list' }, list.map((p) => {
    const counts = [
      ['Jumps', p.jumps],
      ['Rails', p.rails],
      ['Boxes', p.boxes],
      ['Jibs', p.jibs],
      ['Biggest jump', p.largestJumpFt === null ? null : `${p.largestJumpFt} ft`],
    ].filter(([, v]) => v !== null && v !== undefined);

    return el('li', { class: 'park' },
      el('div', { class: 'park__head' },
        el('h3', {}, p.name),
        el('span', { class: `park__size park__size--${p.size}` }, PARK_SIZE_LABEL[p.size] ?? p.size)),
      el('p', { class: 'park__level' }, p.level),
      el('p', { class: 'park__note' }, p.note),
      counts.length
        ? el('ul', { class: 'park__counts' }, counts.map(([label, v]) =>
            el('li', {}, el('b', {}, String(v)), ' ', label)))
        : null);
  }));
}

function parksSection(r) {
  const p = r.parks;
  if (!p) return null;

  const cards = parkCards(p.parks);

  // A sourced zero is a statement, not a gap.
  const noParks = noteFor(r, 'parks.count')?.status === 'absent' || p.count === 0;

  const pipeRow = (() => {
    const note = noteFor(r, 'parks.pipe');
    if (note?.status === 'absent') {
      return ['Halfpipe', el('span', { class: 'stated-absent', title: note.note ?? '' },
        'None - confirmed ',
        note.source ? el('a', { class: 'stated-absent__src', href: note.source, rel: 'noopener' }, 'source') : null)];
    }
    if (p.pipe === true) {
      const label = p.pipeType === 'superpipe' ? 'Superpipe' : 'Halfpipe';
      return ['Pipe', has(p.pipeSpecs) ? `${label} - ${p.pipeSpecs}` : label];
    }
    if (p.pipe === false) return ['Halfpipe', 'No'];
    return ['Halfpipe', null];
  })();

  const facts = dataTable([
    ['Parks', Number.isInteger(p.count) ? fmt(p.count) : null],
    pipeRow,
    ['Lit at night', has(p.nightPark) ? (p.nightPark ? 'Yes' : 'No') : null],
    ['Rebuilt', p.rebuildCadence],
  ]);

  const prose = [
    ['Who it is for', p.overview],
    ['Reputation', p.reputation],
    ['Progression', p.progression],
  ].filter(([, v]) => has(v));

  if (!cards && !facts && !prose.length && !noParks) return null;

  return section('Terrain parks',
    noParks && !cards
      ? el('p', { class: 'presence' },
          el('span', { class: 'presence__badge presence__badge--none' }, 'No terrain park'),
          'This mountain runs none.')
      : null,
    cards,
    facts,
    prose.length
      ? el('div', { class: 'prose-grid' }, prose.map(([label, text]) => prose2(label, text)))
      : null,
    provenance(p));
}

// --- editorial --------------------------------------------------------------

function keyTrails(list) {
  if (!list?.length) return null;
  return el('ul', { class: 'trails' }, list.map((trail) =>
    el('li', {}, el('h3', {}, trail.name), el('p', {}, trail.note))));
}

function pillList(items, modifier) {
  if (!items?.length) return null;
  return el('ul', { class: 'pill-list' },
    items.map((item) => el('li', { class: `pill pill--${modifier}` }, item)));
}

// --- passes and pricing -----------------------------------------------------

function passesSection(r) {
  if (!r.passes?.length) return null;

  return section('Passes',
    el('div', { class: 'table-scroll' },
      el('table', { class: 'compare', style: 'min-width:34rem' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', class: 'col-name' }, 'Pass'),
          el('th', { scope: 'col', class: 'col-text' }, 'Access'),
          el('th', { scope: 'col', class: 'col-text' }, 'Blackouts'),
          el('th', { scope: 'col' }, 'Verified'))),
        el('tbody', {}, r.passes.map((p) => el('tr', {},
          el('td', { class: 'col-name' },
            el('span', { class: `pass pass--${p.type}` }, PASS_LABELS[p.type] ?? p.type),
            ' ', p.name),
          el('td', { class: 'col-text' }, p.access),
          el('td', { class: has(p.blackouts) ? 'col-text' : 'col-text is-unknown' },
            has(p.blackouts) ? p.blackouts : 'Not verified'),
          el('td', {}, el('a', { href: p.source, rel: 'noopener' }, formatDate(p.verifiedOn)))))))));
}

function pricingSection(r) {
  const p = r.pricing;
  const table = dataTable([
    ['Walk-up, peak', has(p.windowTicketAdultHigh) ? money(p.windowTicketAdultHigh, p.currency) : null],
    ['Walk-up, cheapest', has(p.windowTicketAdultLow) ? money(p.windowTicketAdultLow, p.currency) : null],
    ['Typical advance', has(p.advanceTypical) ? money(p.advanceTypical, p.currency) : null],
    ['Adult season pass', has(p.seasonPassAdult) ? money(p.seasonPassAdult, p.currency) : null],
  ]);

  if (!table && !has(p.notes)) return null;

  return section('Pricing',
    table ?? el('p', { class: 'is-unknown' }, 'No adult prices could be sourced.'),
    has(p.notes) ? el('p', { class: 'note' }, p.notes) : null,
    provenance(p));
}

function reviewsSection(r) {
  if (!r.reviews?.length) return null;
  return section('What the reviewers say',
    r.reviews.map((rev) => el('div', { class: 'review' },
      el('div', { class: 'review__head' },
        el('strong', {}, el('a', { href: rev.url, rel: 'noopener' }, rev.source)),
        has(rev.rating)
          ? el('span', { class: 'review__score' }, `${fmt(rev.rating)} / ${fmt(rev.ratingScale)}`)
          : null),
      el('p', {}, rev.gist))),
    el('p', { class: 'provenance' },
      'Summarised in our own words. Follow the link for the original.'));
}

function linksSection(r) {
  const entries = [
    ['Official site', r.identity.website],
    ['Snow report', r.links.officialSnowReport],
    ['Trail map', r.links.trailMap],
    ['Webcams', r.links.webcams],
    ['Lodging', r.links.lodging],
    ['Instagram', r.links.instagram],
    ['X / Twitter', r.links.twitter],
  ].filter(([, url]) => has(url));

  if (!entries.length) return null;

  return section('Links',
    el('ul', { class: 'linkgrid' }, entries.map(([label, url]) =>
      el('li', {}, el('a', { href: url, rel: 'noopener' }, `${label} ↗`)))));
}

function sourcesSection(r) {
  const { sources, verifiedOn, lastEditedBy } = r.meta;
  return section('Sources',
    sources?.length
      ? el('ul', { class: 'sources' }, sources.map((s) => el('li', {},
          el('a', { href: s.url, rel: 'noopener' }, s.label),
          ` — accessed ${formatDate(s.accessedOn)}`)))
      : null,
    el('p', { class: 'provenance' },
      `Record last verified ${formatDate(verifiedOn)}`,
      lastEditedBy ? ` · edited by ${lastEditedBy}` : ''),
    el('a', { class: 'backlink', href: 'index.html' }, '← All mountains'));
}

/** "Source: … · verified 20 Aug 2026" for a factual group. */
function provenance(group) {
  if (!group || !has(group.source)) return null;
  const overrides = Object.keys(group.fieldSources ?? {});
  return el('p', { class: 'provenance' },
    el('a', { href: group.source, rel: 'noopener' }, 'Source'),
    ` · verified ${formatDate(group.verifiedOn)}`,
    overrides.length ? ` · ${overrides.join(', ')} sourced separately` : '');
}

// --- assemble ---------------------------------------------------------------

function renderResort(r) {
  const ed = r.editorial;

  return [
    head(r),

    section(null, livePanels(r)),

    section('The take',
      prose(null, ed.overview, 'prose--lead')),

    hasAny(ed.snowQuality, ed.crowds, ed.difficulty)
      ? section('Snow, crowds and difficulty',
          el('div', { class: 'prose-grid' },
            prose('Snow quality', ed.snowQuality),
            prose('Crowds', ed.crowds),
            prose('Difficulty', ed.difficulty)))
      : null,

    terrainSection(r),

    mogulsSection(r),
    parksSection(r),

    section('Trails worth knowing', keyTrails(ed.keyTrails)),

    hasAny(ed.bestFor?.length, ed.watchOutFor?.length)
      ? section('The short version',
          el('div', { class: 'twocol' },
            ed.bestFor?.length
              ? el('div', {}, el('h3', { class: 'label', style: 'display:block;margin-bottom:.6rem' }, 'Best for'),
                  pillList(ed.bestFor, 'good'))
              : null,
            ed.watchOutFor?.length
              ? el('div', {}, el('h3', { class: 'label', style: 'display:block;margin-bottom:.6rem' }, 'Watch out for'),
                  pillList(ed.watchOutFor, 'bad'))
              : null))
      : null,

    ed.tidbits?.length
      ? section('Worth knowing',
          el('ul', { class: 'facts' }, ed.tidbits.map((t) => el('li', {}, t))))
      : null,

    passesSection(r),
    pricingSection(r),
    reviewsSection(r),
    linksSection(r),
    sourcesSection(r),
  ].filter(Boolean);
}

// --- not found --------------------------------------------------------------

/**
 * `resort.html?r=nonsense` is a page that exists, so no static host will serve a
 * 404 for it — this renderer is the only thing standing between a stale link and
 * a raw "HTTP 404" error string. It answers with the same "did you mean" the 404
 * page uses, in the page, at the URL the visitor came to.
 */
async function renderUnknownSlug(slug) {
  document.title = 'Resort not found · New England Ski Guide';

  const parts = [
    el('div', { class: 'shell notfound' },
      el('p', { class: 'notfound__code' }, 'Not found'),
      el('h1', {}, 'No mountain by that name'),
      el('p', { class: 'lede' },
        'This guide has no resort with the identifier ',
        el('code', {}, String(slug)),
        '. Resorts get renamed and links go stale; the list below is current.')),
  ];

  try {
    const { resorts = [] } = await getIndex();
    const hits = suggestResorts(resorts, tokens(slug));
    if (hits.length) {
      parts.push(el('div', { class: 'shell notfound__suggest' },
        el('h2', {}, 'Did you mean one of these?'),
        el('ul', { class: 'pill-list' }, hits.map((r) => el('li', {},
          el('a', { class: 'pill', href: `resort.html?r=${encodeURIComponent(r.slug)}` },
            r.name, el('small', {}, ` ${STATE_NAMES[r.state] ?? r.state}`)))))));
    }
  } catch {
    // No manifest, no suggestions. The link to the full list below still works.
  }

  parts.push(el('div', { class: 'shell notfound__suggest' },
    el('p', {}, el('a', { href: 'index.html' }, 'Browse every mountain →'))));

  const article = document.getElementById('resort');
  fill(article, parts);
  article.hidden = false;
  setStatus('');
}

// --- boot -------------------------------------------------------------------

async function main() {
  const slug = param('r');
  if (!slug) {
    // resort.html with no ?r= is a bare URL somebody typed or a link that lost
    // its query string. Send them somewhere rather than stating the problem.
    document.title = 'Pick a resort · New England Ski Guide';
    const article = document.getElementById('resort');
    fill(article, el('div', { class: 'shell notfound' },
      el('p', { class: 'notfound__code' }, 'No resort chosen'),
      el('h1', {}, 'Which mountain?'),
      el('p', { class: 'lede' },
        'This page shows one resort at a time and this address does not name one.'),
      el('p', { class: 'notfound__suggest' },
        el('a', { href: 'index.html' }, 'Browse every mountain →'))));
    article.hidden = false;
    setStatus('');
    return;
  }

  let r;
  try {
    r = await getResort(slug);
  } catch {
    await renderUnknownSlug(slug);
    return;
  }
  document.title = `${r.identity.name} · New England Ski Guide`;

  const meta = document.querySelector('meta[name="description"]');
  if (meta && r.editorial.overview) {
    meta.content = `${r.editorial.overview.slice(0, 155).trim()}…`;
  }

  const article = document.getElementById('resort');
  fill(article, renderResort(r));
  article.hidden = false;
  setStatus('');

  // The record renders first; the panels fill in afterwards. Neither a failed
  // forecast nor a missing snow report may stop the page from being a page.
  loadWeather(r).catch(() => renderWeather(r, { status: 'error', reason: 'the request failed' }));
  loadSnowReport(r).catch(() => renderSnowReport(r, null));
}

main().catch((e) => setStatus(
  `Could not load that resort: ${e.message}`, { error: true }
));
