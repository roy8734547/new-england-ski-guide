/**
 * shell.js — the app shell: sidebar, top bar, status bar.
 *
 * Every page authors its own content and its own toolbar in HTML. This module
 * wraps that content rather than replacing it: it prepends the sidebar and the
 * top bar and appends the status bar, leaving `#main`, `#view`, `#status` and
 * every other id the renderers already query exactly where they were. The point
 * is to stop duplicating four blocks of chrome across seven pages, not to move
 * the pages into JavaScript.
 *
 * The sidebar's filters are real links. Every one of them is an `<a href>` at a
 * URL that render-index.js already understands — `index.html?state=VT`,
 * `?pass=epic`, `?feat=bumps`, `?night=1` — so they work with JavaScript off,
 * they are crawlable, they are middle-clickable, and on the index page itself a
 * click handler applies them without a reload. No new filter machinery exists
 * here; the sidebar is a second front end onto the querystring contract that
 * was already there.
 *
 * Two layouts:
 *   app       Fixed-height grid, nothing outside the panes scrolls. For the four
 *             data views, where the table is the page.
 *   document  Same sidebar and top bar, but the content column scrolls normally
 *             and gets a reading measure. For resort.html, about.html and 404 —
 *             45 resorts of editorial does not belong in a viewport-height pane.
 */

import { getIndex } from './data.js';
import { el, fill, fmt, formatDate, qs, STATE_NAMES } from './util.js';

/**
 * The pass groups, in the same order the map legend uses.
 *
 * `other` — reciprocal arrangements — was missing here while the map legend
 * showed it, so the two disagreed. It is a real category, not a legend bug: 23
 * of the 45 records carry it, and schema.md is explicit that it can sit
 * alongside `none` (Mad River Glen belongs to no mega-pass and still has a
 * reciprocal with Plattekill). The counts sum to more than 45 because a resort
 * can be in several groups, which was already true of the other four.
 */
const PASS_LABELS_SIDEBAR = {
  epic: 'Epic',
  ikon: 'Ikon',
  indy: 'Indy',
  other: 'Reciprocal',
  none: 'Independent',
};

/** Inline 16px icons, stroked with currentColor like the reference's. */
const ICON = {
  grid: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  snow: 'M8 2v12M2.8 5l10.4 6M2.8 11l10.4-6',
  map: 'M2 4l4-2 4 2 4-2v10l-4 2-4-2-4 2zM6 2v10M10 4v10',
  columns: 'M3 2v12M8 2v12M13 2v12',
  pin: 'M8 14s5-4.5 5-8A5 5 0 0 0 3 6c0 3.5 5 8 5 8z',
  tag: 'M2 2h5l7 7-5 5-7-7zM4.5 4.5h.01',
  star: 'M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.5 4.3 13.5l.8-4.2L2 6.4l4.2-.5z',
  info: 'M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 7v4M8 5h.01',
  menu: 'M2 4h12M2 8h12M2 12h12',
  close: 'M4 4l8 8M12 4l-8 8',
  moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z',
};

function icon(path, cls = 'ss-icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

// --- sidebar ----------------------------------------------------------------

function sidebarItem({ href, label, iconPath, count, active, onActivate }) {
  const node = el('a', {
    class: `ss-item${active ? ' is-active' : ''}`,
    href,
    'aria-current': active ? 'page' : null,
  },
  iconPath ? icon(iconPath) : null,
  el('span', { class: 'ss-text' }, label),
  count === null || count === undefined
    ? null
    : el('span', { class: 'ss-badge' }, fmt(count)));

  if (onActivate) {
    node.addEventListener('click', (e) => {
      // Let modified clicks do what the browser would do with any other link.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
        || e.button !== 0) return;
      e.preventDefault();
      onActivate(node);
    });
  }
  return node;
}

function section(label, items) {
  return el('div', { class: 'ss-section' },
    el('h2', { class: 'ss-label' }, label),
    el('div', { class: 'ss-items' }, items));
}

/**
 * The saved views. Each is a querystring render-index.js already reads, so this
 * table is a list of links rather than a list of behaviours.
 */
