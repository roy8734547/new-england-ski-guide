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

const SCHEMA_VERSION = 3;

const STATES = ['VT', 'NH', 'ME', 'MA', 'CT', 'RI'];

const REGIONS = [
  'Southern Vermont', 'Central Vermont', 'Northern Vermont', 'Northeast Kingdom',
  'White Mountains', 'Mount Washington Valley', 'Lakes Region', 'Southern New Hampshire',
  'Dartmouth-Sunapee', 'Western Maine', 'Central Maine', 'Midcoast Maine',
  'Northern Maine', 'Berkshires', 'Central Massachusetts', 'Northwest Connecticut',
];

const PASS_TYPES = ['epic', 'ikon', 'indy', 'other', 'none'];

const MOGUL_PRESENCE = ['signature', 'common', 'occasional', 'rare', 'none'];
const TRAIL_DIFFICULTY = ['green', 'blue', 'black', 'double-black', 'triple-black'];
const BUMP_RELIABILITY = ['reliable', 'late-season', 'variable'];
const PARK_SIZES = ['progression', 'small', 'medium', 'large'];
const PIPE_TYPES = ['halfpipe', 'superpipe'];

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
  // Promoted out of `terrain` in v3: a boolean could not say which trail bumps
  // up, and a park count could not say whether the parks were any good.
  moguls: {
    presence: { type: 'string', enum: MOGUL_PRESENCE },
    policy: { type: 'string', n: true },
    namedRuns: { type: 'namedRun[]' },
    quality: { type: 'string', n: true },
    bestTiming: { type: 'string', n: true },
    bumpCulture: { type: 'string', n: true },
    source: { type: 'url' },
    verifiedOn: { type: 'date' },
    fieldSources: { type: 'fieldSources' },
  },
  parks: {
    count: { type: 'integer', n: true, min: 0, max: 30 },
    parks: { type: 'park[]' },
    pipe: { type: 'boolean', n: true },
    pipeType: { type: 'string', n: true, enum: PIPE_TYPES },
    pipeSpecs: { type: 'string', n: true },
    nightPark: { type: 'boolean', n: true },
    progression: { type: 'string', n: true },
    rebuildCadence: { type: 'string', n: true },
    overview: { type: 'string', n: true },
    reputation: { type: 'string', n: true },
    source: { type: 'url' },
    verifiedOn: { type: 'date' },
    fieldSources: { type: 'fieldSources' },
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

const FIELD_NOTE_STATUSES = ['absent', 'unpublished', 'seasonal'];

/** Which array groups a dotted path may index into. */
const ARRAY_GROUPS = { passes: PASS_SPEC, reviews: REVIEW_SPEC };

/**
 * Validates a dotted field path and returns how to read it, or null when the
 * path names nothing real. Accepted forms:
 *   size.nightSkiing        an object group field
 *   passes[0].blackouts     an array entry field
 *   reviews                 a whole array group (for the "no reviews" case)
 */
function parseFieldPath(path) {
  if (typeof path !== 'string' || !path) return null;

  if (path in ARRAY_GROUPS) return { kind: 'group', group: path };

  const arrayMatch = path.match(/^([a-zA-Z]+)\[(\d+)\]\.([a-zA-Z]+)$/);
  if (arrayMatch) {
    const [, group, index, field] = arrayMatch;
    const spec = ARRAY_GROUPS[group];
    if (!spec || !(field in spec)) return null;
    return { kind: 'arrayField', group, index: Number(index), field };
  }

  const dotMatch = path.match(/^([a-zA-Z]+)\.([a-zA-Z]+)$/);
  if (dotMatch) {
    const [, group, field] = dotMatch;
    if (!SPEC[group] || !(field in SPEC[group])) return null;
    return { kind: 'field', group, field };
  }
  return null;
}

/** Reads the value a parsed path points at. Returns undefined when absent. */
function readFieldPath(record, parsed) {
  if (!parsed) return undefined;
  if (parsed.kind === 'group') return record[parsed.group];
  if (parsed.kind === 'field') return record[parsed.group]?.[parsed.field];
  return record[parsed.group]?.[parsed.index]?.[parsed.field];
}

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
    this.unverified = [];   // null, and nobody has looked yet
    this.resolved = [];     // null or false, explained by a fieldNote
  }
  err(file, msg) { this.errors.push({ file, msg }); }
  warn(file, msg) { this.warnings.push({ file, msg }); }
  gap(file, name, field) { this.unverified.push({ file, name, field }); }
  note(file, name, field, entry) { this.resolved.push({ file, name, field, entry }); }
}

