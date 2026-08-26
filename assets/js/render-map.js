/**
 * render-map.js — Leaflet + OpenStreetMap tiles, one pin per resort.
 *
 * Three decisions worth knowing about:
 *
 *  1. Pins are `circleMarker`s, not image markers. Forty-five default Leaflet
 *     teardrops on a map this size is unreadable, and a circle can carry two
 *     dimensions at once: colour for pass affiliation, radius for vertical drop.
 *  2. Colours are read out of the CSS custom properties at boot rather than
 *     hardcoded here, so the map follows the same palette as the pass badges
 *     everywhere else and picks up the dark-mode values automatically.
 *  3. A map is not accessible to a keyboard or a screen reader no matter how
 *     much ARIA you throw at it, so the same forty-five resorts are also
 *     rendered as a plain grouped list of links below it. That list is the real
 *     content; the map is the nice version of it.
 */

import { getIndex } from './data.js';
import { applyCanonical } from './seo.js';
import { el, fill, fmt, qs, setStatus, STATE_NAMES, PASS_LABELS } from './util.js';
import { mountShell, setStatusStats } from './shell.js';

/** Highest-priority pass wins the pin colour. A mountain on both Epic and Indy
 *  reads as Epic, because that is the pass someone chose it for. */
const PASS_ORDER = ['epic', 'ikon', 'indy', 'other', 'none'];

const NEW_ENGLAND_CENTRE = [44.0, -71.6];

const state = {
  /** Empty means "show everything" — the same convention as the index filters. */
  passes: new Set(),
};

let map = null;
let resorts = [];
let layer = null;
const markers = new Map(); // slug -> circleMarker

// --- palette ----------------------------------------------------------------

/** Leaflet needs a real colour string, and `var(--pass-epic)` is not one. */
function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

let palette = {};

function readPalette() {
  palette = {
    epic: cssVar('--pass-epic', '#1d5fb0'),
    ikon: cssVar('--pass-ikon', '#7a35a6'),
    indy: cssVar('--pass-indy', '#12704a'),
    other: cssVar('--pass-other', '#8a6410'),
    none: cssVar('--pass-none', '#4d5a68'),
    tint: cssVar('--pass-tint', '#ffffff'),
  };
}

const primaryPass = (r) =>
  PASS_ORDER.find((t) => r.passTypes?.includes(t)) ?? 'none';

/** 650 ft areas and 4,000 ft ones on one map: clamp hard so the small hills stay
 *  clickable and Killington does not swallow Pico. */
function radiusFor(verticalDrop) {
  if (!Number.isFinite(verticalDrop)) return 5;
  const t = Math.min(1, Math.max(0, (verticalDrop - 600) / 2400));
  return 5 + t * 7;
}

// --- popup ------------------------------------------------------------------

function popupContent(r) {
  const where = [r.town, STATE_NAMES[r.state] ?? r.state].filter(Boolean).join(', ');
  const passNames = [...new Set((r.passes ?? []).map((p) => p.type))]
    .filter(Boolean)
    .map((t) => el('span', { class: `pass pass--${t}` }, PASS_LABELS[t] ?? t));

  return el('div', { class: 'map-popup' },
    el('h2', {}, el('a', { href: `resort.html?r=${encodeURIComponent(r.slug)}` }, r.name)),
    el('p', { class: 'map-popup__where' }, where || null, r.region ? ` · ${r.region}` : null),
    el('dl', { class: 'map-popup__stats' },
      el('div', {}, el('dt', {}, 'Vertical'),
        el('dd', { class: r.verticalDrop === null ? 'is-unknown' : '' },
          r.verticalDrop === null ? '—' : `${fmt(r.verticalDrop)} ft`)),
      el('div', {}, el('dt', {}, 'Snowfall'),
        el('dd', { class: r.annualSnowfallAvg === null ? 'is-unknown' : '' },
          r.annualSnowfallAvg === null ? '—' : `${fmt(r.annualSnowfallAvg)}"`)),
      el('div', {}, el('dt', {}, 'Trails'),
        el('dd', { class: r.trailCount === null ? 'is-unknown' : '' }, fmt(r.trailCount)))),
    passNames.length
      ? el('p', { class: 'map-popup__pass' }, passNames)
      : null,
    el('p', { class: 'map-popup__go' },
      el('a', { href: `resort.html?r=${encodeURIComponent(r.slug)}` }, 'Full write-up →'))
  );
}

// --- pins -------------------------------------------------------------------

