/**
 * Killington - tier 2, HTML.
 *
 * Investigation, and why this is NOT tier 1:
 *
 * Killington is a Powdr property and their mountain report page is driven by a
 * "daily operations report" service under /dor/. That is very likely a clean
 * JSON endpoint - the page is full of dor-* markup that it feeds. We do not use
 * it, because killington.com/robots.txt says:
 *
 *     User-agent: *
 *     Disallow: /dor/
 *
 * Rule 2 in CLAUDE.md is not conditional on the endpoint being convenient, so
 * the JSON tier is off the table here and we parse the page instead.
 *
 * The good news is that /mountain-report is server-rendered: the status bars
 * carry their values in the HTML, so no headless browser is needed either. The
 * bars are labelled and change with the season ("Open Lifts", "Open Trails",
 * "Open Bike Trails" in summer), so we match on the label rather than position.
 *
 * The page also carries a long prose "Daily Report" written by their comms
 * team. It is deliberately never read - rule 5.
 */

import * as cheerio from 'cheerio';

export const meta = {
  slug: 'killington',
  tier: 'html',
  reportUrl: 'https://killington.com/mountain-report',
};

/** "12/155" -> {open: 12, total: 155} */
function splitCount(text) {
  const m = String(text ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { open: Number(m[1]), total: Number(m[2]) } : null;
}

export default async function fetchKillington({ get, num }) {
  const html = await get(meta.reportUrl);
  const $ = cheerio.load(html);

  // Each status bar is a row with a label and an "open/total" count.
  const bars = new Map();
  $('.dor-bar-row').each((_, node) => {
    const label = $(node).find('.dor-bar-label').text().trim().toLowerCase();
    const counts = splitCount($(node).find('.dor-bar-count').text());
    if (label && counts) bars.set(label, counts);
  });

  // Winter labels only. In summer these read "open bike trails" / "open hiking
  // trails" and are correctly ignored, which is what puts the report into the
  // "closed" state rather than reporting 20 open bike trails as ski terrain.
  const trails = bars.get('open trails') ?? bars.get('open ski trails') ?? null;
  const lifts = bars.get('open lifts') ?? null;

  // Snow depths appear as labelled weather pills when the season is running.
  const pills = {};
  $('.dor-wx-pill').each((_, node) => {
    const label = $(node).find('.dor-wx-label').text().trim().toLowerCase();
    const val = $(node).find('.dor-wx-val').text().trim();
    if (label) pills[label] = val;
  });

  const pick = (...keys) => {
    for (const key of keys) {
      const hit = Object.keys(pills).find((k) => k.includes(key));
      if (hit) return pills[hit];
    }
    return null;
  };

  const dateText = $('.condition-report-date').first().text().trim();
  const parsedDate = dateText ? new Date(dateText) : null;

  return {
    newSnow24h: num(pick('24 hour', '24hr', 'new snow')),
    newSnow48h: num(pick('48 hour', '48hr')),
    newSnow7d: num(pick('7 day', 'week')),
    baseDepth: num(pick('base depth', 'base')),
    seasonTotal: num(pick('season total', 'season')),
    trailsOpen: trails?.open ?? null,
    trailsTotal: trails?.total ?? null,
    liftsOpen: lifts?.open ?? null,
    liftsTotal: lifts?.total ?? null,
    surface: pick('surface', 'conditions'),
    lastUpdated: parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toISOString()
      : null,
    sourceUrl: meta.reportUrl,
  };
}