/**
 * Type/enum/range check for one field. Records the null into UNVERIFIED when the
 * spec allows null. Returns true when a real (non-null) value is present and valid.
 */
function checkField(report, file, name, pathStr, spec, value, fieldNotes = {}) {
  if (value === undefined) {
    report.err(file, `${pathStr} is missing — every key must be present (schema.md §1.4)`);
    return false;
  }
  if (value === null) {
    if (!spec.n) {
      report.err(file, `${pathStr} may not be null`);
      return false;
    }
    // A null that somebody has already investigated is a finished state, not a
    // research task. schema.md §12.
    if (fieldNotes[pathStr]) report.note(file, name, pathStr, fieldNotes[pathStr]);
    else report.gap(file, name, pathStr);
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
    case 'namedRun[]':
      if (!Array.isArray(value)) return fail('must be an array');
      value.forEach((entry, i) => {
        if (!isPlainObject(entry)) {
          report.err(file, `${pathStr}[${i}] must be an object {name, difficulty, reliability, note}`);
          return;
        }
        for (const k of ['name', 'note']) {
          if (typeof entry[k] !== 'string' || entry[k].trim() === '') {
            report.err(file, `${pathStr}[${i}].${k} must be a non-empty string`);
          }
        }
        if (!TRAIL_DIFFICULTY.includes(entry.difficulty)) {
          report.err(file, `${pathStr}[${i}].difficulty must be one of ${TRAIL_DIFFICULTY.join(', ')}`);
        }
        if (!BUMP_RELIABILITY.includes(entry.reliability)) {
          report.err(file, `${pathStr}[${i}].reliability must be one of ${BUMP_RELIABILITY.join(', ')}`);
        }
        for (const k of Object.keys(entry)) {
          if (!['name', 'difficulty', 'reliability', 'note'].includes(k)) {
            report.err(file, `${pathStr}[${i}] has unknown key "${k}"`);
          }
        }
      });
      break;
    case 'park[]': {
      if (!Array.isArray(value)) return fail('must be an array');
      const countFields = ['jibs', 'jumps', 'boxes', 'rails', 'largestJumpFt'];
      const allowed = ['name', 'size', 'level', 'note', ...countFields];
      value.forEach((entry, i) => {
        if (!isPlainObject(entry)) {
          report.err(file, `${pathStr}[${i}] must be an object`);
          return;
        }
        for (const k of ['name', 'level', 'note']) {
          if (typeof entry[k] !== 'string' || entry[k].trim() === '') {
            report.err(file, `${pathStr}[${i}].${k} must be a non-empty string`);
          }
        }
        if (!PARK_SIZES.includes(entry.size)) {
          report.err(file, `${pathStr}[${i}].size must be one of ${PARK_SIZES.join(', ')}`);
        }
        for (const k of countFields) {
          const v = entry[k];
          if (v === undefined) {
            report.err(file, `${pathStr}[${i}].${k} is missing - use null when unpublished`);
          } else if (v !== null && (!Number.isInteger(v) || v < 0)) {
            report.err(file, `${pathStr}[${i}].${k} must be a non-negative whole number or null`);
          }
        }
        for (const k of Object.keys(entry)) {
          if (!allowed.includes(k)) {
            report.err(file, `${pathStr}[${i}] has unknown key "${k}"`);
          }
        }
      });
      break;
    }
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
function checkGroup(report, file, name, groupName, spec, group, fieldNotes = {}) {
  if (!isPlainObject(group)) {
    report.err(file, `${groupName} must be an object`);
    return;
  }
  for (const [field, fieldSpec] of Object.entries(spec)) {
    checkField(report, file, name, `${groupName}.${field}`, fieldSpec, group[field], fieldNotes);
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

function checkArrayGroup(report, file, name, groupName, spec, arr, fieldNotes = {}) {
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
      checkField(report, file, name, `${groupName}[${i}].${field}`, fieldSpec, entry[field], fieldNotes);
    }
    for (const key of Object.keys(entry)) {
      if (!(key in spec)) {
        report.err(file, `${groupName}[${i}] has unknown key "${key}"`);
      }
    }
  });
}


// --- fieldNotes and dataDisputes (schema.md §12, §13) ----------------------

/**
 * Every note must name a real field, carry a legal status, and satisfy that
 * status's own requirements. The scalar check is the important one: "absent"
 * asserts a negative and so the field must actually hold false/0, while
 * "unpublished" and "seasonal" mean we still have no value and it must be null.
 */
function checkFieldNotes(report, file, name, record) {
  const notes = record.fieldNotes;
  if (notes === undefined) {
    report.err(file, 'fieldNotes is missing — use {} when there is nothing to note');
    return {};
  }
  if (!isPlainObject(notes)) {
    report.err(file, 'fieldNotes must be an object');
    return {};
  }

  for (const [pathStr, entry] of Object.entries(notes)) {
    const parsed = parseFieldPath(pathStr);
    if (!parsed) {
      report.err(file, `fieldNotes."${pathStr}" does not name a real field`);
      continue;
    }
    if (!isPlainObject(entry)) {
      report.err(file, `fieldNotes."${pathStr}" must be an object`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (!['status', 'source', 'verifiedOn', 'checkedOn', 'note'].includes(key)) {
        report.err(file, `fieldNotes."${pathStr}" has unknown key "${key}"`);
      }
    }

    const { status } = entry;
    if (!FIELD_NOTE_STATUSES.includes(status)) {
      report.err(file, `fieldNotes."${pathStr}".status must be one of ${FIELD_NOTE_STATUSES.join(', ')}`);
      continue;
    }

    const value = readFieldPath(record, parsed);

    if (status === 'absent') {
      const problem = urlProblem(entry.source);
      if (problem) {
        report.err(file, `fieldNotes."${pathStr}" is "absent" and so needs a source that ${problem.replace(/^must/, 'must')}`);
      }
      if (!isValidDate(entry.verifiedOn)) {
        report.err(file, `fieldNotes."${pathStr}" is "absent" and needs verifiedOn as an ISO date`);
      } else if (entry.verifiedOn > today) {
        report.err(file, `fieldNotes."${pathStr}".verifiedOn is in the future`);
      }
      // Asserting the negative means the data must say so.
      if (value === null || value === undefined) {
        report.err(
          file,
          `fieldNotes."${pathStr}" is "absent", so ${pathStr} must be false or 0 rather than null — ` +
          `that is the whole point of the status (schema.md §12)`
        );
      } else if (value !== false && value !== 0) {
        report.err(file, `fieldNotes."${pathStr}" is "absent" but ${pathStr} holds ${JSON.stringify(value)}`);
      }
    } else {
      if (!isValidDate(entry.checkedOn)) {
        report.err(file, `fieldNotes."${pathStr}" is "${status}" and needs checkedOn as an ISO date`);
      } else if (entry.checkedOn > today) {
        report.err(file, `fieldNotes."${pathStr}".checkedOn is in the future`);
      }
      if (entry.source !== undefined) {
        const problem = urlProblem(entry.source);
        if (problem) report.err(file, `fieldNotes."${pathStr}".source ${problem}`);
      }
      const empty = value === null || value === undefined ||
        (Array.isArray(value) && value.length === 0);
      if (!empty) {
        report.err(
          file,
          `fieldNotes."${pathStr}" is "${status}" but ${pathStr} has a value — ` +
          `remove the note or clear the field`
        );
      }
    }

    if (entry.note !== undefined && (typeof entry.note !== 'string' || !entry.note.trim())) {
      report.err(file, `fieldNotes."${pathStr}".note must be a non-empty string when present`);
    }

    // "absent" fields hold false/0, so checkField's null sweep never sees them.
    // Record them here or a confirmed finding would vanish from the report.
    if (status === 'absent') report.note(file, name, pathStr, entry);
  }
  return notes;
}

/** A dispute must name a real field and must not drift from the stored value. */
function checkDataDisputes(report, file, record) {
  const disputes = record.dataDisputes;
  if (disputes === undefined) {
    report.err(file, 'dataDisputes is missing — use [] when there are none');
    return;
  }
  if (!Array.isArray(disputes)) {
    report.err(file, 'dataDisputes must be an array');
    return;
  }

  disputes.forEach((d, i) => {
    const at = `dataDisputes[${i}]`;
    if (!isPlainObject(d)) {
      report.err(file, `${at} must be an object`);
      return;
    }
    for (const key of Object.keys(d)) {
      if (!['field', 'resortClaim', 'independentClaim', 'independentSource', 'note'].includes(key)) {
        report.err(file, `${at} has unknown key "${key}"`);
      }
    }
    const parsed = parseFieldPath(d.field);
    if (!parsed) {
      report.err(file, `${at}.field "${d.field}" does not name a real field`);
      return;
    }
    for (const key of ['resortClaim', 'independentClaim']) {
      if (!['number', 'string'].includes(typeof d[key])) {
        report.err(file, `${at}.${key} must be a number or a string`);
      }
    }
    const problem = urlProblem(d.independentSource);
    if (problem) {
      report.err(file, `${at}.independentSource ${problem} — a dispute without a counter-source is an opinion`);
    }
    if (typeof d.note !== 'string' || !d.note.trim()) {
      report.err(file, `${at}.note must explain why the resort's figure is doubted`);
    }
    // The dispute must describe the data as it actually stands.
    const stored = readFieldPath(record, parsed);
    if (stored !== undefined && stored !== d.resortClaim) {
      report.err(
        file,
        `${at}.resortClaim is ${JSON.stringify(d.resortClaim)} but ${d.field} holds ` +
        `${JSON.stringify(stored)} — the dispute has drifted out of step with the data`
      );
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

  // --- moguls and parks (schema.md 14, 15) ---------------------------------
  const moguls = isPlainObject(r.moguls) ? r.moguls : {};
  const parks = isPlainObject(r.parks) ? r.parks : {};

  // Claiming bumps are a defining feature without naming one is marketing.
  if (moguls.presence === 'signature' && (moguls.namedRuns ?? []).length === 0) {
    report.err(
      file,
      'moguls.presence is "signature" but namedRuns is empty - a mountain whose bumps are ' +
      'a defining feature must be able to name at least one of them'
    );
  }
  // "none" is a claim about policy, so it has to say what the policy is.
  if (moguls.presence === 'none' && !moguls.policy) {
    report.err(file, 'moguls.presence is "none" and needs a policy explaining why');
  }
  if (moguls.presence === 'none' && (moguls.namedRuns ?? []).length > 0) {
    report.err(file, 'moguls.presence is "none" but namedRuns lists trails');
  }
  if (['rare', 'occasional'].includes(moguls.presence) && !moguls.policy) {
    report.warn(file, `moguls.presence is "${moguls.presence}" with no policy explaining the grooming`);
  }

  const parkList = Array.isArray(parks.parks) ? parks.parks : [];
  if (Number.isInteger(parks.count)) {
    if (parkList.length === 0 && parks.count > 0) {
      // A sourced count with no per-park detail yet is incomplete, not wrong.
      report.warn(file, `parks.count is ${parks.count} but no individual parks are described`);
    } else if (parkList.length !== parks.count) {
      report.err(
        file,
        `parks.count is ${parks.count} but parks[] holds ${parkList.length} entries`
      );
    }
    if (parks.count === 0 && parkList.length > 0) {
      report.err(file, 'parks.count is 0 but parks[] is not empty');
    }
  } else if (parkList.length > 0) {
    report.err(file, `parks.count is null but parks[] describes ${parkList.length} park(s)`);
  }

  if (parks.pipe === true && !parks.pipeType) {
    report.warn(file, 'parks.pipe is true but pipeType is null - halfpipe or superpipe?');
  }
  if (parks.pipe !== true && (parks.pipeType || parks.pipeSpecs)) {
    report.err(file, 'parks has pipe details but parks.pipe is not true');
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

    const fieldNotes = checkFieldNotes(report, file, name, r);
    checkDataDisputes(report, file, r);

    for (const [groupName, spec] of Object.entries(SPEC)) {
      checkGroup(report, file, name, groupName, spec, r[groupName], fieldNotes);
    }
    checkArrayGroup(report, file, name, 'passes', PASS_SPEC, r.passes, fieldNotes);
    checkArrayGroup(report, file, name, 'reviews', REVIEW_SPEC, r.reviews, fieldNotes);

    // An empty reviews array is only acceptable once somebody has said why.
    if (Array.isArray(r.reviews) && r.reviews.length === 0) {
      if (fieldNotes.reviews) report.note(file, name, 'reviews', fieldNotes.reviews);
      else report.gap(file, name, 'reviews');
    }

    // SPEC now includes moguls and parks, so they are covered by Object.keys(SPEC).
    const known = [...Object.keys(SPEC), 'passes', 'reviews', 'schemaVersion',
      'fieldNotes', 'dataDisputes'];
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
    'Two tables, and the difference between them matters. The first is a worklist. The',
    'second is finished work: fields somebody has already chased down and confirmed cannot',
    'be sourced. Never guess a number to clear a row from either (`CLAUDE.md`, data rule 2).',
    '',
  ];

  const group = (rows) => {
    const byResort = new Map();
    for (const row of rows) {
      if (!byResort.has(row.file)) byResort.set(row.file, { name: row.name, rows: [] });
      byResort.get(row.file).rows.push(row);
    }
    return [...byResort].sort();
  };

  // --- table 1: genuine unknowns ---
  lines.push('## Unknown — still needs research', '');
  if (report.unverified.length === 0) {
    lines.push(fileCount === 0 ? '_No resort files yet._' : '_Nothing outstanding._', '');
  } else {
    lines.push(
      `${report.unverified.length} field(s) across ${group(report.unverified).length} resort(s) ` +
      'are empty and have not been investigated.',
      '',
      '| Resort | File | Field |', '|---|---|---|',
    );
    for (const [file, { name, rows }] of group(report.unverified)) {
      for (const row of rows) lines.push(`| ${name} | \`${file}\` | \`${row.field}\` |`);
    }
    lines.push('');
  }

  // --- table 2: closed out ---
  lines.push('## Confirmed unpublished — no further work possible', '');
  if (report.resolved.length === 0) {
    lines.push('_Nothing recorded._', '');
  } else {
    lines.push(
      `${report.resolved.length} field(s) carry a \`fieldNotes\` entry explaining the ` +
      'emptiness. `absent` means the resort genuinely does not have it; `unpublished` means ' +
      'nobody publishes it; `seasonal` means it cannot be known until the lifts turn.',
      '',
      '| Resort | Field | Status | Checked | Why |', '|---|---|---|---|---|',
    );
    for (const [, { name, rows }] of group(report.resolved)) {
      for (const { field, entry } of rows) {
        const when = entry.verifiedOn ?? entry.checkedOn ?? '—';
        const why = (entry.note ?? '').replace(/\|/g, '\|');
        lines.push(`| ${name} | \`${field}\` | ${entry.status} | ${when} | ${why} |`);
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

  await writeFile(UNVERIFIED_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary(report, fileCount) {
  for (const e of report.errors) console.error(`ERROR  ${e.file}: ${e.msg}`);
  for (const w of report.warnings) console.warn(`WARN   ${w.file}: ${w.msg}`);

  console.log(
    `\nvalidate: ${fileCount} resort file(s) · ` +
    `${report.errors.length} error(s) · ${report.warnings.length} warning(s) · ` +
    `${report.unverified.length} unknown · ${report.resolved.length} confirmed unpublished`
  );
  console.log(`wrote ${path.relative(ROOT, UNVERIFIED_PATH).replace(/\\/g, '/')}`);
}

main().catch((e) => {
  console.error('validate: unexpected failure\n', e);
  process.exit(1);
});
