#!/usr/bin/env node
/**
 * build-index.mjs — regenerates data/index.json from data/resorts/*.json.
 *
 * index.json is the manifest the list pages load: one request instead of 45.
 * It carries only what index.html, conditions.html, compare.html and map.html
 * actually render — no editorial prose, which is the bulk of a resort file and
 * appears on no list page. Shape is documented in data/schema.md §13.
 *
 * This script deliberately does NOT validate. It is a projection, not a gate;
 * run `node tools/validate.mjs` for that. It will still refuse to write an index
 * from a file it cannot parse or that has no slug, because that produces a
 * silently broken site.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESORTS_DIR = path.join(ROOT, 'data', 'resorts');
const INDEX_PATH = path.join(ROOT, 'data', 'index.json');

const SCHEMA_VERSION = 3;

/** Reads a nested value without throwing on a missing group. */
const get = (obj, group, field) =>
  obj && obj[group] && typeof obj[group] === 'object' && !Array.isArray(obj[group])
    ? obj[group][field] ?? null
    : null;

function summarize(r) {
  const passes = Array.isArray(r.passes) ? r.passes.filter((p) => p && typeof p === 'object') : [];

  return {
    slug: get(r, 'identity', 'slug'),
    name: get(r, 'identity', 'name'),
    // Former names matter to two pages: the 404 page matches a dead link against
    // them (Suicide Six and Shawnee Peak both renamed inside the last few years,
    // and the old names are still all over the web), and the sitemap does not.
    aka: Array.isArray(get(r, 'identity', 'aka')) ? r.identity.aka : [],
    state: get(r, 'identity', 'state'),
    region: get(r, 'identity', 'region'),
    town: get(r, 'identity', 'town'),
    lat: get(r, 'identity', 'lat'),
    lon: get(r, 'identity', 'lon'),
    website: get(r, 'identity', 'website'),

    verticalDrop: get(r, 'size', 'verticalDrop'),
    skiableAcres: get(r, 'size', 'skiableAcres'),
    trailCount: get(r, 'size', 'trailCount'),
    liftCount: get(r, 'size', 'liftCount'),
    annualSnowfallAvg: get(r, 'size', 'annualSnowfallAvg'),
    snowmakingPercent: get(r, 'size', 'snowmakingPercent'),
    nightSkiing: get(r, 'size', 'nightSkiing'),

    // Precomputed so the pass filter is a set-membership test rather than a
    // nested scan on every keystroke.
    passTypes: [...new Set(passes.map((p) => p.type).filter(Boolean))],
    passes: passes.map((p) => ({
      name: p.name ?? null,
      type: p.type ?? null,
      access: p.access ?? null,
    })),

    advanceTypical: get(r, 'pricing', 'advanceTypical'),
    seasonPassAdult: get(r, 'pricing', 'seasonPassAdult'),

    // Flattened so the Features filters are a flat test rather than a nested
    // scan on every keystroke, same reasoning as passTypes above.
    mogulPresence: get(r, 'moguls', 'presence'),
    parkCount: get(r, 'parks', 'count'),
    hasPark: Number.isInteger(get(r, 'parks', 'count'))
      ? r.parks.count > 0
      : null,
    hasPipe: get(r, 'parks', 'pipe'),

    bestFor: Array.isArray(get(r, 'editorial', 'bestFor')) ? r.editorial.bestFor : [],

    officialSnowReport: get(r, 'links', 'officialSnowReport'),
    verifiedOn: get(r, 'meta', 'verifiedOn'),
  };
}

async function main() {
  if (!existsSync(RESORTS_DIR)) {
    console.error(`build-index: ${path.relative(ROOT, RESORTS_DIR)} does not exist`);
    process.exit(1);
  }

  const files = (await readdir(RESORTS_DIR)).filter((f) => f.endsWith('.json')).sort();
  const resorts = [];
  const failures = [];

  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(await readFile(path.join(RESORTS_DIR, file), 'utf8'));
    } catch (e) {
      failures.push(`${file}: not valid JSON — ${e.message}`);
      continue;
    }
    const entry = summarize(parsed);
    if (!entry.slug) {
      failures.push(`${file}: no identity.slug, cannot be indexed`);
      continue;
    }
    if (`${entry.slug}.json` !== file) {
      failures.push(`${file}: identity.slug "${entry.slug}" does not match the filename`);
      continue;
    }
    resorts.push(entry);
  }

  if (failures.length) {
    for (const f of failures) console.error(`ERROR  ${f}`);
    console.error('\nbuild-index: refusing to write a partial index. Fix the above, then re-run.');
    process.exit(1);
  }

  // Sorted by name so adding a resort produces a small, stable diff.
  resorts.sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));

  const index = {
    generatedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    count: resorts.length,
    resorts,
  };

  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(
    `build-index: wrote ${path.relative(ROOT, INDEX_PATH).replace(/\\/g, '/')} — ${resorts.length} resort(s)`
  );
}

main().catch((e) => {
  console.error('build-index: unexpected failure\n', e);
  process.exit(1);
});
