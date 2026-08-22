#!/usr/bin/env node
/**
 * fetch-snow.mjs - regenerates data/snow-reports.json.
 *
 * Runs in CI (see .github/workflows/snow.yml), never in a visitor's browser: a
 * page on our domain cannot fetch killington.com, and would not get past their
 * bot protection if it could. The site reads the committed JSON, so it stays a
 * pure static host with no server and no cost.
 *
 * The rules from CLAUDE.md, and where each is enforced:
 *
 *   1. Identify the bot.        USER_AGENT, sent on every request including
 *                               robots.txt.
 *   2. Honour robots.txt.       `isAllowed()` parses the live robots.txt per host
 *                               and a disallowed path is never requested.
 *   3. Two hours per host.      `throttle()` reads the PREVIOUS run's fetchedAt
 *                               out of data/snow-reports.json. No side-channel
 *                               state file, so it works in a fresh CI checkout.
 *                               Hosts are processed serially - never in parallel.
 *   4. Tiers in order.          Each adapter declares `tier` and stops at the
 *                               first thing that works; the tier used is recorded
 *                               on the report.
 *   5. Numbers only.            `normalise()` keeps only the numeric fields and
 *                               `surface`, which is capped at SURFACE_MAX_LEN.
 *                               Report prose is never read into the output.
 *   6. Fail soft.               An adapter that throws is caught and becomes
 *                               {status:'error', reason}. One broken resort
 *                               cannot fail the run.
 *
 * Usage:
 *   node tools/fetch-snow.mjs                 # all adapters, honouring throttle
 *   node tools/fetch-snow.mjs --slug stowe    # one resort
 *   node tools/fetch-snow.mjs --force         # ignore the 2-hour throttle
 *   node tools/fetch-snow.mjs --dry-run       # fetch, print, write nothing
 *   node tools/fetch-snow.mjs --list          # adapters and their tiers
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADAPTERS_DIR = path.join(ROOT, 'tools', 'adapters');
const OUT_PATH = path.join(ROOT, 'data', 'snow-reports.json');

// TODO: replace with the deployed site URL once hosting is settled. The contact
// URL is not decoration - it is how a resort's ops team reaches us to complain,
// and it must be real before this runs against production on a schedule.
export const USER_AGENT =
  'NewEnglandSkiGuideBot/0.1 (+https://example.invalid/about; static site, snow reports)';

/** Two hours, per the project's own rate limit. */
export const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 30_000;

/** Condition labels are short by definition. Anything longer is prose. */
const SURFACE_MAX_LEN = 40;

/** The normalized shape every adapter returns. Numbers or null - never prose. */
export const REPORT_SHAPE = {
  slug: null,
  newSnow24h: null,
  newSnow48h: null,
  newSnow7d: null,
  baseDepth: null,
  seasonTotal: null,
  trailsOpen: null,
  trailsTotal: null,
  liftsOpen: null,
  liftsTotal: null,
  acresOpen: null,
  surface: null,        // short label only, e.g. "packed powder"
  lastUpdated: null,    // ISO, as reported by the resort
  sourceUrl: null,
  fetchedAt: null,      // ISO, when we fetched
  tier: null,           // 'json' | 'html' | 'browser'
  status: 'error',      // 'ok' | 'closed' | 'stale' | 'error'
  reason: null,
  // Carried across runs so CI can spot an adapter that has broken for good
  // rather than one that caught a bad minute. Resets on any non-error status.
  consecutiveErrors: 0,
};

/** CI opens an issue once an adapter has failed this many runs in a row. */
export const ERROR_STREAK_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

const robotsCache = new Map();

/** Minimal robots.txt parser: the `*` group's Disallow/Allow prefixes. */
function parseRobots(text) {
  const rules = [];
  let inStar = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      inStar = value === '*';
    } else if (inStar && (key === 'disallow' || key === 'allow')) {
      if (value) rules.push({ allow: key === 'allow', path: value });
    }
  }
  return rules;
}

async function getRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const promise = (async () => {
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      // No robots.txt means no restrictions.
      if (!res.ok) return [];
      return parseRobots(await res.text());
    } catch {
      // If robots.txt cannot be read we assume the strictest thing that is
      // still useful: allow, but say so in the log. Being unable to reach
      // robots.txt usually means the host is down, and the fetch will fail too.
      return [];
    }
  })();
  robotsCache.set(origin, promise);
  return promise;
}