const SAVED_VIEWS = [
  { label: 'Biggest vertical', query: 'sort=verticalDrop&dir=desc', icon: ICON.star },
  { label: 'Bump mountains', query: 'feat=bumps', icon: ICON.star },
  { label: 'Park mountains', query: 'feat=park', icon: ICON.star },
  { label: 'Night skiing', query: 'night=1', icon: ICON.star },
  { label: 'Has halfpipe', query: 'feat=pipe', icon: ICON.star },
];

const WORKSPACE = [
  { key: 'resorts', label: 'All resorts', href: 'index.html', icon: ICON.grid, counted: true },
  { key: 'conditions', label: 'Conditions', href: 'conditions.html', icon: ICON.snow },
  { key: 'map', label: 'Map', href: 'map.html', icon: ICON.map },
  { key: 'compare', label: 'Compare', href: 'compare.html', icon: ICON.columns },
];

/**
 * True when a sidebar filter can be applied in place rather than navigated to.
 * Only the index renders the table those filters act on.
 */
const onIndex = () => /(^|\/)index\.html$|\/$/.test(location.pathname);

function buildSidebar(index, config) {
  const resorts = index.resorts ?? [];
  const byState = new Map();
  for (const r of resorts) byState.set(r.state, (byState.get(r.state) ?? 0) + 1);
  const states = [...byState.keys()].sort((a, b) =>
    (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[b] ?? b, 'en'));

  const passCount = (t) => resorts.filter((r) => r.passTypes?.includes(t)).length;

  /**
   * Applies a filter link in place on the index, and navigates anywhere else.
   *
   * The lookup is deliberately deferred to click time. render-index.js registers
   * its handler after the shell has mounted — the shell is what it renders
   * into — so a handler captured here at build time is always undefined, and
   * every sidebar filter silently full-page-navigated instead.
   */
  const apply = (query) => (node) => {
    if (!onIndex() || typeof window.__skiApplyQuery !== 'function') {
      location.href = node.getAttribute('href');
      return;
    }
    window.__skiApplyQuery(query);
    markActive(node);
  };

  const nav = el('nav', { class: 'sidebar__nav', 'aria-label': 'Filters and views' },
    section('Workspace', WORKSPACE.map((w) => sidebarItem({
      href: w.href,
      label: w.label,
      iconPath: w.icon,
      count: w.counted ? resorts.length : null,
      active: config.page === w.key,
    }))),

    section('States', states.map((code) => sidebarItem({
      href: `index.html?state=${code}`,
      label: STATE_NAMES[code] ?? code,
      iconPath: ICON.pin,
      count: byState.get(code),
      onActivate: apply(`state=${code}`),
    }))),

    section('Passes', Object.entries(PASS_LABELS_SIDEBAR)
      .filter(([type]) => passCount(type) > 0)
      .map(([type, label]) => sidebarItem({
        href: `index.html?pass=${type}`,
        label,
        iconPath: ICON.tag,
        count: passCount(type),
        onActivate: apply(`pass=${type}`),
      }))),

    section('Saved views', SAVED_VIEWS.map((v) => sidebarItem({
      href: `index.html?${v.query}`,
      label: v.label,
      iconPath: v.icon,
      onActivate: apply(v.query),
    }))));

  const stamp = index.generatedAt
    ? `Data rebuilt ${formatDate(index.generatedAt.slice(0, 10))}`
    : null;

  return el('aside', {
    class: 'sidebar',
    id: 'sidebar',
    'data-open': 'false',
    // Named, so it stays distinguishable from any other complementary
    // landmark a page puts on screen.
    'aria-label': 'Site navigation and filters',
  },
    el('div', { class: 'sidebar__head' },
      el('a', { class: 'sl', href: 'index.html' },
        el('span', { class: 'sl-mark', 'aria-hidden': 'true' }),
        el('span', { class: 'sl-name' }, 'New England Ski Guide')),
      el('button', {
        type: 'button',
        class: 'sidebar__close',
        id: 'sidebar-close',
        'aria-label': 'Close the menu',
      }, icon(ICON.close, 'ss-icon'))),
    nav,
    el('div', { class: 'sidebar__foot' },
      sidebarItem({ href: 'about.html', label: 'About', iconPath: ICON.info, active: config.page === 'about' }),
      // Open-Meteo is CC BY 4.0, which requires attribution wherever the data is
      // shown. The old page footer carried it; in a fixed shell there is no page
      // footer, so it lives here and is on every page for that reason.
      el('p', { class: 'sidebar__stamp' },
        'Weather by ',
        el('a', { href: 'https://open-meteo.com/', rel: 'noopener' }, 'Open-Meteo'),
        ', ',
        el('a', { href: 'https://creativecommons.org/licenses/by/4.0/', rel: 'noopener' }, 'CC BY 4.0')),
      stamp ? el('p', { class: 'sidebar__stamp' }, stamp) : null));
}

