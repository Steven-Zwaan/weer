// Generates every app icon from public/logo.svg (adapted from Iron). Run: npm run icons
//
//   public/icons/192.png, 512.png           PWA icons: the logo as drawn
//   public/icons/512-maskable.png            PWA maskable icon: the logo, shrunk only if the mark leaves the safe zone
//   public/icons/apple-touch-icon.png        180 x 180 for the iOS home screen
//   public/favicon.svg, public/favicon.ico   favicons: the mark alone on transparent, filling the square. The SVG
//                                            follows the browser theme; the ICO (no media queries) has the light-theme colour
//   design/app-icon-1024.png                 1024 x 1024 without alpha, for the native iOS app
//
// The logo is a square viewBox with a full-size <rect> background; everything else is the mark. Any
// path syntax works: variants move the mark with a transform, and its bounds are measured from a render.
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(root, 'public', 'icons'), { recursive: true });

const logo = readFileSync(join(root, 'public', 'logo.svg'), 'utf8');
const [, w, h] = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(logo) ?? [];
const size = Number(w);
const body = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(logo)?.[1] ?? '';
const rect = /<rect\b[^>]*\/>/.exec(body)?.[0];
const mark = body
  .replace(/<title>[\s\S]*?<\/title>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(rect ?? '', '')
  .trim();
if (!size || w !== h || !rect || !mark) throw new Error('public/logo.svg needs a square viewBox "0 0 N N", a full-size <rect> background and the mark.');
// The logo's two colours: the favicon uses the background colour on light browser themes, the mark's own on dark.
const onLight = /\bfill="([^"]+)"/.exec(rect)?.[1] ?? '#000000';
const onDark = /\bfill="([^"]+)"/.exec(mark)?.[1] ?? '#ffffff';

const n = (v) => +v.toFixed(4);
const mid = size / 2;
/** The mark scaled by `k` about `origin`, with `origin` moved to the centre of the canvas. */
const placement = (k, [ox, oy]) => `translate(${n(mid - ox * k)} ${n(mid - oy * k)}) scale(${n(k)})`;
/** The mark, moved by `transform` (null = as drawn), optionally on the background or restyled. */
function drawn(transform, { background = false, note, style } = {}) {
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`, '  <title>Weer</title>'];
  if (note) lines.push(`  <!-- ${note} -->`);
  if (style) lines.push(`  <style>\n    ${style.join('\n    ')}\n  </style>`);
  if (background) lines.push(`  ${rect}`);
  lines.push(transform ? `  <g transform="${transform}">\n    ${mark.replace(/\n\s*/g, '\n    ')}\n  </g>` : `  ${mark}`);
  return lines.join('\n') + '\n</svg>\n';
}

// Measure the mark on a 4x render: its bounding box and its farthest point from the centre.
const UP = 4;
const alpha = await sharp(Buffer.from(drawn(null)), { density: 72 * UP }).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
let farthest = 0;
for (let y = 0; y < alpha.info.height; y++) {
  for (let x = 0; x < alpha.info.width; x++) {
    if (alpha.data[y * alpha.info.width + x] === 0) continue; // any coverage counts: the tips are thin
    box.minX = Math.min(box.minX, x / UP);
    box.maxX = Math.max(box.maxX, (x + 1) / UP);
    box.minY = Math.min(box.minY, y / UP);
    box.maxY = Math.max(box.maxY, (y + 1) / UP);
    farthest = Math.max(farthest, Math.hypot((x + 0.5) / UP - mid, (y + 0.5) / UP - mid));
  }
}
if (!Number.isFinite(box.minX)) throw new Error('The mark in public/logo.svg renders empty.');
const centre = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
/** Scale at which the mark's longer side fills `share` of the canvas. */
const fit = (share) => (size * share) / Math.max(box.maxX - box.minX, box.maxY - box.minY);

// Maskable: launchers may crop anything outside a centred circle of 40% radius (kept with a 5% margin).
const safe = size * 0.4 * 0.95;
const maskable = farthest <= safe ? logo : drawn(placement(safe / farthest, [mid, mid]), { background: true });
// Favicon: no background, so the mark fills the square. A white mark would vanish on a light tab bar.
const faviconAt = placement(fit(1), centre);
const recolour = (fill) => `g * { fill: ${fill}; }`;
const favicon = drawn(faviconAt, {
  note: 'Generated from public/logo.svg by scripts/icons.mjs (npm run icons): the mark without the background, recoloured for light and dark browser themes.',
  style: [recolour(onLight), `@media (prefers-color-scheme: dark) { ${recolour(onDark)} }`],
});
const faviconIco = drawn(faviconAt, { style: [recolour(onLight)] });

async function png(svg, px, { keepAlpha = false } = {}) {
  // Render at twice the target or more, then downscale, for clean edges at every size.
  const density = Math.max(72, Math.ceil((72 * px * 2) / size));
  const img = sharp(Buffer.from(svg), { density }).resize(px, px, { kernel: 'lanczos3' });
  // Icons are opaque (App Store Connect rejects an alpha channel); the favicon is not.
  return (keepAlpha ? img.ensureAlpha() : img.removeAlpha()).png({ compressionLevel: 9 }).toBuffer();
}

/** A .ico of PNG images (read by every browser, and by Windows since Vista). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach(({ px, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(px % 256, o); // width, 0 = 256
    dir.writeUInt8(px % 256, o + 1); // height
    dir.writeUInt16LE(1, o + 4); // colour planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...images.map((im) => im.buf)]);
}

const outputs = [
  ['public/icons/192.png', await png(logo, 192)],
  ['public/icons/512.png', await png(logo, 512)],
  ['public/icons/512-maskable.png', await png(maskable, 512)],
  ['public/icons/apple-touch-icon.png', await png(logo, 180)],
  ['public/favicon.svg', Buffer.from(favicon)],
  ['public/favicon.ico', ico(await Promise.all([16, 32, 48].map(async (px) => ({ px, buf: await png(faviconIco, px, { keepAlpha: true }) }))))],
  ['design/app-icon-1024.png', await png(logo, 1024)],
];
for (const [file, buf] of outputs) {
  writeFileSync(join(root, file), buf);
  console.log(`wrote ${file} (${buf.length} bytes)`);
}
console.log(`mark: x ${n(box.minX)}–${n(box.maxX)}, y ${n(box.minY)}–${n(box.maxY)}; maskable: reaches ${n(farthest)} of the ${n(safe)} safe radius, ${farthest <= safe ? 'kept as drawn' : 'shrunk to fit'}`);