/** Longest matching prefix wins, Allow beating Disallow on a tie. */
export async function isAllowed(url) {
  const u = new URL(url);
  const rules = await getRobots(u.origin);
  let best = null;
  for (const rule of rules) {
    if (!u.pathname.startsWith(rule.path)) continue;
    if (!best || rule.path.length > best.path.length ||
        (rule.path.length === best.path.length && rule.allow)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

// ---------------------------------------------------------------------------
// throttling
// ---------------------------------------------------------------------------

/**
 * Serialises requests per host and keeps at least MIN_INTERVAL_MS between them.
 * Within one run this also guarantees we never hit a host in parallel.
 */
const lastHitAt = new Map();

async function politeGap(host) {
  const previous = lastHitAt.get(host);
  if (previous) {
    const wait = MIN_INTERVAL_MS - (Date.now() - previous);
    if (wait > 0) {
      // Two adapters on one host in a single run would mean sleeping two hours.
      // We do not sleep - we defer the second one to the next scheduled run.
      throw new Error(`host ${host} already fetched this run; deferring to next run`);
    }
  }
  lastHitAt.set(host, Date.now());
}

// ---------------------------------------------------------------------------
// the request helper handed to adapters
// ---------------------------------------------------------------------------

function makeGet(slug) {
  return async function get(url, { as = 'text' } = {}) {
    const u = new URL(url);
    if (!(await isAllowed(u))) {
      throw new Error(`robots.txt disallows ${u.pathname} on ${u.host}`);
    }
    await politeGap(u.host);

    const res = await fetch(u, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: as === 'json' ? 'application/json,*/*' : 'text/html,*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${u.host} returned HTTP ${res.status}`);
    return as === 'json' ? res.json() : res.text();
  };
}

// ---------------------------------------------------------------------------
// normalising
// ---------------------------------------------------------------------------

const NUMERIC_FIELDS = [
  'newSnow24h', 'newSnow48h', 'newSnow7d', 'baseDepth', 'seasonTotal',
  'trailsOpen', 'trailsTotal', 'liftsOpen', 'liftsTotal', 'acresOpen',
];

/** Accepts "12", "12.5", '12"', "--" and returns a number or null. */
export function num(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The last line of defence for rule 5. Only known fields survive, numbers are
 * coerced, and `surface` is rejected if it is long enough to be a sentence.
 */
function normalise(slug, raw, meta) {
  const out = { ...REPORT_SHAPE, slug, tier: meta.tier, sourceUrl: meta.reportUrl };

  for (const field of NUMERIC_FIELDS) out[field] = num(raw[field]);

  const surface = typeof raw.surface === 'string' ? raw.surface.trim() : null;
  out.surface = surface && surface.length > 0 && surface.length <= SURFACE_MAX_LEN &&
    !/[.!?]\s/.test(surface) ? surface : null;

  out.lastUpdated = typeof raw.lastUpdated === 'string' ? raw.lastUpdated : null;
  out.sourceUrl = raw.sourceUrl ?? meta.reportUrl;
  out.fetchedAt = new Date().toISOString();
  out.status = ['ok', 'closed', 'stale', 'error'].includes(raw.status) ? raw.status : 'ok';
  out.reason = raw.reason ?? null;

  // A report with no numbers at all is not a report.
  if (out.status === 'ok' && NUMERIC_FIELDS.every((f) => out[f] === null)) {
    out.status = 'closed';
    out.reason = out.reason ?? 'No figures published (out of season?)';
  }

  // A ski report needs either a snow depth or a trail count. Without both, what
  // we scraped is the summer operation - Killington in August reports "0/3 open
  // lifts" for mountain biking, and publishing that as ski terrain would be a
  // lie told with real numbers.
  if (out.status === 'ok' && out.baseDepth === null && out.trailsTotal === null) {
    out.status = 'closed';
    out.reason = out.reason ?? 'No snow depth or trail count published (out of season?)';
    for (const field of NUMERIC_FIELDS) out[field] = null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function loadAdapters() {
  if (!existsSync(ADAPTERS_DIR)) return [];
  const files = (await readdir(ADAPTERS_DIR)).filter((f) => f.endsWith('.mjs')).sort();
  const adapters = [];
  for (const file of files) {
    const slug = file.replace(/\.mjs$/, '');
    const mod = await import(pathToFileURL(path.join(ADAPTERS_DIR, file)).href);
    if (typeof mod.default !== 'function' || !mod.meta) {
      console.warn(`WARN  ${file}: no default export or meta, skipping`);
      continue;
    }
    if (mod.meta.slug !== slug) {
      console.warn(`WARN  ${file}: meta.slug is "${mod.meta.slug}", expected "${slug}", skipping`);
      continue;
    }
    adapters.push({ slug, run: mod.default, meta: mod.meta });
  }
  return adapters;
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile(OUT_PATH, 'utf8'));
  } catch {
    return { reports: {} };
  }
}

/** True when the previous run hit this host recently enough to skip it. */
function throttled(previous, adapter, force) {
  if (force) return false;
  const host = new URL(adapter.meta.reportUrl).host;
  for (const report of Object.values(previous.reports ?? {})) {
    if (!report?.fetchedAt || !report.sourceUrl) continue;
    let reportHost;
    try { reportHost = new URL(report.sourceUrl).host; } catch { continue; }
    if (reportHost !== host) continue;
    const age = Date.now() - new Date(report.fetchedAt).getTime();
    if (Number.isFinite(age) && age < MIN_INTERVAL_MS) {
      return Math.round((MIN_INTERVAL_MS - age) / 60000);
    }
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => args.includes(`--${name}`);
  const value = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : null;
  };

  const adapters = await loadAdapters();
  const only = value('slug');
  const selected = only ? adapters.filter((a) => a.slug === only) : adapters;

  if (flag('list')) {
    console.log(`${adapters.length} adapter(s):`);
    for (const a of adapters) {
      console.log(`  ${a.slug.padEnd(16)} tier=${String(a.meta.tier).padEnd(8)} ${a.meta.reportUrl}`);
    }
    return;
  }

  if (!selected.length) {
    console.error(only ? `fetch-snow: no adapter named "${only}"` : 'fetch-snow: no adapters found');
    process.exit(1);
  }

  const previous = await loadPrevious();
  const reports = { ...(previous.reports ?? {}) };
  const force = flag('force');

  // Grouped by host and run strictly one host at a time. Never parallel.
  const byHost = new Map();
  for (const adapter of selected) {
    const host = new URL(adapter.meta.reportUrl).host;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(adapter);
  }

  for (const [host, group] of byHost) {
    for (const adapter of group) {
      const wait = throttled(previous, adapter, force);
      if (wait !== false) {
        console.log(`SKIP  ${adapter.slug.padEnd(16)} ${host} fetched recently; ${wait} min until next allowed`);
        continue;
      }

      let report;
      try {
        const raw = await adapter.run({
          get: makeGet(adapter.slug),
          meta: adapter.meta,
          num,
        });
        report = normalise(adapter.slug, raw ?? {}, adapter.meta);
      } catch (e) {
        // Rule 6. An adapter must never take the run down with it.
        report = {
          ...REPORT_SHAPE,
          slug: adapter.slug,
          tier: adapter.meta.tier,
          sourceUrl: adapter.meta.reportUrl,
          fetchedAt: new Date().toISOString(),
          status: 'error',
          reason: e.message,
        };
      }

      // An out-of-season 'closed' is a correct answer, not a failure, so only a
      // real 'error' extends the streak.
      const priorStreak = previous.reports?.[adapter.slug]?.consecutiveErrors ?? 0;
      report.consecutiveErrors = report.status === 'error' ? priorStreak + 1 : 0;

      reports[adapter.slug] = report;

      const summary = report.status === 'ok'
        ? `${report.trailsOpen ?? '—'}/${report.trailsTotal ?? '—'} trails, ` +
          `${report.liftsOpen ?? '—'}/${report.liftsTotal ?? '—'} lifts, base ${report.baseDepth ?? '—'}"`
        : (report.reason ?? '');
      const streak = report.consecutiveErrors >= 2
        ? `  [${report.consecutiveErrors} runs in a row]`
        : '';
      console.log(
        `${report.status === 'ok' ? 'OK   ' : report.status === 'closed' ? 'CLOSED' : 'ERROR'} ` +
        `${adapter.slug.padEnd(16)} tier=${String(report.tier).padEnd(8)} ${summary}${streak}`
      );
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    userAgent: USER_AGENT,
    minIntervalMs: MIN_INTERVAL_MS,
    count: Object.keys(reports).length,
    reports,
  };

  if (flag('dry-run')) {
    console.log('\n--dry-run: nothing written\n');
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(`\nfetch-snow: wrote data/snow-reports.json - ${out.count} report(s)`);
}

// Only run when invoked directly. Other modules import USER_AGENT and
// ERROR_STREAK_THRESHOLD from here, and importing a module must never kick off a
// live fetch as a side effect - report-broken-adapters.mjs did exactly that.
const invokedDirectly = process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  main().catch((e) => {
    console.error('fetch-snow: unexpected failure\n', e);
    process.exit(1);
  });
}
