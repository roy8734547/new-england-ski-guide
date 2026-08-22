#!/usr/bin/env node
/**
 * validate.mjs — schema + sanity checks for every file in data/resorts/.
 *
 * The data is the product, so this is the gate that keeps it honest. It checks
 * structure, types, enums, cross-field arithmetic and the private/ boundary,
 * then writes every unsourced (null) field into data/UNVERIFIED.md as a
 * research worklist.
 *
 * Exit 0 = clean or warnings only. Exit 1 = at least one error.
 *
 * The contract this enforces is documented in data/schema.md. Change one, change
 * the other, in the same commit.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESORTS_DIR = path.join(ROOT, 'data', 'resorts');
const UNVERIFIED_PATH = path.join(ROOT, 'data', 'UNVERIFIED.md');

const SCHEMA_VERSION = 1;

const STATES = ['VT', 'NH', 'ME', 'MA', 'CT', 'RI'];

const REGIONS = [
  'Southern Vermont', 'Central Vermont', 'Northern Vermont', 'Northeast Kingdom',
  'White Mountains', 'Mount Washington Valley', 'Lakes Region', 'Southern New Hampshire',
  'Dartmouth-Sunapee', 'Western Maine', 'Central Maine', 'Midcoast Maine',
  'Northern Maine', 'Berkshires', 'Central Massachusetts', 'Northwest Connecticut',
];

const PASS_TYPES = ['epic', 'ikon', 'indy', 'other', 'none'];

// Generous bounding box around New England. Catches sign errors and transposed
// lat/lon, which are the two mistakes that actually happen.
const BBOX = { latMin: 40.9, latMax: 47.6, lonMin: -73.9, lonMax: -66.8 };

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Field specs. `n` = nullable (a null here lands in UNVERIFIED.md);
 * omitting `n` means the field must carry a real value.
 * `min`/`max` are inclusive range checks applied only when the value is present.
 */
const SPEC = {
  identity: {
    slug: { type: 'string' },
    name: { type: 'string' },
    aka: { type: 'string[]' },
    state: { type: 'string', enum: STATES },
    region: { type: 'string', enum: REGIONS },
    town: { type: 'string' },
    lat: { type: 'number', min: BBOX.latMin, max: BBOX.latMax },
    lon: { type: 'number', min: BBOX.lonMin, max: BBOX.lonMax },
    website: { type: 'url' },
  },
  size: {
    verticalDrop: { type: 'integer', n: true, min: 1, max: 5000 },
    skiableAcres: { type: 'number', n: true, min: 1, max: 10000 },
    trailCount: { type: 'integer', n: true, min: 1, max: 500 },
    liftCount: { type: 'integer', n: true, min: 1, max: 100 },
    longestRun: { type: 'number', n: true, min: 0.1, max: 15 },
    summitElevation: { type: 'integer', n: true, min: 100, max: 7000 },
    baseElevation: { type: 'integer', n: true, min: 0, max: 5000 },
    annualSnowfallAvg: { type: 'integer', n: true, min: 10, max: 600 },
    snowmakingPercent: { type: 'integer', n: true, min: 0, max: 100 },
    nightSkiing: { type: 'boolean', n: true },
    source: { type: 'url' },
    verifiedOn: { type: 'date' },
    fieldSources: { type: 'fieldSources' },
  },
  terrain: {
    percentBeginner: { type: 'integer', n: true, min: 0, max: 100 },
    percentIntermediate: { type: 'integer', n: true, min: 0, max: 100 },
    percentAdvanced: { type: 'integer', n: true, min: 0, max: 100 },
    percentExpert: { type: 'integer', n: true, min: 0, max: 100 },
    glades: { type: 'boolean', n: true },
    moguls: { type: 'boolean', n: true },
    terrainParks: { type: 'integer', n: true, min: 0, max: 20 },
    difficultyNotes: { type: 'string', n: true },
    source: { type: 'url' },
    verifiedOn: { type: 'date' },
    fieldSources: { type: 'fieldSources' },
  },
  pricing: {
    windowTicketAdultHigh: { type: 'number', n: true, min: 1, max: 3000 },
    windowTicketAdultLow: { type: 'number', n: true, min: 1, max: 3000 },
    advanceTypical: { type: 'number', n: true, min: 1, max: 3000 },
    seasonPassAdult: { type: 'number', n: true, min: 1, max: 5000 },
    currency: { type: 'string' },
    notes: { type: 'string', n: true },
    verifiedOn: { type: 'date' },
    source: { type: 'url' },
    fieldSources: { type: 'fieldSources' },
  },
  editorial: {
    overview: { type: 'string' },
    snowQuality: { type: 'string', n: true },
    crowds: { type: 'string', n: true },
    difficulty: { type: 'string', n: true },
    keyTrails: { type: 'keyTrail[]' },
    tidbits: { type: 'string[]' },
    bestFor: { type: 'string[]' },
    watchOutFor: { type: 'string[]' },
  },
  links: {
    officialSnowReport: { type: 'url', n: true },
    trailMap: { type: 'url', n: true },
    webcams: { type: 'url', n: true },
    lodging: { type: 'url', n: true },
    twitter: { type: 'url', n: true },
    instagram: { type: 'url', n: true },
  },
  meta: {
    sources: { type: 'source[]' },
    verifiedOn: { type: 'date' },
    lastEditedBy: { type: 'string' },
  },
};

