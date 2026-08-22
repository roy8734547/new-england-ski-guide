#!/usr/bin/env node
/**
 * report-broken-adapters.mjs - reads data/snow-reports.json and reports any
 * adapter that has returned `status: 'error'` on ERROR_STREAK_THRESHOLD or more
 * consecutive runs.
 *
 * Writes GitHub Actions output lines to stdout:
 *
 *   broken=killington,stowe          (empty when nothing is broken)
 *   detail=<multi-line markdown>
 *
 * Run it by hand to see the same thing in a readable form:
 *
 *   node tools/report-broken-adapters.mjs --human
 *
 * The streak itself is maintained by fetch-snow.mjs and lives in the committed
 * report file, so it survives a fresh CI checkout with no extra state.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_STREAK_THRESHOLD } from './fetch-snow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS_PATH = path.join(ROOT, 'data', 'snow-reports.json');

/** Escapes a value for a multi-line GitHub Actions output. */
function ghOutput(name, value) {
  if (!value.includes('\n')) return `${name}=${value}`;
  const delim = `EOF_${Math.random().toString(36).slice(2, 10)}`;
  return `${name}<<${delim}\n${value}\n${delim}`;
}

async function main() {
  const human = process.argv.includes('--human');

  let data;
  try {
    data = JSON.parse(await readFile(REPORTS_PATH, 'utf8'));
  } catch (e) {
    // No report file is not a broken adapter - it is a project that has not run
    // the fetcher yet. Say nothing and exit clean.
    if (human) console.log(`No snow-reports.json to check (${e.code ?? e.message}).`);
    else console.log(ghOutput('broken', ''));
    return;
  }

  const broken = Object.values(data.reports ?? {})
    .filter((r) => r?.status === 'error' && (r.consecutiveErrors ?? 0) >= ERROR_STREAK_THRESHOLD)
    .sort((a, b) => (b.consecutiveErrors ?? 0) - (a.consecutiveErrors ?? 0));

  if (human) {
    if (!broken.length) {
      console.log(`No adapter has failed ${ERROR_STREAK_THRESHOLD} runs in a row.`);
      return;
    }
    for (const r of broken) {
      console.log(`${r.slug}  tier=${r.tier}  ${r.consecutiveErrors} consecutive errors`);
      console.log(`    ${r.reason ?? 'no reason recorded'}`);
      console.log(`    ${r.sourceUrl ?? ''}`);
    }
    return;
  }

  console.log(ghOutput('broken', broken.map((r) => r.slug).join(',')));

  if (broken.length) {
    const detail = [
      '| Adapter | Tier | Consecutive failures | Last error |',
      '|---|---|---|---|',
      ...broken.map((r) => `| \`${r.slug}\` | ${r.tier ?? '—'} | ${r.consecutiveErrors} | ${String(r.reason ?? '—').replace(/\|/g, '\\|')} |`),
    ].join('\n');
    console.log(ghOutput('detail', detail));
  }
}

main().catch((e) => {
  console.error('report-broken-adapters:', e.message);
  process.exit(1);
});
