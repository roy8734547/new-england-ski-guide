#!/usr/bin/env node
/**
 * build-icons.mjs — the whole favicon set, plus the Open Graph card, from one
 * source of truth.
 *
 * That source is `assets/favicon.svg`. This script does not redraw the mountain;
 * it lifts the two path definitions straight out of that file and reframes them.
 * Edit the SVG, re-run this, and every raster follows. If somebody ever hand-
 * edits one of the generated PNGs instead, the next run silently reverts it,
 * which is the correct outcome.
 *
 *   node tools/build-icons.mjs          # write everything
 *   node tools/build-icons.mjs --check  # fail if any output is missing or stale
 *
 * Three variants of the same artwork exist, and the differences are platform
 * requirements rather than design choices:
 *
 *   rounded  The mark as drawn, rx and all. Browser tabs and the manifest's
 *            "any" icons, where the platform draws no frame of its own.
 *   square   Same artwork, no rounded corners, fully opaque. iOS applies its own
 *            superellipse mask to a home-screen icon, so supplying rounded
 *            corners gets them rounded twice and leaves dark notches at the
 *            edges. Apple's guidance is a plain opaque square; this is that.
 *   maskable Square, opaque, and with the glyph shrunk into the middle 60% so it
 *            survives Android's mask, whatever shape that mask turns out to be.
 *
 * ICO is written here rather than by a library because the format is a six-byte
 * header, a sixteen-byte directory entry per image, and then the images. The
 * payloads are PNGs, which every browser released this century accepts inside an
 * ICO, and which keeps the file a tenth the size of the BMP encoding.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'assets', 'favicon.svg');

const BRAND = '#0e5b9e';
const SITE_NAME = 'New England Ski Guide';
const TAGLINE = 'Every mountain worth the drive';
const OG_SUB = '45 ski areas · real numbers, sourced and dated · honest opinions';

/**
 * Pulls the artwork out of assets/favicon.svg. Deliberately strict: if the SVG
 * is restructured into something this cannot read, the build stops rather than
 * quietly emitting a blank blue square.
 */
async function readArtwork() {
  const svg = await readFile(SOURCE, 'utf8');
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const paths = [...svg.matchAll(/<path\s+d="([^"]+)"\s+fill="([^"]+)"\s*\/>/g)]
    .map(([, d, fill]) => ({ d, fill }));
  const frame = svg.match(/<rect[^>]*fill="(#[0-9a-fA-F]{6})"/);

  if (!viewBox || paths.length < 2 || !frame) {
    throw new Error(
      `build-icons: cannot read the artwork out of ${path.relative(ROOT, SOURCE)}.\n`
      + 'It needs a "viewBox=\\"0 0 N N\\"", a <rect> with a fill, and at least two\n'
      + '<path d="..." fill="..."/> elements. Restructure the SVG and this parser\n'
      + 'together, or the icons will silently stop matching the mark.'
    );
  }

  return {
    box: Number(viewBox[1]),
    frameFill: frame[1],
    paths,
  };
}

const shapes = (art, scale = 1, offset = 0) => art.paths
  .map((p) => `<path d="${p.d}" fill="${p.fill}"`
    + (scale === 1 && offset === 0
      ? ''
      : ` transform="translate(${offset} ${offset}) scale(${scale})"`)
    + '/>')
  .join('\n  ');

function roundedSvg(art) {
  const r = art.box * (6 / 32); // the source's rx, expressed as a ratio of its box
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.box} ${art.box}">
  <rect width="${art.box}" height="${art.box}" rx="${r}" fill="${art.frameFill}"/>
  ${shapes(art)}
</svg>`;
}

function squareSvg(art) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.box} ${art.box}">
  <rect width="${art.box}" height="${art.box}" fill="${art.frameFill}"/>
  ${shapes(art)}
</svg>`;
}