const PASS_SPEC = {
  name: { type: 'string' },
  type: { type: 'string', enum: PASS_TYPES },
  access: { type: 'string' },
  blackouts: { type: 'string', n: true },
  verifiedOn: { type: 'date' },
  source: { type: 'url' },
};

const REVIEW_SPEC = {
  source: { type: 'string' },
  url: { type: 'url' },
  gist: { type: 'string' },
  rating: { type: 'number', n: true, min: 0, max: 100 },
  ratingScale: { type: 'number', n: true, min: 1, max: 100 },
};

// Editorial length guidance from schema.md §8, checked as warnings only.
const PROSE_WORDS = {
  overview: [120, 400],
  snowQuality: [60, 200],
  crowds: [60, 200],
  difficulty: [60, 200],
};

const CHIP_MAX = 40;
const PRICE_STALE_DAYS = 180;
const VERTICAL_WARN_BELOW = 600;

// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function words(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function isValidDate(v) {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function daysBetween(from, to) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000
  );
}

/** Returns an error string, or null when the URL is acceptable. */
function urlProblem(v) {
  if (typeof v !== 'string' || v.trim() === '') return 'must be a non-empty URL string';
  if (v.includes('private/')) return 'points inside private/ — see schema.md §10';
  let u;
  try {
    u = new URL(v);
  } catch {
    return `is not an absolute URL: ${JSON.stringify(v)}`;
  }
  if (u.protocol === 'http:') return `must use https, not http: ${v}`;
  if (u.protocol !== 'https:') return `must use https: ${v}`;
  return null;
}

class Report {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.unverified = [];
  }
  err(file, msg) { this.errors.push({ file, msg }); }
  warn(file, msg) { this.warnings.push({ file, msg }); }
  gap(file, name, field) { this.unverified.push({ file, name, field }); }
}

/**
 * Type/enum/range check for one field. Records the null into UNVERIFIED when the
 * spec allows null. Returns true when a real (non-null) value is present and valid.
 */
