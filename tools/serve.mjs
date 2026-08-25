#!/usr/bin/env node
/**
 * serve.mjs - a static file server for local development, in the standard
 * library, with no dependencies.
 *
 * Why this exists: browsers refuse both `<script type="module">` and `fetch()` of
 * a local file under the file:// protocol, so a data-driven page cannot run by
 * double-clicking index.html. That is a browser rule, not a project choice. The
 * deployed site is unaffected - it is still nothing but static files.
 *
 * Usage: node tools/serve.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  const filePath = path.join(ROOT, rel);

  // Never serve outside the repo, and never serve the personal-use directory -
  // the deployed site has no equivalent of it, so local dev must not either.
  const relToRoot = path.relative(ROOT, filePath);
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (relToRoot.split(path.sep)[0] === 'private') {
    res.writeHead(404).end('Not found');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    // Static hosts serve 404.html for anything they cannot match, and that page
    // reads the failed URL to guess at a resort. Serving plain text here would
    // mean the one page whose whole job is to handle a bad URL could never be
    // exercised locally.
    try {
      const page = await readFile(path.join(ROOT, '404.html'));
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      res.end(page);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${rel}`);
    }
  }
});

server.listen(PORT, () => {
  console.log(`serve: http://localhost:${PORT}/  (root: ${ROOT})`);
});
