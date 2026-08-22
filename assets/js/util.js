/** util.js - small shared helpers. No DOM framework, no dependencies. */

/** Renders a null as an em dash so an unknown never reads as a zero. */
export const EM_DASH = '—';

/**
 * Element builder. Data always goes in as text, never as markup, so a stray
 * angle bracket in an editorial field can never become HTML.
 *
 *   el('p', { class: 'lede' }, 'text')
 *   el('a', { href: url, rel: 'noopener' }, 'label')
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list' && typeof value !== 'object') {
      node[key] = value;
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Replaces a node's children in one shot. */
export function fill(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

export function fmt(value, { suffix = '', digits = 0 } = {}) {
  if (value === null || value === undefined) return EM_DASH;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}${suffix}`;
  }
  return String(value);
}

/** $1,529 - no cents, because no lift ticket has ever cost $89.50. */
export function money(value, currency = 'USD') {
  if (value === null || value === undefined) return EM_DASH;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}

/** 2026-08-20 -> "20 Aug 2026". Every verified date on the site goes through this. */
export function formatDate(iso) {
  if (!iso) return EM_DASH;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

/** "3 hours ago" / "yesterday". Every fetched figure is shown with one of these. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return EM_DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return EM_DASH;
  const mins = Math.round((now - then) / 60000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

/** Sorts with nulls always last, whichever direction the user picked. */
export function compareNullsLast(a, b, dir = 1) {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) return aMissing && bMissing ? 0 : aMissing ? 1 : -1;
  if (typeof a === 'string' || typeof b === 'string') {
    return String(a).localeCompare(String(b), 'en') * dir;
  }
  return (a - b) * dir;
}

export const STATE_NAMES = {
  VT: 'Vermont', NH: 'New Hampshire', ME: 'Maine',
  MA: 'Massachusetts', CT: 'Connecticut', RI: 'Rhode Island',
};

export const PASS_LABELS = {
  epic: 'Epic', ikon: 'Ikon', indy: 'Indy', other: 'Reciprocal', none: 'Independent',
};

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Reads ?r=<slug> and friends. */
export function param(name) {
  return new URLSearchParams(location.search).get(name);
}

export function setStatus(message, { error = false } = {}) {
  const node = qs('#status');
  if (!node) return;
  node.textContent = message ?? '';
  node.hidden = !message;
  node.classList.toggle('is-error', error);
}