function checkField(report, file, name, pathStr, spec, value) {
  if (value === undefined) {
    report.err(file, `${pathStr} is missing — every key must be present (schema.md §1.4)`);
    return false;
  }
  if (value === null) {
    if (!spec.n) {
      report.err(file, `${pathStr} may not be null`);
      return false;
    }
    report.gap(file, name, pathStr);
    return false;
  }

  const t = spec.type;
  const fail = (msg) => { report.err(file, `${pathStr} ${msg}`); return false; };

  switch (t) {
    case 'string':
      if (typeof value !== 'string') return fail('must be a string');
      if (value.trim() === '') return fail('must not be an empty string — use null');
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return fail('must be true or false');
      break;
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || !Number.isFinite(value)) return fail('must be a number');
      if (t === 'integer' && !Number.isInteger(value)) return fail(`must be a whole number, got ${value}`);
      if (spec.min !== undefined && value < spec.min) return fail(`is ${value}, below the plausible minimum ${spec.min}`);
      if (spec.max !== undefined && value > spec.max) return fail(`is ${value}, above the plausible maximum ${spec.max}`);
      break;
    case 'date':
      if (!isValidDate(value)) return fail(`must be an ISO date (YYYY-MM-DD), got ${JSON.stringify(value)}`);
      if (value > today) return fail(`is in the future: ${value}`);
      break;
    case 'url': {
      const problem = urlProblem(value);
      if (problem) return fail(problem);
      break;
    }
    case 'string[]':
      if (!Array.isArray(value)) return fail('must be an array of strings');
      value.forEach((s, i) => {
        if (typeof s !== 'string' || s.trim() === '') {
          report.err(file, `${pathStr}[${i}] must be a non-empty string`);
        }
      });
      break;
    case 'keyTrail[]':
      if (!Array.isArray(value)) return fail('must be an array');
      value.forEach((entry, i) => {
        if (!isPlainObject(entry)) {
          report.err(file, `${pathStr}[${i}] must be an object {name, note}`);
          return;
        }
        for (const k of ['name', 'note']) {
          if (typeof entry[k] !== 'string' || entry[k].trim() === '') {
            report.err(file, `${pathStr}[${i}].${k} must be a non-empty string`);
          }
        }
        for (const k of Object.keys(entry)) {
          if (!['name', 'note'].includes(k)) {
            report.err(file, `${pathStr}[${i}] has unknown key "${k}"`);
          }
        }
      });
      break;
    case 'source[]':
      if (!Array.isArray(value)) return fail('must be an array');
      value.forEach((entry, i) => {
        if (!isPlainObject(entry)) {
          report.err(file, `${pathStr}[${i}] must be an object {label, url, accessedOn}`);
          return;
        }
        if (typeof entry.label !== 'string' || entry.label.trim() === '') {
          report.err(file, `${pathStr}[${i}].label must be a non-empty string`);
        }
        const problem = urlProblem(entry.url);
        if (problem) report.err(file, `${pathStr}[${i}].url ${problem}`);
        if (!isValidDate(entry.accessedOn)) {
          report.err(file, `${pathStr}[${i}].accessedOn must be an ISO date`);
        } else if (entry.accessedOn > today) {
          report.err(file, `${pathStr}[${i}].accessedOn is in the future`);
        }
        for (const k of Object.keys(entry)) {
          if (!['label', 'url', 'accessedOn'].includes(k)) {
            report.err(file, `${pathStr}[${i}] has unknown key "${k}"`);
          }
        }
      });
      break;
    case 'fieldSources':
      if (!isPlainObject(value)) return fail('must be an object (use {} when there are no overrides)');
      break;
    default:
      return fail(`has no validator for type "${t}" — validate.mjs bug`);
  }

  if (spec.enum && !spec.enum.includes(value)) {
    return fail(`must be one of ${spec.enum.join(', ')} — got ${JSON.stringify(value)}`);
  }
  return true;
}

/** Validates a group object against its spec and rejects unknown keys. */
function checkGroup(report, file, name, groupName, spec, group) {
  if (!isPlainObject(group)) {
    report.err(file, `${groupName} must be an object`);
    return;
  }
  for (const [field, fieldSpec] of Object.entries(spec)) {
    checkField(report, file, name, `${groupName}.${field}`, fieldSpec, group[field]);
  }
  for (const key of Object.keys(group)) {
    if (!(key in spec)) {
      report.err(file, `${groupName} has unknown key "${key}" — typo, or schema.md needs updating`);
    }
  }
  // fieldSources keys must name real fields of this group (schema.md §1.2).
  if (isPlainObject(group.fieldSources)) {
    for (const [key, override] of Object.entries(group.fieldSources)) {
      if (!(key in spec) || ['source', 'verifiedOn', 'fieldSources'].includes(key)) {
        report.err(file, `${groupName}.fieldSources."${key}" is not a data field of ${groupName}`);
        continue;
      }
      if (!isPlainObject(override)) {
        report.err(file, `${groupName}.fieldSources."${key}" must be {source, verifiedOn}`);
        continue;
      }
      const problem = urlProblem(override.source);
      if (problem) report.err(file, `${groupName}.fieldSources."${key}".source ${problem}`);
      if (!isValidDate(override.verifiedOn)) {
        report.err(file, `${groupName}.fieldSources."${key}".verifiedOn must be an ISO date`);
      }
    }
  }
}