/** One active item per filter group, so the sidebar reflects what is applied. */
function markActive(node) {
  const group = node.closest('.ss-items');
  if (!group) return;
  for (const a of group.querySelectorAll('.ss-item')) {
    a.classList.remove('is-active');
    a.removeAttribute('aria-current');
  }
  node.classList.add('is-active');
  node.setAttribute('aria-current', 'true');
}

// --- top bar ----------------------------------------------------------------

/**
 * The trail, with the final crumb as the page's h1 unless the page renders its
 * own. The reference puts a page title in the top bar and this is that title;
 * without it a data view has no level-one heading at all, which is what axe
 * caught the moment the old page-head block went away.
 */
function crumbTrail(parts, ownHeading) {
  const nodes = [];
  parts.forEach((label, i, all) => {
    if (i) nodes.push(el('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '/'));
    const last = i === all.length - 1;
    if (typeof label !== 'string') {
      nodes.push(el('a', { class: 'crumb', href: label.href }, label.label));
    } else if (last && !ownHeading) {
      nodes.push(el('h1', { class: 'crumb current' }, label));
    } else {
      nodes.push(el('span', { class: `crumb${last ? ' current' : ''}` }, label));
    }
  });
  return nodes;
}

function buildTopbar(config) {
  const crumbs = crumbTrail(config.breadcrumb ?? ['Guide'], config.ownHeading);

  const actions = (config.actions ?? []).map((a) => {
    if (a.separator) return el('span', { class: 'tb-sep', 'aria-hidden': 'true' });
    const node = a.href
      ? el('a', { class: `tb-btn${a.primary ? ' primary' : ''}`, href: a.href, id: a.id ?? null })
      : el('button', {
        type: 'button',
        class: `tb-btn${a.primary ? ' primary' : ''}`,
        id: a.id ?? null,
        disabled: a.disabled ?? null,
      });
    if (a.icon) {
      node.append(icon(a.icon, 'tb-icon'));
      // The label is hidden on narrow screens, where five buttons of text do not
      // fit, so the accessible name has to survive independently of it.
      node.setAttribute('aria-label', a.label);
    }
    node.append(el('span', { class: 'tb-btn__text' }, a.label));
    if (a.onClick) node.addEventListener('click', a.onClick);
    return node;
  });

  return el('header', { class: 'topbar' },
    el('button', {
      type: 'button',
      class: 'topbar__menu',
      id: 'sidebar-open',
      'aria-label': 'Open the menu',
      'aria-expanded': 'false',
      'aria-controls': 'sidebar',
    }, icon(ICON.menu, 'tb-icon')),
    el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' }, crumbs),
    el('div', { class: 'topbar__actions', id: 'topbar-actions' }, actions));
}

// --- status bar -------------------------------------------------------------

function buildStatusbar() {
  return el('footer', { class: 'statusbar', id: 'statusbar' },
    el('div', { class: 'statusbar__stats', id: 'status-stats' }),
    el('div', { class: 'statusbar__right' },
      el('span', { class: 'live', id: 'live-indicator', hidden: true },
        el('span', { class: 'live__dot', 'aria-hidden': 'true' }),
        el('span', { id: 'live-text' }, ''))));
}

/**
 * Writes the status bar's left-hand stats. Called by whichever renderer owns the
 * numbers; the shell has no opinion about what belongs there.
 */
export function setStatusStats(parts) {
  const host = qs('#status-stats');
  if (!host) return;
  const nodes = [];
  parts.filter(Boolean).forEach((p, i) => {
    if (i) nodes.push(el('span', { class: 'statusbar__dot', 'aria-hidden': 'true' }));
    nodes.push(el('span', { class: `foot-stat${p.tone ? ` is-${p.tone}` : ''}` },
      p.label ? `${p.label} ` : null,
      p.value === undefined ? null : el('strong', {}, p.value)));
  });
  fill(host, nodes);
}

/**
 * Replaces the breadcrumb trail. resort.html only learns its own name after the
 * record loads, so it mounts with a placeholder and calls this.
 */
export function setBreadcrumb(parts, { ownHeading = true } = {}) {
  const host = qs('.crumbs');
  if (!host) return;
  fill(host, crumbTrail(parts, ownHeading));
}

/** The live dot and its timestamp. Hidden until a page has something to say. */
export function setLive(text, { tone = 'ok' } = {}) {
  const host = qs('#live-indicator');
  if (!host) return;
  host.hidden = !text;
  host.dataset.tone = tone;
  const label = qs('#live-text');
  if (label) label.textContent = text ?? '';
}

// --- mobile drawer ----------------------------------------------------------

function wireDrawer() {
  const sidebar = qs('#sidebar');
  const open = qs('#sidebar-open');
  const close = qs('#sidebar-close');
  const scrim = el('div', { class: 'scrim', id: 'scrim', hidden: true });
  document.body.append(scrim);

  const setOpen = (isOpen) => {
    sidebar.dataset.open = String(isOpen);
    open.setAttribute('aria-expanded', String(isOpen));
    scrim.hidden = !isOpen;
    document.body.classList.toggle('is-drawer-open', isOpen);

    if (isOpen) {
      close.focus();
      return;
    }
    // Closing must not leave focus inside a drawer that is now translated off
    // screen. Anything focused in there goes back to the button that opened it;
    // focus anywhere else is left alone, because the close may have been
    // incidental to something the user was already doing.
    if (sidebar.contains(document.activeElement)) open.focus();
  };

  open.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.dataset.open === 'true') setOpen(false);
  });
  // Following a link inside the drawer should close it.
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a') && matchMedia('(max-width: 899px)').matches) setOpen(false);
  });
}

