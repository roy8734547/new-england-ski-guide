/**
 * Stowe - tier 1, JSON.
 *
 * Investigation: Stowe is a Vail property. Their snow report page ships a
 * `window.digitalData` object (the Adobe Analytics payload) which already
 * carries the exact figures we want, fully structured:
 *
 *   attributes.weather.precipitation = { total24hr, total48hr, total7d,
 *                                        overnightTotal, seasonTotal, midMtnDepth }
 *   attributes.weather.terrain       = { runsOpen, liftsOpen, acresOpen, percentOpen }
 *
 * This is JSON parsed out of an allowed page rather than a separate endpoint.
 * Vail does run a real API at https://digital.snow.com/api/ (referenced by the
 * page as FR.digitalApiBaseUrl) but it is undocumented and needs internal ids,
 * and this needs exactly one request to a page robots.txt permits. If the blob
 * ever moves, this adapter fails soft and the UI falls back to the link.
 *
 * robots.txt: www.stowe.com allows /, and the snow report page is not in the
 * Disallow list.
 */

export const meta = {
  slug: 'stowe',
  tier: 'json',
  reportUrl: 'https://www.stowe.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
};

/** Pulls the `window.digitalData = {...};` assignment out of the page. */
function extractDigitalData(html) {
  const start = html.indexOf('window.digitalData');
  if (start < 0) throw new Error('window.digitalData not found on the page');
  const open = html.indexOf('{', start);
  if (open < 0) throw new Error('digitalData assignment is malformed');

  // Brace-match rather than regex, because the payload contains braces in strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(open, i + 1));
    }
  }
  throw new Error('digitalData object never closed');
}

export default async function fetchStowe({ get }) {
  const html = await get(meta.reportUrl);
  const data = extractDigitalData(html);

  const weather = data?.page?.attributes?.weather;
  if (!weather) throw new Error('digitalData has no page.attributes.weather');

  const precip = weather.precipitation ?? {};
  const terrain = weather.terrain ?? {};

  return {
    newSnow24h: precip.total24hr,
    newSnow48h: precip.total48hr,
    newSnow7d: precip.total7d,
    baseDepth: precip.midMtnDepth,
    seasonTotal: precip.seasonTotal,
    trailsOpen: terrain.runsOpen,
    liftsOpen: terrain.liftsOpen,
    acresOpen: terrain.acresOpen,
    // Vail does not put a surface label in this payload, and the prose on the
    // page is theirs, not ours to store.
    surface: null,
    sourceUrl: meta.reportUrl,
  };
}
