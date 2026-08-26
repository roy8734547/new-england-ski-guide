#!/usr/bin/env node
/**
 * check-emphasis-drift.mjs — proves the emphasis pass changed no prose.
 *
 * Marking up 45 files by hand is exactly the situation where prose quietly gets
 * "improved" on the way past: a clause tightened here, a word swapped there, and
 * at the end there are 45 files of drift that nobody can separate from the
 * markup. This is the check that makes the pass reviewable.
 *
 * For every emphasis-carrying field it strips `**` and `==` from the working
 * copy and compares the result byte for byte against the same field at a
 * baseline commit. Any difference means prose changed, not just markup.
 *
 *   node tools/check-emphasis-drift.mjs                 # against the default tag
 *   node tools/check-emphasis-drift.mjs --base <ref>    # against any commit
 *   node tools/check-emphasis-drift.mjs --slug stowe    # one resort
 *
 * Exits non-zero on any difference, so it can gate a commit.
 */

import { readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripEmphasis, EMPHASIS_FIELDS } from '../assets/js/emphasis.js';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESORTS = path.join(ROOT, 'data', 'resorts');

/**
 * The commit the prose is being compared against — the last state before any
 * markup existed. A tag rather than a hash so the command reads as what it means
 * and keeps working after a rebase.
 */
const DEFAULT_BASE = 'emphasis-baseline';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

/** Resolves a dotted path, expanding `[]` into every element of an array. */
function collect(record, dotted) {
  const parts = dotted.split('.');
  let nodes = [record];
  for (const part of parts) {
    const isArray = part.endsWith('[]');
    const key = isArray ? part.slice(0, -2) : part;
    const next = [];
    for (const node of nodes) {
      if (node === null || node === undefined) continue;
      const value = node[key];
      if (value === null || value === undefined) continue;
      if (isArray) {
        if (Array.isArray(value)) next.push(...value);
      } else {
        next.push(value);
      }
    }
    nodes = next;
  }
  return nodes.filter((v) => typeof v === 'string');
}

async function baselineFile(base, slug) {
  try {
    const { stdout } = await run('git', ['show', `${base}:data/resorts/${slug}.json`], {
      cwd: ROOT,
      maxBuffer: 8 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e) {
    return null;
  }
}

/** The first difference between two strings, with a little context each side. */
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const from = Math.max(0, i - 40);
  return {
    at: i,
    was: JSON.stringify(b.slice(from, i + 40)),
    now: JSON.stringify(a.slice(from, i + 40)),
  };
}

async function main() {
  const base = arg('--base') ?? DEFAULT_BASE;
  const only = arg('--slug');

  try {
    await run('git', ['rev-parse', '--verify', base], { cwd: ROOT });
  } catch {
    console.error(
      `check-emphasis-drift: "${base}" is not a commit this repository knows.\n`
      + 'Tag the last pre-markup commit as `emphasis-baseline`, or pass --base <ref>.'
    );
    process.exit(2);
  }

  const files = (await readdir(RESORTS))
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !only || f === `${only}.json`);

  let checked = 0;
  let marked = 0;
  const problems = [];
  const missing = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const current = JSON.parse(await readFile(path.join(RESORTS, file), 'utf8'));
    const before = await baselineFile(base, slug);
    if (!before) {
      missing.push(slug);
      continue;
    }

    for (const dotted of EMPHASIS_FIELDS) {
      const now = collect(current, dotted);
      const was = collect(before, dotted);

      if (now.length !== was.length) {
        problems.push(`${slug} · ${dotted}: ${was.length} value(s) at baseline, `
          + `${now.length} now — an entry was added or removed`);
        continue;
      }

      now.forEach((value, i) => {
        checked += 1;
        const stripped = stripEmphasis(value);
        if (stripped !== value) marked += 1;
        if (stripped === was[i]) return;
        const d = firstDiff(stripped, was[i]);
        problems.push(
          `${slug} · ${dotted}${now.length > 1 ? `[${i}]` : ''}: prose changed at character ${d.at}\n`
          + `      was: ${d.was}\n`
          + `      now: ${d.now}`
        );
      });
    }
  }

  console.log(`check-emphasis-drift: ${files.length} file(s) against ${base}`);
  console.log(`  ${checked} emphasis-capable field(s) compared, ${marked} carrying markup`);
  if (missing.length) {
    console.log(`  ${missing.length} file(s) did not exist at the baseline (new since): `
      + missing.join(', '));
  }

  if (problems.length) {
    console.error(`\n${problems.length} field(s) differ once markup is stripped:\n`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nThis pass adds markup only. Revert the prose and re-mark it.');
    process.exit(1);
  }

  console.log('  no drift — every field is byte-identical once markup is stripped');
}

main().catch((e) => {
  console.error('check-emphasis-drift: unexpected failure\n', e);
  process.exit(2);
});
