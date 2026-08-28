/**
 * support.js — the Buy Me a Coffee link, and the card it sits in.
 *
 * One URL, one icon path, one button, one card, imported by everything that
 * shows any of them: shell.js for the sidebar item on every page,
 * render-about.js for the top-bar button, render-resort.js for the end-of-page
 * card and the record footer. Nothing here fetches, injects a script, or loads
 * a third party. The support link is an `<a href>` and that is the whole
 * mechanism — see the block comment in site.css for why it is not the widget.
 *
 * about.html writes its own copy of the card as static markup rather than
 * calling `supportCard()`. That is deliberate and it is a layout-shift
 * decision, not an oversight: about.html paints its content from HTML, and a
 * card inserted into the middle of it by a module would push three sections
 * down the page after first paint. resort.html is the other way round — its
 * article is built from JSON, so a static card underneath would move on every
 * load — and that is the page this builder exists for. The presentation is
 * shared: both produce the same `.support-card` structure, styled once.
 */

import { el } from './util.js';

/** The page every link on this site points at. Defined here and nowhere else. */
export const SUPPORT_URL = 'https://buymeacoffee.com/roy8734547a';

/** Where the dismissal is remembered, and the attribute the head script sets. */
export const DISMISS_KEY = 'ne-ski-support';
export const DISMISS_ATTR = 'data-support';

/**
 * The coffee cup, 16×16, stroked at 1.5 like every other icon in the sidebar.
 * site.css carries the same glyph as `--icon-coffee`, a mask used by the button
 * and the card title; this copy is here because shell.js builds icons as SVG
 * elements and taking one of its eleven icons off that path would be worse than
 * one duplicated path string. If either changes, change both.
 */
export const COFFEE_ICON = 'M2.5 5.5h8v5a2.5 2.5 0 0 1-2.5 2.5H5a2.5 2.5 0 0 1-2.5-2.5z'
  + 'M10.5 6.5h1.25a1.75 1.75 0 0 1 0 3.5H10.5M5 1.75v1.5M8 1.75v1.5M2 14.75h9';

/**
 * The attributes that make a link leave the site safely. `noreferrer` is on top
 * of `noopener` here where the rest of the site uses `noopener` alone: these are
 * the only links on the guide that open in a new tab, and a payment page has no
 * business being told which resort page somebody came from.
 */
export const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' };

/**
 * The trailing arrow the site puts on every outbound link. A separate span so
 * the label and the affordance can be styled apart, and so the top bar can hide
 * both together when it collapses to icons.
 */
const arrow = () => el('span', { class: 'ext', 'aria-hidden': 'true' }, '↗');

/**
 * The yellow button. `aria-label` rather than a visually-hidden span, because
 * the top-bar variant already carries an aria-label and the two would fight.
 */
export function supportButton(label = 'Buy me a coffee') {
  return el('a', {
    class: 'bmc-btn',
    href: SUPPORT_URL,
    ...NEW_TAB,
    'aria-label': `${label} (opens in a new tab)`,
  }, label, ' ', arrow());
}

/** The small coffee-coloured link in a resort page's record footer. */
export function supportLink(label = 'Support the guide') {
  return el('a', {
    class: 'support-link',
    href: SUPPORT_URL,
    ...NEW_TAB,
    'aria-label': `${label} (opens in a new tab)`,
  }, label, ' ', arrow());
}

/** The sidebar item's shape, so shell.js does not have to know the URL. */
export function supportNavItem() {
  return {
    href: SUPPORT_URL,
    label: 'Buy me a coffee',
    iconPath: COFFEE_ICON,
    external: true,
    className: 'ss-item--support',
  };
}

/** The top bar's shape, for about.html. */
export function supportAction(label = 'Buy me a coffee') {
  return {
    label,
    href: SUPPORT_URL,
    icon: COFFEE_ICON,
    external: true,
    variant: 'coffee',
  };
}

/** The × on the dismissible card. Built here so the card owns its own markup. */
function closeButton() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M4 4l8 8M12 4l-8 8');
  svg.append(p);

  return el('button', {
    type: 'button',
    class: 'support-card__close',
    'aria-label': 'Hide this',
  }, svg);
}

/**
 * The card.
 *
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {Node[]}   opts.body        paragraphs, already built by the caller
 * @param {string}   opts.note        the muted line beside the button
 * @param {boolean}  opts.dismissible adds the close button and the class the
 *                                    pre-paint CSS rule keys off
 * @param {string}   opts.titleTag    h2 when the card is its own section, h3
 *                                    when it sits under one
 */
export function supportCard({ title, body = [], note, dismissible = false, titleTag = 'h2' }) {
  return el('div', {
    class: `support-card${dismissible ? ' support-card--dismissible' : ''}`,
    id: dismissible ? 'support-card' : null,
  },
  dismissible ? closeButton() : null,
  el(titleTag, { class: 'support-card__title' }, title),
  body,
  el('div', { class: 'support-card__cta' },
    supportButton(),
    note ? el('p', { class: 'support-card__note' }, note) : null));
}

/**
 * Wires the close button, and reflects the dismissal onto <html> so the CSS
 * rule that already exists does the hiding.
 *
 * The write is in its own try/catch and its failure is not an error: a private
 * window refuses to store this, the card closes anyway for the rest of the
 * visit, and it is back on the next one. That is the correct behaviour for a
 * preference nobody promised to keep.
 */
export function wireDismiss(card) {
  const button = card?.querySelector('.support-card__close');
  if (!button) return;
  button.addEventListener('click', () => {
    document.documentElement.setAttribute(DISMISS_ATTR, 'dismissed');
    try {
      localStorage.setItem(DISMISS_KEY, 'dismissed');
    } catch {
      /* storage refused. Closed for this visit, back on the next one. */
    }
  });
}
