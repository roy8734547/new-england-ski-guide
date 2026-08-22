#!/usr/bin/env node
/**
 * fetch-trailmaps.mjs - downloads each resort's official trail map into
 * private/trail-maps/<slug>.pdf for personal offline use.
 *
 * THE BOUNDARY, and it is the whole point of this file living apart from the site:
 *
 *   - This script writes ONLY inside private/. It must never write to data/ or
 *     assets/, and no resort JSON field may ever point at a path it produced.
 *   - private/ is gitignored, so nothing here is committed or deployed.
 *   - The public site links out to links.trailMap - the resort's own URL. It never
 *     hosts, mirrors or embeds a map.
 *
 * Source URLs come from links.trailMap in each resort file. A manifest at
 * private/trail-maps/manifest.json records the source URL and download date, so a
 * map from an old season is identifiable.
 *
 * Placeholder: implementation lands in the "trail maps" phase.
 *
 * Usage: node tools/fetch-trailmaps.mjs [--slug <slug>] [--force]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_AGENT, warnIfPlaceholderContact } from './bot-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'private', 'trail-maps');

/** Guard rail: refuse to write anywhere except private/. */
export function assertPrivate(targetPath) {
  const resolved = path.resolve(targetPath);
  const privateRoot = path.join(ROOT, 'private');
  if (resolved !== privateRoot && !resolved.startsWith(privateRoot + path.sep)) {
    throw new Error(`fetch-trailmaps refuses to write outside private/: ${resolved}`);
  }
  return resolved;
}

async function main() {
  warnIfPlaceholderContact();
  assertPrivate(OUT_DIR);
  console.log(`fetch-trailmaps: placeholder. Would download into ${path.relative(ROOT, OUT_DIR)}`);
  console.log(`fetch-trailmaps: user agent ${USER_AGENT}`);
  // TODO: read data/resorts/*.json, download links.trailMap, write the manifest.
}

main().catch((e) => {
  console.error('fetch-trailmaps: unexpected failure\n', e);
  process.exit(1);
});