function visible() {
  return resorts.filter((r) => {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return false;
    if (state.passes.size === 0) return true;
    return (r.passTypes ?? []).some((t) => state.passes.has(t));
  });
}

function drawPins() {
  layer.clearLayers();
  markers.clear();

  const shown = visible();
  for (const r of shown) {
    const type = primaryPass(r);
    const marker = L.circleMarker([r.lat, r.lon], {
      radius: radiusFor(r.verticalDrop),
      color: palette.tint,
      weight: 1.5,
      fillColor: palette[type],
      fillOpacity: 0.92,
    });
    marker.bindPopup(() => popupContent(r), { minWidth: 220, maxWidth: 280 });
    marker.bindTooltip(r.name, { direction: 'top', offset: [0, -4] });
    // The resting style, kept so highlight() has something to restore. Reading it
    // back off the marker would give whatever the highlight last set.
    marker.__base = { radius: radiusFor(r.verticalDrop), color: palette.tint, weight: 1.5 };
    marker.addTo(layer);
    markers.set(r.slug, marker);
  }

  const total = resorts.length;
  qs('#result-count').textContent = shown.length === total
    ? `${total} mountains`
    : `${shown.length} of ${total}`;

  const verticals = shown.map((r) => r.verticalDrop).filter(Number.isFinite);
  const states = new Set(shown.map((r) => r.state));
  setStatusStats([
    { value: `${fmt(shown.length)} pinned` },
    { label: 'States', value: fmt(states.size) },
    verticals.length
      ? { label: 'Tallest', value: `${fmt(Math.max(...verticals))} ft` }
      : null,
    verticals.length
      ? { label: 'Shortest', value: `${fmt(Math.min(...verticals))} ft` }
      : null,
  ]);

  const unplaced = resorts.filter((r) => !Number.isFinite(r.lat) || !Number.isFinite(r.lon));
  const note = qs('#map-note');
  note.hidden = unplaced.length === 0;
  if (unplaced.length) {
    note.textContent = `${unplaced.length} ${unplaced.length === 1 ? 'area has' : 'areas have'} `
      + `no recorded coordinate and cannot be pinned: ${unplaced.map((r) => r.name).join(', ')}.`;
  }

  return shown;
}

function fitAll() {
  const shown = visible();
  if (!shown.length) return;
  const bounds = L.latLngBounds(shown.map((r) => [r.lat, r.lon]));
  map.fitBounds(bounds, { padding: [36, 36], maxZoom: 11 });
}

/**
 * Raises one pin while its name is hovered or focused in the list beside it.
 *
 * Size and stroke, not colour: the pin's fill already encodes pass affiliation,
 * and recolouring it to mean "you are pointing at this" would collide with the
 * one thing the colour is for.
 */
function highlight(slug, on) {
  const marker = markers.get(slug);
  if (!marker) return;
  const base = marker.__base ?? {};
  marker.setStyle(on
    ? { radius: (base.radius ?? 6) + 4, weight: 3, color: cssVar('--text-primary', '#1a1a18') }
    : { radius: base.radius, weight: base.weight, color: base.color });
  if (on) marker.bringToFront();

  const row = document.querySelector(`.map-list__items li[data-slug="${slug}"]`);
  if (row) row.classList.toggle('is-highlighted', on);
}

/** Opens a pin from the list, which is how a keyboard reaches the map. */
function focusResort(slug) {
  const marker = markers.get(slug);
  if (!marker) return;
  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 10), { animate: !map.__reduceMotion });
  marker.openPopup();
  highlight(slug, true);
}

// --- legend -----------------------------------------------------------------

function buildLegend() {
  const present = PASS_ORDER.filter((t) => resorts.some((r) => r.passTypes?.includes(t)));
  fill(qs('#map-legend'), present.map((type) => {
    const count = resorts.filter((r) => r.passTypes?.includes(type)).length;
    return el('button', {
      type: 'button',
      class: 'filter-tag filter-tag--dot',
      style: `--chip-accent: var(--pass-${type})`,
      'aria-pressed': 'false',
      dataset: { value: type },
      onclick: () => {
        if (state.passes.has(type)) state.passes.delete(type);
        else state.passes.add(type);
        syncLegend();
        drawPins();
      },
    }, `${PASS_LABELS[type] ?? type} (${count})`);
  }));
}

function syncLegend() {
  for (const button of document.querySelectorAll('#map-legend .filter-tag')) {
    button.setAttribute('aria-pressed', String(state.passes.has(button.dataset.value)));
  }
}

// --- the accessible list ----------------------------------------------------

