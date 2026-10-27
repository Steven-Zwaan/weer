// Checks where Buienradar's radar image lies on the map (SPEC §6.3). Run: npm run check-radar
//
// Buienradar does not document the extent of RadarMapRainWebMercatorNL; the app uses
// RADAR_BOUNDS from src/api/buienradar.ts (keep BOUNDS below in sync). This script compares a
// Buienradar observation frame with KNMI's radar, which its WMS georeferences exactly, rendered
// for the same bounds and size. Both are cut at the same rain coverage and slid over each other:
// the right bounds give a best match at a shift of 0,0 for one of the KNMI times. Buienradar
// stamps a frame about 5 minutes later than KNMI, so several KNMI times are tried; a bounds
// error would show the same shift at every time instead.
//
// Needs rain somewhere over NL/BE; on a dry day the result is inconclusive.
import sharp from 'sharp';

const BOUNDS = { south: 49.5, west: 0, north: 54.8, east: 10 };
const W = 500;
const H = 512;
const COVERAGE = 0.04; // compare the heaviest 4 % of each image
const TOLERANCE = 2; // px

const R = 6378137;
const mx = (lon) => (R * lon * Math.PI) / 180;
const my = (lat) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

async function image(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const { data } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().resize(W, H, { fit: 'fill', kernel: 'nearest' }).raw().toBuffer({ resolveWithObject: true });
  // Rain strength as darkness weighted by opacity: both palettes get darker with more rain.
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = (data[i * 4 + 3] / 255) * (1 - (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 765);
  return d;
}

function mask(d) {
  const t = Float32Array.from(d).sort()[Math.floor(W * H * (1 - COVERAGE))];
  return Uint8Array.from(d, (v) => (v > t && v > 0 ? 1 : 0));
}

function overlap(a, b, dx, dy) {
  let inter = 0;
  let union = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xb = x + dx;
      const yb = y + dy;
      const va = a[y * W + x];
      const vb = xb >= 0 && xb < W && yb >= 0 && yb < H ? b[yb * W + xb] : 0;
      if (va && vb) inter++;
      if (va || vb) union++;
    }
  }
  return union ? inter / union : 0;
}

// The newest Buienradar frame that is an observation (not after the run time).
const metaUrl =
  `https://image.buienradar.nl/2.0/metadata/sprite/RadarMapRainWebMercatorNL?extension=png&width=${W}&height=${H}` +
  '&renderText=False&renderBranding=False&renderBackground=False&history=6&forecast=0&skip=0';
const meta = await (await fetch(metaUrl, { signal: AbortSignal.timeout(20_000) })).json();
const frames = meta.times.map((t) => ({ time: Date.parse(`${t.timestamp}Z`), url: t.url, run: /runTimestamp=(\d{12})/.exec(t.url)?.[1] }));
const runOf = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12));
const observed = frames.filter((f) => f.run && f.time <= runOf(f.run)).at(-1);
if (!observed) throw new Error('No Buienradar observation frame found.');

const brRaw = await image(observed.url);
const wet = brRaw.filter((v) => v > 0.1).length / (W * H);
console.log(`Buienradar ${iso(observed.time)}: ${(wet * 100).toFixed(1)}% of the image has rain`);
if (wet < 0.01) {
  console.log('Too little rain over NL/BE to compare. Try again on a rainy day.');
  process.exit(0);
}
const br = mask(brRaw);

const bbox = [mx(BOUNDS.west), my(BOUNDS.south), mx(BOUNDS.east), my(BOUNDS.north)].join(',');
let best = null;
for (const minutes of [-15, -10, -5, 0]) {
  const t = observed.time + minutes * 60_000;
  const knmi = mask(
    await image(
      'https://geoservices.knmi.nl/adagucserver?dataset=RADAR&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=RAD_NL25_PCP_CM' +
        `&STYLES=precip-blue-transparent/nearest&CRS=EPSG:3857&BBOX=${bbox}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${iso(t)}`,
    ),
  );
  let r = { v: -1, dx: 0, dy: 0 };
  for (let dy = -30; dy <= 30; dy++) for (let dx = -30; dx <= 30; dx++) {
    const v = overlap(knmi, br, dx, dy);
    if (v > r.v) r = { v, dx, dy };
  }
  console.log(`  vs KNMI ${iso(t)} (${String(minutes).padStart(3)} min): best overlap ${r.v.toFixed(3)} at a shift of ${r.dx}, ${r.dy} px`);
  if (!best || r.v > best.v) best = { ...r, minutes };
}
const ok = Math.abs(best.dx) <= TOLERANCE && Math.abs(best.dy) <= TOLERANCE;
console.log(
  ok
    ? `\nBounds confirmed: best match at ${best.dx}, ${best.dy} px against KNMI ${best.minutes} min.`
    : `\nBounds look off by ${best.dx}, ${best.dy} px (1 px is about 0.02° east-west, 0.01° north-south). Update RADAR_BOUNDS and SPEC §6.3.`,
);
process.exitCode = ok ? 0 : 1;