function maskableSvg(art) {
  const inset = 0.6;
  const offset = (art.box * (1 - inset)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${art.box} ${art.box}">
  <rect width="${art.box}" height="${art.box}" fill="${art.frameFill}"/>
  ${shapes(art, inset, offset)}
</svg>`;
}

/**
 * The Open Graph card. 1200x630 is the size every platform crops from, and the
 * safe area is roughly the middle 80% — Twitter and Slack both trim the edges,
 * so nothing that matters goes near them.
 *
 * No photography, by the same decision that keeps photographs off the rest of
 * the site. The font stack is resolved by whatever renders this SVG, so the
 * committed PNG is the artefact and this is only the recipe for it; regenerating
 * on a machine with different fonts will produce a slightly different card.
 */
function ogSvg(art) {
  const glyph = 200;
  const s = glyph / art.box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d1620"/>
      <stop offset="100%" stop-color="#132738"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <rect x="0" y="0" width="1200" height="10" fill="${BRAND}"/>

  <g transform="translate(96 150) scale(${s})">
    <rect width="${art.box}" height="${art.box}" rx="${art.box * (6 / 32)}" fill="${art.frameFill}"/>
    ${shapes(art)}
  </g>

  <text x="96" y="420" fill="#ffffff"
        font-family="Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="76" font-weight="700" letter-spacing="-2">${SITE_NAME}</text>
  <text x="96" y="486" fill="#9fc4e4"
        font-family="Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="40" font-weight="500">${TAGLINE}</text>
  <text x="96" y="546" fill="#6b8299"
        font-family="Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="25" font-weight="400">${OG_SUB}</text>
</svg>`;
}

// --- ICO ---------------------------------------------------------------------

/** ICONDIR + one ICONDIRENTRY per image + the PNG payloads, in that order. */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette size; 0 for truecolour
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// --- build -------------------------------------------------------------------

const png = (svg, size) => sharp(Buffer.from(svg))
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

async function build() {
  const art = await readArtwork();
  const rounded = roundedSvg(art);
  const square = squareSvg(art);
  const maskable = maskableSvg(art);

  const ico16 = await png(rounded, 16);
  const ico32 = await png(rounded, 32);

  const files = {
    'favicon.ico': packIco([{ size: 16, data: ico16 }, { size: 32, data: ico32 }]),
    // Flattened onto the brand colour: iOS renders a home-screen icon over an
    // unknown background and a transparent PNG comes out looking broken.
    'apple-touch-icon.png': await sharp(Buffer.from(square))
      .resize(180, 180)
      .flatten({ background: BRAND })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    'assets/icon-192.png': await png(rounded, 192),
    'assets/icon-512.png': await png(rounded, 512),
    'assets/icon-maskable-512.png': await sharp(Buffer.from(maskable))
      .resize(512, 512)
      .flatten({ background: BRAND })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    'assets/og-card.png': await sharp(Buffer.from(ogSvg(art)))
      .resize(1200, 630)
      .flatten({ background: '#0d1620' })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  };

  return files;
}

async function main() {
  const files = await build();
  const check = process.argv.includes('--check');
  let stale = 0;

  for (const [name, data] of Object.entries(files)) {
    const target = path.join(ROOT, name);
    if (check) {
      const current = existsSync(target) ? await readFile(target) : null;
      if (current === null || !current.equals(data)) {
        console.error(`build-icons: ${name} is ${current === null ? 'missing' : 'out of date'}`);
        stale += 1;
      }
      continue;
    }
    await writeFile(target, data);
    console.log(`build-icons: wrote ${name.padEnd(30)} ${String(data.length).padStart(7)} bytes`);
  }

  if (check) {
    if (stale) {
      console.error('\nbuild-icons: run `npm run build:icons` and commit the result.');
      process.exit(1);
    }
    console.log('build-icons: every generated icon matches assets/favicon.svg');
  }
}

main().catch((e) => {
  console.error(`build-icons: ${e.message}`);
  process.exit(1);
});