function checkArrayGroup(report, file, name, groupName, spec, arr) {
  if (!Array.isArray(arr)) {
    report.err(file, `${groupName} must be an array`);
    return;
  }
  arr.forEach((entry, i) => {
    if (!isPlainObject(entry)) {
      report.err(file, `${groupName}[${i}] must be an object`);
      return;
    }
    for (const [field, fieldSpec] of Object.entries(spec)) {
      checkField(report, file, name, `${groupName}[${i}].${field}`, fieldSpec, entry[field]);
    }
    for (const key of Object.keys(entry)) {
      if (!(key in spec)) {
        report.err(file, `${groupName}[${i}] has unknown key "${key}"`);
      }
    }
  });
}

// --- cross-field sanity checks (schema.md §4, §5, §7, §9) -------------------

function crossChecks(report, file, name, r) {
  const size = isPlainObject(r.size) ? r.size : {};
  const terrain = isPlainObject(r.terrain) ? r.terrain : {};
  const pricing = isPlainObject(r.pricing) ? r.pricing : {};

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // Vertical drop must reconcile with the two elevations.
  const summit = num(size.summitElevation);
  const base = num(size.baseElevation);
  const drop = num(size.verticalDrop);
  if (summit !== null && base !== null && drop !== null) {
    const implied = summit - base;
    if (Math.abs(implied - drop) > 50) {
      report.err(
        file,
        `size: summitElevation - baseElevation = ${implied} ft but verticalDrop is ${drop} ft ` +
        `(off by ${Math.abs(implied - drop)}). One of the three is wrong or came from a different source.`
      );
    }
  }
  if (drop !== null && drop < VERTICAL_WARN_BELOW) {
    report.warn(file, `size.verticalDrop is ${drop} ft, below this site's ~650 ft cutoff — is this resort in scope?`);
  }

  // Terrain percentages: all four, or exactly the first three with expert null.
  const pct = {
    percentBeginner: num(terrain.percentBeginner),
    percentIntermediate: num(terrain.percentIntermediate),
    percentAdvanced: num(terrain.percentAdvanced),
    percentExpert: num(terrain.percentExpert),
  };
  const present = Object.entries(pct).filter(([, v]) => v !== null).map(([k]) => k);
  if (present.length === 4 || (present.length === 3 && pct.percentExpert === null)) {
    const sum = present.reduce((a, k) => a + pct[k], 0);
    if (Math.abs(sum - 100) > 2) {
      report.err(file, `terrain: difficulty percentages sum to ${sum}, not 100 (±2 allowed for rounding)`);
    }
  } else if (present.length > 0) {
    report.err(
      file,
      `terrain: partial difficulty breakdown (${present.join(', ')}). Provide all four, or the ` +
      `three-tier set with percentExpert null — a half-filled breakdown renders as a misleading bar.`
    );
  }
  if (present.length === 3 && pct.percentExpert === null && !terrain.difficultyNotes) {
    report.warn(file, 'terrain: three-tier breakdown with no difficultyNotes explaining the scheme');
  }

  // Pricing ordering and staleness.
  const low = num(pricing.windowTicketAdultLow);
  const high = num(pricing.windowTicketAdultHigh);
  const adv = num(pricing.advanceTypical);
  if (low !== null && high !== null && low > high) {
    report.err(file, `pricing: windowTicketAdultLow (${low}) is above windowTicketAdultHigh (${high}) — swapped?`);
  }
  if (adv !== null && low !== null && high !== null && (adv < low || adv > high)) {
    report.warn(file, `pricing: advanceTypical (${adv}) falls outside the window range ${low}–${high}`);
  }
  if (pricing.currency !== undefined && pricing.currency !== null && pricing.currency !== 'USD') {
    report.warn(file, `pricing.currency is "${pricing.currency}" — this project assumes USD`);
  }
  if (isValidDate(pricing.verifiedOn)) {
    const age = daysBetween(pricing.verifiedOn, today);
    if (age > PRICE_STALE_DAYS) {
      report.warn(file, `pricing was verified ${age} days ago (${pricing.verifiedOn}) — prices this old should be re-checked or nulled`);
    }
  }

  // meta.verifiedOn must cover the whole record.
  const groupDates = [size.verifiedOn, terrain.verifiedOn, pricing.verifiedOn]
    .concat(Array.isArray(r.passes) ? r.passes.map((p) => p && p.verifiedOn) : [])
    .filter(isValidDate);
  if (isValidDate(r.meta?.verifiedOn) && groupDates.length) {
    const newest = groupDates.sort().at(-1);
    if (r.meta.verifiedOn < newest) {
      report.err(file, `meta.verifiedOn (${r.meta.verifiedOn}) is older than the newest group verifiedOn (${newest})`);
    }
  }

  // Reviews: rating and ratingScale are both-or-neither.
  if (Array.isArray(r.reviews)) {
    r.reviews.forEach((rev, i) => {
      if (!isPlainObject(rev)) return;
      const hasRating = num(rev.rating) !== null;
      const hasScale = num(rev.ratingScale) !== null;
      if (hasRating !== hasScale) {
        report.err(file, `reviews[${i}]: rating and ratingScale must both be present or both be null`);
      } else if (hasRating && rev.rating > rev.ratingScale) {
        report.err(file, `reviews[${i}]: rating ${rev.rating} exceeds ratingScale ${rev.ratingScale}`);
      }
    });
  }

  // Passes: one entry minimum; `none` is exclusive.
  if (Array.isArray(r.passes)) {
    if (r.passes.length === 0) {
      report.err(file, 'passes is empty — a resort on no multi-mountain pass gets one entry with type "none" (schema.md §6)');
    }
    // "none" contradicts the mega-passes but coexists happily with a reciprocal
    // deal of type "other" — see schema.md §6.
    const types = r.passes.filter(isPlainObject).map((p) => p.type);
    const megaPasses = types.filter((t) => ['epic', 'ikon', 'indy'].includes(t));
    if (types.includes('none') && megaPasses.length) {
      report.err(
        file,
        `passes: type "none" means the resort is on no mega-pass, but this record also lists ${[...new Set(megaPasses)].join(', ')}`
      );
    }
    if (types.filter((t) => t === 'none').length > 1) {
      report.err(file, 'passes: more than one entry of type "none"');
    }
  }

  // Editorial voice checks — warnings, because length is guidance not law.
  const ed = isPlainObject(r.editorial) ? r.editorial : {};
  for (const [field, [min, max]] of Object.entries(PROSE_WORDS)) {
    const v = ed[field];
    if (typeof v !== 'string') continue;
    const w = words(v);
    if (w < min) report.warn(file, `editorial.${field} is ${w} words, under the ${min}-word guideline`);
    else if (w > max) report.warn(file, `editorial.${field} is ${w} words, over the ${max}-word guideline`);
  }
  for (const field of ['bestFor', 'watchOutFor']) {
    const v = ed[field];
    if (!Array.isArray(v)) continue;
    if (v.length === 0) {
      report.warn(file, `editorial.${field} is empty — this resort has not been thought about hard enough`);
    }
    v.forEach((chip, i) => {
      if (typeof chip === 'string' && chip.length > CHIP_MAX) {
        report.warn(file, `editorial.${field}[${i}] is ${chip.length} chars; chips render best under ${CHIP_MAX}`);
      }
    });
  }
  if (Array.isArray(ed.keyTrails) && ed.keyTrails.length === 0) {
    report.warn(file, 'editorial.keyTrails is empty — name 3-8 trails that matter');
  }

  // Snow report fallback: without an adapter this link is the whole UI.
  if (isPlainObject(r.links) && r.links.officialSnowReport === null) {
    report.warn(file, 'links.officialSnowReport is null — the conditions UI has nothing to fall back to');
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const report = new Report();

  if (!existsSync(RESORTS_DIR)) {
    console.error(`validate: ${path.relative(ROOT, RESORTS_DIR)} does not exist`);
    process.exit(1);
  }

  const files = (await readdir(RESORTS_DIR)).filter((f) => f.endsWith('.json')).sort();
  const seenSlugs = new Map();

  for (const file of files) {
    const raw = await readFile(path.join(RESORTS_DIR, file), 'utf8');

    let r;
    try {
      r = JSON.parse(raw);
    } catch (e) {
      report.err(file, `is not valid JSON: ${e.message}`);
      continue;
    }
    if (!isPlainObject(r)) {
      report.err(file, 'top level must be an object');
      continue;
    }

    // The private/ boundary is checked against the raw text, so it cannot be
    // smuggled in through a field the spec does not know about.
    if (raw.includes('private/')) {
      report.err(file, 'contains the string "private/" — resort data may never reference personal-use files');
    }
    if (/\bfile:\/\//.test(raw)) {
      report.err(file, 'contains a file:// URL — all links must be public https URLs');
    }

    if (r.schemaVersion !== SCHEMA_VERSION) {
      report.err(file, `schemaVersion must be ${SCHEMA_VERSION}, got ${JSON.stringify(r.schemaVersion)}`);
    }

    const name = isPlainObject(r.identity) && typeof r.identity.name === 'string'
      ? r.identity.name
      : file.replace(/\.json$/, '');

    for (const [groupName, spec] of Object.entries(SPEC)) {
      checkGroup(report, file, name, groupName, spec, r[groupName]);
    }
    checkArrayGroup(report, file, name, 'passes', PASS_SPEC, r.passes);
    checkArrayGroup(report, file, name, 'reviews', REVIEW_SPEC, r.reviews);

    const known = [...Object.keys(SPEC), 'passes', 'reviews', 'schemaVersion'];
    for (const key of Object.keys(r)) {
      if (!known.includes(key)) report.err(file, `unknown top-level key "${key}"`);
    }

    // slug <-> filename <-> uniqueness
    const slug = isPlainObject(r.identity) ? r.identity.slug : undefined;
    if (typeof slug === 'string') {
      if (!SLUG_RE.test(slug)) {
        report.err(file, `identity.slug "${slug}" must be lowercase-hyphenated ASCII`);
      }
      const expected = `${slug}.json`;
      if (expected !== file) {
        report.err(file, `identity.slug is "${slug}", so the file must be named ${expected}`);
      }
      if (seenSlugs.has(slug)) {
        report.err(file, `duplicate slug "${slug}", also used by ${seenSlugs.get(slug)}`);
      } else {
        seenSlugs.set(slug, file);
      }
    }

    crossChecks(report, file, name, r);
  }

  await writeUnverified(report, files.length);
  printSummary(report, files.length);
  process.exit(report.errors.length ? 1 : 0);
}

async function writeUnverified(report, fileCount) {
  const lines = [
    '# Unverified fields',
    '',
    '**Generated by `node tools/validate.mjs` — do not edit by hand.**',
    '',
    `Last run: ${new Date().toISOString()} · ${fileCount} resort file(s) checked.`,
    '',
    'Every row is a field that is currently `null` because it could not be sourced.',
    'Fill it from a citable source and re-run the validator, or leave it — a null is an',
    'honest answer. Never guess a number to clear a row (`CLAUDE.md`, data rule 2).',
    '',
  ];

  if (report.unverified.length === 0) {
    lines.push(fileCount === 0 ? '_No resort files yet._' : '_No unverified fields. Every tracked field is sourced._', '');
  } else {
    const byResort = new Map();
    for (const g of report.unverified) {
      if (!byResort.has(g.file)) byResort.set(g.file, { name: g.name, fields: [] });
      byResort.get(g.file).fields.push(g.field);
    }
    lines.push(`${report.unverified.length} unverified field(s) across ${byResort.size} resort(s).`, '');
    lines.push('| Resort | File | Field |', '|---|---|---|');
    for (const [file, { name, fields }] of [...byResort].sort()) {
      for (const field of fields) {
        lines.push(`| ${name} | \`${file}\` | \`${field}\` |`);
      }
    }
    lines.push('');
  }

  if (report.warnings.length) {
    lines.push('## Warnings', '');
    for (const w of report.warnings) lines.push(`- \`${w.file}\` — ${w.msg}`);
    lines.push('');
  }

  if (report.errors.length) {
    lines.push('## Errors (validation is currently failing)', '');
    for (const e of report.errors) lines.push(`- \`${e.file}\` — ${e.msg}`);
    lines.push('');
  }

  await writeFile(UNVERIFIED_PATH, lines.join('\n'), 'utf8');
}

function printSummary(report, fileCount) {
  for (const e of report.errors) console.error(`ERROR  ${e.file}: ${e.msg}`);
  for (const w of report.warnings) console.warn(`WARN   ${w.file}: ${w.msg}`);

  console.log(
    `\nvalidate: ${fileCount} resort file(s) · ` +
    `${report.errors.length} error(s) · ${report.warnings.length} warning(s) · ` +
    `${report.unverified.length} unverified field(s)`
  );
  console.log(`wrote ${path.relative(ROOT, UNVERIFIED_PATH).replace(/\\/g, '/')}`);
}

main().catch((e) => {
  console.error('validate: unexpected failure\n', e);
  process.exit(1);
});
