/**
 * weather.js - Open-Meteo client.
 *
 * No API key, CORS-enabled, free for non-commercial use under CC BY 4.0. The
 * attribution their licence requires is rendered in the footer of every page.
 *
 * Two things in their terms shape this module:
 *
 *   1. The free tier allows fewer than 10,000 calls a day. One request per
 *      resort on conditions.html would be ~45 calls per page view, which
 *      exhausts the daily allowance in about 220 visits. So `getForecasts`
 *      batches coordinates into a single request - Open-Meteo accepts comma
 *      separated latitude/longitude lists and returns an array in the same
 *      order. A batch that fails is retried one resort at a time, so a single
 *      bad coordinate degrades one row rather than the whole page.
 *   2. Results are cached in sessionStorage for 30 minutes, keyed per resort,
 *      so moving between conditions.html and a detail page costs nothing.
 *
 * Every call goes to the SUMMIT lat/lon. A couple of thousand feet is the
 * difference between rain and snow, so the base lodge is the wrong thing to ask
 * about.
 */

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

const CACHE_PREFIX = 'nesg:wx:v1:';
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Coordinates per request. Well inside any practical URL length limit. */
const BATCH_SIZE = 25;

const QUERY = {
  current: 'temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,weather_code,is_day',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_probability_max',
  temperature_unit: 'fahrenheit',
  wind_speed_unit: 'mph',
  precipitation_unit: 'inch',
  timezone: 'America/New_York',
  forecast_days: '7',
};

/** WMO weather interpretation codes, in the words this site would use. */
const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorms', 96: 'Thunderstorms', 99: 'Thunderstorms',
};

/** Codes that mean frozen precipitation, for colouring a row. */
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86, 56, 57, 66, 67]);

export const conditionLabel = (code) => WMO[code] ?? 'Unknown';
export const isSnowing = (code) => SNOW_CODES.has(code);

// --- cache ------------------------------------------------------------------

/** sessionStorage throws in some privacy modes; treat it as best-effort. */
function cacheGet(slug) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.t || Date.now() - entry.t > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_PREFIX + slug);
      return null;
    }
    return { ...entry.d, fetchedAt: new Date(entry.t).toISOString(), cached: true };
  } catch {
    return null;
  }
}

function cacheSet(slug, data) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* Quota or disabled storage. The forecast still works, it just re-fetches. */
  }
}

/** Exposed so a "refresh" control can drop the cache without a reload. */
export function clearForecastCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* nothing to clear */ }
}

// --- fetching ---------------------------------------------------------------

function buildUrl(points) {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    ...QUERY,
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
  });
  return url;
}

/**
 * One HTTP request for up to BATCH_SIZE coordinates.
 * Resolves to an array of raw Open-Meteo objects in the order given.
 */
async function fetchBatch(points, signal) {
  const res = await fetch(buildUrl(points), { signal });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body = await res.json();
  // A single coordinate returns an object; several return an array.
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== points.length) {
    throw new Error(`Open-Meteo returned ${list.length} results for ${points.length} locations`);
  }
  return list;
}

/** Normalises a raw response into the shape the renderers consume. */
function normalise(raw) {
  const current = raw.current ?? {};
  const daily = raw.daily ?? {};
  const days = (daily.time ?? []).map((date, i) => ({
    date,
    code: daily.weather_code?.[i] ?? null,
    high: daily.temperature_2m_max?.[i] ?? null,
    low: daily.temperature_2m_min?.[i] ?? null,
    snow: daily.snowfall_sum?.[i] ?? null,
    precipChance: daily.precipitation_probability_max?.[i] ?? null,
  }));

  return {
    current: {
      temp: current.temperature_2m ?? null,
      feelsLike: current.apparent_temperature ?? null,
      wind: current.wind_speed_10m ?? null,
      gust: current.wind_gusts_10m ?? null,
      code: current.weather_code ?? null,
      isDay: current.is_day === 1,
      time: current.time ?? null,
    },
    days,
    elevation: raw.elevation ?? null,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

/**
 * Forecasts for many resorts.
 *
 * @param {Array<{slug, lat, lon}>} resorts
 * @returns {Promise<Map<string, {status:'ok', data} | {status:'error', reason}>>}
 *
 * Never rejects. Every resort ends up with an entry, so a caller can render the
 * whole table and let the failures degrade to a "weather unavailable" row.
 */
export async function getForecasts(resorts, { signal } = {}) {
  const results = new Map();
  const pending = [];

  for (const r of resorts) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) {
      results.set(r.slug, { status: 'error', reason: 'No coordinates on record' });
      continue;
    }
    const hit = cacheGet(r.slug);
    if (hit) results.set(r.slug, { status: 'ok', data: hit });
    else pending.push(r);
  }

  const batches = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      try {
        return { batch, list: await fetchBatch(batch, signal) };
      } catch (batchError) {
        // One bad coordinate fails the whole batch, so fall back to asking for
        // each resort on its own. A single resort then degrades alone.
        const each = await Promise.allSettled(
          batch.map((r) => fetchBatch([r], signal).then((l) => l[0]))
        );
        return {
          batch,
          list: each.map((o) => (o.status === 'fulfilled' ? o.value : null)),
          batchError,
        };
      }
    })
  );

  for (const outcome of settled) {
    if (outcome.status === 'rejected') continue; // handled below by the sweep
    const { batch, list } = outcome.value;
    batch.forEach((r, i) => {
      const raw = list[i];
      if (!raw) {
        results.set(r.slug, { status: 'error', reason: 'Forecast request failed' });
        return;
      }
      const data = normalise(raw);
      cacheSet(r.slug, data);
      results.set(r.slug, { status: 'ok', data });
    });
  }

  // Anything the loop above could not account for - an aborted request, a
  // rejected retry - still gets an entry, because the page renders every resort.
  for (const r of resorts) {
    if (!results.has(r.slug)) {
      results.set(r.slug, { status: 'error', reason: 'Forecast unavailable' });
    }
  }

  return results;
}

/** Forecast for one resort. Same cache and the same never-throws contract. */
export async function getForecast(resort, options) {
  const results = await getForecasts([resort], options);
  return results.get(resort.slug);
}

// --- derived figures --------------------------------------------------------

/** Total forecast snowfall in inches over the next `days`. Drives the ranking. */
export function snowfallTotal(forecast, days = 7) {
  if (!forecast?.days?.length) return null;
  return forecast.days
    .slice(0, days)
    .reduce((sum, d) => sum + (Number.isFinite(d.snow) ? d.snow : 0), 0);
}

/** Snowfall in the next 24 hours, i.e. today's daily total. */
export function snowfallToday(forecast) {
  const first = forecast?.days?.[0];
  return first && Number.isFinite(first.snow) ? first.snow : null;
}