function buildList() {
  const byState = new Map();
  for (const r of resorts) {
    if (!byState.has(r.state)) byState.set(r.state, []);
    byState.get(r.state).push(r);
  }
  const states = [...byState.keys()].sort((a, b) =>
    (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b, 'en'));

  fill(qs('#map-list'), states.map((code) => {
    const list = byState.get(code).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return el('div', { class: 'map-list__state' },
      el('h3', {}, STATE_NAMES[code] ?? code, ' ', el('small', {}, `(${list.length})`)),
      el('ul', { class: 'map-list__items' }, list.map((r) => {
        const placed = Number.isFinite(r.lat) && Number.isFinite(r.lon);
        const row = el('li', { dataset: { slug: r.slug } },
          el('span', {
            class: `map-list__dot map-list__dot--${primaryPass(r)}`,
            'aria-hidden': 'true',
          }),
          // Still a real link to the detail page: this is the crawlable content
          // and the no-JS route, and the button beside it only moves the map.
          el('a', { href: `resort.html?r=${encodeURIComponent(r.slug)}` }, r.name),
          placed
            ? el('button', {
              type: 'button',
              class: 'map-list__locate',
              onclick: () => focusResort(r.slug),
            }, 'Show on map', el('span', { class: 'visually-hidden' }, `: ${r.name}`))
            : el('span', { class: 'is-unknown' }, 'no coordinate'),
          el('span', { class: 'map-list__vert' },
            r.verticalDrop === null ? '—' : `${fmt(r.verticalDrop)} ft`));

        if (placed) {
          // Focus as well as hover, so the highlight is not mouse-only.
          row.addEventListener('mouseenter', () => highlight(r.slug, true));
          row.addEventListener('mouseleave', () => highlight(r.slug, false));
          row.addEventListener('focusin', () => highlight(r.slug, true));
          row.addEventListener('focusout', () => highlight(r.slug, false));
        }
        return row;
      }))
    );
  }));
}

// --- boot -------------------------------------------------------------------

async function main() {
  await mountShell({
    page: 'map',
    breadcrumb: ['Guide', 'Map'],
    layout: 'app',
    actions: [
      { id: 'fit-all', label: 'Zoom to fit', icon: 'M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4' },
      { separator: true },
      { label: 'All resorts', href: 'index.html', primary: true },
    ],
  });

  if (typeof L === 'undefined') {
    setStatus('The map library did not load. Every mountain is still listed below.', { error: true });
    const index = await getIndex();
    resorts = index.resorts ?? [];
    buildList();
    qs('#map').hidden = true;
    qs('#fit-all').disabled = true;
    return;
  }

  const index = await getIndex();
  resorts = index.resorts ?? [];
  if (!resorts.length) {
    setStatus('No resorts in data/index.json yet. Run: node tools/build-index.mjs');
    return;
  }

  readPalette();

  // Leaflet's pan and zoom easing is driven from JS, so the CSS media query in
  // site.css cannot switch it off on its own.
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  map = L.map('map', {
    center: NEW_ENGLAND_CENTRE,
    zoom: 7,
    scrollWheelZoom: false, // a map that eats the page scroll on a phone is a bug
    worldCopyJump: false,
    fadeAnimation: !reduceMotion,
    zoomAnimation: !reduceMotion,
    markerZoomAnimation: !reduceMotion,
  });
  map.__reduceMotion = reduceMotion;
  map.attributionControl.setPrefix('');

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    minZoom: 5,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Escape closes a popup without needing to hit its little ×.
  map.on('keydown', (e) => { if (e.originalEvent.key === 'Escape') map.closePopup(); });

  layer = L.layerGroup().addTo(map);

  buildLegend();
  buildList();
  drawPins();
  fitAll();

  qs('#fit-all').addEventListener('click', fitAll);

  // The pane's shape changes at the 1100px breakpoint, and Leaflet caches its
  // size. Without this the map keeps the old aspect ratio after a resize and
  // fitBounds keeps solving for a box that is no longer there.
  const refit = () => {
    map.invalidateSize({ animate: false });
    fitAll();
  };
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refit, 150);
  });

  // The palette flips with the OS theme; the pins have to flip with it.
  window.matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener?.('change', () => { readPalette(); drawPins(); });

  setStatus('');
}

main().catch((e) => setStatus(`Could not load the map: ${e.message}`, { error: true }));

// Canonical URL and og:url, written from location because this repo has no domain
// baked into it. On pages whose querystring is view state rather than content —
// index's filters and sort, conditions' sort — that state is stripped, so a
// filtered view stays a shareable link without becoming its own indexable page.
applyCanonical();
