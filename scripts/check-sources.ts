// Source check (SPEC §10, fase 1): is every free data source still there, in the expected
// format, and reachable from a browser (CORS)? Run: npm run check-sources
//
// Plain Node (type stripping, no imports from src) so it runs without a build. Exit code 1
// when a source is down or changed; the result belongs under "Bevestigd" in SPEC.md §6.
export {};

const ORIGIN = 'http://localhost:5174';
const LAT = 52.09;
const LON = 5.12;

interface Check {
  name: string;
  url: string | (() => string); // a function when it depends on an earlier check
  expect: (body: string) => string | null; // null = ok, otherwise what is wrong
}

const now = new Date();
const RADAR_META =
  'https://image.buienradar.nl/2.0/metadata/sprite/RadarMapRainWebMercatorNL?extension=png&width=500&height=512' +
  '&renderText=False&renderBranding=False&renderBackground=False&history=0&forecast=24&skip=0';
let frameUrl = '';

const checks: Check[] = [
  {
    name: '6.1 Buienradar raintext',
    url: `https://gpsgadget.buienradar.nl/data/raintext?lat=${LAT}&lon=${LON}`,
    expect: (b) => {
      const rows = b.split(/\r?\n/).filter((l) => /^\d{3}\|\d{2}:\d{2}$/.test(l.trim()));
      return rows.length >= 20 ? null : `expected ~24 lines "000|HH:MM", got ${rows.length}`;
    },
  },
  {
    name: '6.2 Open-Meteo knmi_seamless',
    url:
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&models=knmi_seamless&timezone=auto&timeformat=unixtime&forecast_days=10` +
      '&current=temperature_2m,weather_code,uv_index&hourly=temperature_2m,precipitation&daily=precipitation_probability_max,uv_index_max,sunrise&minutely_15=precipitation&forecast_minutely_15=12',
    expect: (b) => {
      const j = JSON.parse(b) as { daily?: Record<string, unknown[]>; hourly?: { time: unknown[] }; current?: Record<string, unknown> };
      if (!j.current || typeof j.current.temperature_2m !== 'number') return 'no current temperature';
      if ((j.hourly?.time.length ?? 0) < 200) return 'fewer than 200 hours';
      const prob = j.daily?.precipitation_probability_max ?? [];
      const uv = j.daily?.uv_index_max ?? [];
      const nulls = [prob.every((v) => v === null) && 'precipitation_probability_max', uv.every((v) => v === null) && 'uv_index_max'].filter(Boolean);
      return nulls.length ? `all null with knmi_seamless: ${nulls.join(', ')} (the app fetches these without models)` : null;
    },
  },
  {
    name: '6.4 Open-Meteo geocoding',
    url: 'https://geocoding-api.open-meteo.com/v1/search?name=utrecht&count=8&language=nl',
    expect: (b) => {
      const j = JSON.parse(b) as { results?: { country_code?: string; admin1?: string }[] };
      return j.results?.some((r) => r.country_code === 'NL' && r.admin1 === 'Utrecht') ? null : 'Utrecht, NL not found';
    },
  },
  {
    name: '8   PDOK reverse geocoding',
    url: `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${LAT}&lon=${LON}&type=woonplaats&rows=1&fl=woonplaatsnaam`,
    expect: (b) => ((JSON.parse(b) as { response?: { docs?: { woonplaatsnaam?: string }[] } }).response?.docs?.[0]?.woonplaatsnaam ? null : 'no woonplaatsnaam'),
  },
  {
    name: '6.3 Buienradar radar frames',
    url: RADAR_META,
    expect: (b) => {
      const times = (JSON.parse(b) as { times?: { timestamp: string; url: string }[] }).times ?? [];
      if (times.length < 20) return `expected ~24 frames, got ${times.length}`;
      const first = Date.parse(`${times[0].timestamp}Z`);
      const step = Date.parse(`${times[1].timestamp}Z`) - first;
      if (step !== 5 * 60_000) return `expected 5-minute frames, got ${step / 60_000} min`;
      // Zone-less timestamps are UTC: the first frame is about now.
      if (Math.abs(first - now.getTime()) > 20 * 60_000) return `first frame ${times[0].timestamp} is not about now (UTC?)`;
      frameUrl = times[Math.floor(times.length / 2)].url;
      return null;
    },
  },
  {
    name: '6.3 Buienradar radar image',
    url: () => frameUrl,
    expect: (b) => (b.includes('PNG') ? null : 'not a PNG'),
  },
  {
    name: '6.3 OpenStreetMap tile',
    url: 'https://tile.openstreetmap.org/10/526/336.png',
    expect: (b) => (b.includes('PNG') ? null : 'not a PNG'),
  },
];

let failed = 0;
for (const c of checks) {
  try {
    const url = typeof c.url === 'function' ? c.url() : c.url;
    if (!url) throw new Error('skipped: depends on a failed check');
    const res = await fetch(url, { headers: { Origin: ORIGIN, 'User-Agent': 'weer-app source check (personal use)' }, signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    const cors = res.headers.get('access-control-allow-origin');
    const problem = !res.ok ? `HTTP ${res.status}` : !cors ? 'no Access-Control-Allow-Origin header (needs the proxy)' : c.expect(body);
    if (problem) failed++;
    console.log(`${problem ? 'FAIL' : 'ok  '}  ${c.name.padEnd(32)} ${res.status}  CORS: ${cors ?? '-'}  ${res.headers.get('content-type') ?? ''}${problem ? `\n      ${problem}` : ''}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${c.name.padEnd(32)} ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log(failed ? `\n${failed} source(s) need attention.` : '\nAll sources confirmed. The radar image position: npm run check-radar.');
process.exitCode = failed ? 1 : 0;