// --- mount ------------------------------------------------------------------

/**
 * Wraps the page's existing `#main` in the shell.
 *
 * @param {object} config
 * @param {string} config.page        which workspace item is current
 * @param {Array}  config.breadcrumb  strings, or {label, href} for a link
 * @param {Array}  config.actions     top-bar buttons; {separator:true} for a rule
 * @param {'app'|'document'} config.layout
 */
export async function mountShell(config = {}) {
  const layout = config.layout ?? 'app';
  const main = qs('#main');
  if (!main) throw new Error('shell: the page has no #main to wrap');

  document.documentElement.dataset.layout = layout;

  // The skip link points here. A div is not focusable, and following a link to
  // an unfocusable target moves the scroll position without moving focus, which
  // leaves a keyboard user still inside the sidebar they were trying to skip.
  const view = qs('#view');
  if (view && !view.hasAttribute('tabindex')) view.setAttribute('tabindex', '-1');

  const app = el('div', { class: 'app', 'data-layout': layout });
  main.parentNode.insertBefore(app, main);
  app.append(main);

  main.prepend(buildTopbar(config));
  if (layout === 'app') main.append(buildStatusbar());

  // The sidebar needs the manifest for its counts. data.js caches it, so this is
  // the same request the page was going to make anyway.
  let index = { resorts: [] };
  try {
    index = await getIndex();
  } catch {
    // No manifest, no counts. The nav still renders and still links correctly.
  }
  app.prepend(buildSidebar(index, config));
  wireDrawer();

  return { app, main };
}
