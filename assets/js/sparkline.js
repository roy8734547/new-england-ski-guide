/**
 * sparkline.js — the seven-day snowfall sparkline.
 *
 * The reference's price sparkline, reassigned to the one dimension on this site
 * where more and less genuinely rank. It lives here rather than in a renderer
 * because index.html and conditions.html both show it and they must scale it the
 * same way, or the same mountain draws two different shapes on two pages.
 *
 * The scale is the important decision. Bars are sized against the deepest single
 * day anywhere in the current view, not against each row's own maximum. A
 * per-row scale draws a mountain expecting one inch and a mountain expecting
 * twenty identically, which is the opposite of what a sparkline is for: the
 * column has to be readable down its own length.
 */

import { el, fmt } from './util.js';

export const SPARK_DAYS = 7;

/** Three bands, so the pill's weight tracks the forecast without a gradient. */
export function depthBand(inches) {
  if (inches >= 12) return 'deep';
  if (inches >= 4) return 'some';
  return 'trace';
}

/** The deepest single day across every forecast in view — the shared scale. */
export function peakDay(forecasts, slugs) {
  let peak = 0;
  for (const slug of slugs) {
    const hit = forecasts.get(slug);
    if (!hit || hit.status !== 'ok') continue;
    for (const d of (hit.data.days ?? []).slice(0, SPARK_DAYS)) {
      if (Number.isFinite(d.snow) && d.snow > peak) peak = d.snow;
    }
  }
  return peak;
}

const inches = (total) => `${fmt(total, { digits: total > 0 && total < 10 ? 1 : 0 })}"`;

/**
 * @param {object|null} hit  the getForecasts() entry for this resort
 * @param {number} peak      the shared scale from peakDay()
 * @param {number|null} total  seven-day total, if the caller already has it
 */
export function sparkline(hit, peak, total) {
  if (!hit) return el('span', { class: 'spark spark--pending', 'aria-hidden': 'true' });
  if (hit.status !== 'ok') {
    return el('span', { class: 'spark is-unknown', title: hit.reason ?? 'No forecast' }, '—');
  }

  const days = (hit.data.days ?? []).slice(0, SPARK_DAYS);
  const sum = Number.isFinite(total)
    ? total
    : days.reduce((a, d) => a + (Number.isFinite(d.snow) ? d.snow : 0), 0);
  const scale = peak > 0 ? peak : 1;

  // The all-dry case is drawn as one flat rule rather than seven near-zero bars.
  // Seven 1px stubs read as a rendering fault, and out of season that is every
  // row on the page at once — which is what made the column look like dead space
  // in August. A single rule says "flat week" unambiguously, and it says it at
  // the same width the bars occupy, so nothing moves when real snow arrives.
  if (sum <= 0) {
    return el('span', { class: 'snowcell' },
      el('span', {
        class: 'spark spark--flat',
        role: 'img',
        'aria-label': `No snow forecast in the next ${SPARK_DAYS} days`,
      }, el('span', { class: 'sp-flat' })),
      el('span', { class: 'snow-pill snow-pill--flat' }, '0"'));
  }

  return el('span', { class: 'snowcell' },
    el('span', {
      class: 'spark is-snowy',
      role: 'img',
      'aria-label': `${inches(sum)} forecast over ${SPARK_DAYS} days`,
    }, days.map((d) => {
      const snow = Number.isFinite(d.snow) ? d.snow : 0;
      // A dry day inside a snowy week keeps a visible stub, so the shape of the
      // week reads as "nothing Tuesday" rather than as a gap in the chart.
      const pct = Math.max(8, Math.round((snow / scale) * 100));
      return el('span', { class: `sp${snow > 0 ? ' is-snow' : ''}`, style: `height:${pct}%` });
    })),
    el('span', { class: 'snow-pill snow-pill--snow', dataset: { depth: depthBand(sum) } },
      inches(sum)));
}
