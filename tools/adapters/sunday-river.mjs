/**
 * Sunday River - tier 3, headless browser.
 *
 * Investigation, in the order the tiers say to try them:
 *
 *   1. JSON endpoint. Not found, and not for lack of looking:
 *      - www.sundayriver.com is a Next.js App Router site. The raw HTML of
 *        /mountain-report ships literal "Loading..." placeholders where the
 *        numbers go, and the RSC flight payload embedded in the page carries
 *        CMS content only - no conditions figures.
 *      - /api/conditions, /api/mountain-report, /api/snow-report,
 *        /api/conditions/current and /api/lifts-trails all return 404.
 *      - mtnpowder.com, the feed Boyne and Alterra properties use, DOES list
 *        "Sunday River" - but its entry contains only Name, LastUpdate and
 *        Forecast. No SnowReport object, unlike Stratton which has the full
 *        payload. Per-resort ids around the expected range return
 *        {"error":"Resort does not exist"}. Worth re-checking in season: if
 *        Boyne starts publishing there, this adapter becomes a two-line tier-1
 *        fetch of https://mtnpowder.com/feed?resortId=<id> and should be
 *        rewritten to use it.
 *      - The interactive map vendor (vicomap-cdn.resorts-interactive.com/map/1422)
 *        exposes no public status JSON.
 *   2. Static HTML parse. Impossible for the same reason - the values are not
 *      in the served HTML.
 *   3. Headless render. What is left.
 *
 * Playwright is an OPTIONAL dependency. It is a ~300MB install for one resort,
 * so this adapter degrades to a clean error when it is absent rather than
 * forcing it on everyone who clones the repo. Install with:
 *
 *     npm install --save-dev playwright && npx playwright install chromium
 *
 * robots.txt: www.sundayriver.com publishes "User-Agent: *" with no rules, so
 * everything is permitted.
 */

export const meta = {
  slug: 'sunday-river',
  tier: 'browser',
  reportUrl: 'https://www.sundayriver.com/mountain-report',
};

/** Reads "12/135" or "12 of 135" out of a blob of rendered text. */
function findCount(text, ...labels) {
  for (const label of labels) {
    const re = new RegExp(`(\\d+)\\s*(?:/|of)\\s*(\\d+)[^.]{0,24}${label}`, 'i');
    const m = text.match(re);
    if (m) return { open: Number(m[1]), total: Number(m[2]) };
    const re2 = new RegExp(`${label}[^\\d]{0,24}(\\d+)\\s*(?:/|of)\\s*(\\d+)`, 'i');
    const m2 = text.match(re2);
    if (m2) return { open: Number(m2[1]), total: Number(m2[2]) };
  }
  return null;
}

function findInches(text, ...labels) {
  for (const label of labels) {
    const re = new RegExp(`${label}[^\\d-]{0,30}(-?\\d+(?:\\.\\d+)?)\\s*(?:"|in\\b)?`, 'i');
    const m = text.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

export default async function fetchSundayRiver({ get, meta: adapterMeta }) {
  // The robots check and the per-host throttle live in `get`, so we call it
  // first even though we cannot use the HTML. This keeps one resort to one
  // host hit per run and keeps the robots decision in one place.
  await get(adapterMeta.reportUrl);

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return {
      status: 'error',
      reason: 'browser tier unavailable: playwright is not installed (npm i -D playwright)',
      sourceUrl: meta.reportUrl,
    };
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      userAgent: (await import('../fetch-snow.mjs')).USER_AGENT,
    });
    await page.goto(meta.reportUrl, { waitUntil: 'networkidle', timeout: 45_000 });

    // Wait for the placeholders to be replaced, but do not hang the run on it.
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading...'),
      { timeout: 20_000 },
    ).catch(() => { /* fall through and parse whatever rendered */ });

    const text = (await page.innerText('body')).replace(/\s+/g, ' ');

    const trails = findCount(text, 'trails?');
    const lifts = findCount(text, 'lifts?');

    return {
      newSnow24h: findInches(text, '24 hour', '24hr', 'new snow'),
      newSnow48h: findInches(text, '48 hour', '48hr'),
      newSnow7d: findInches(text, '7 day', 'past week'),
      baseDepth: findInches(text, 'base depth', 'mid.?mountain base'),
      seasonTotal: findInches(text, 'season total', 'season to date'),
      trailsOpen: trails?.open ?? null,
      trailsTotal: trails?.total ?? null,
      liftsOpen: lifts?.open ?? null,
      liftsTotal: lifts?.total ?? null,
      surface: null,
      sourceUrl: meta.reportUrl,
    };
  } finally {
    await browser.close();
  }
}
