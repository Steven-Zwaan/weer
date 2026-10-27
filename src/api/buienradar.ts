/**
 * Buienradar raintext (SPEC §6.1): precipitation for the next 2 hours in 5-minute steps.
 *
 *   GET https://gpsgadget.buienradar.nl/data/raintext?lat=52.09&lon=5.12
 *   077|15:40\n087|15:45\n…   (value 0-255 | Amsterdam wall-clock time)
 *
 * The service sends `Access-Control-Allow-Origin: *`, so the app calls it directly. The
 * /api/rain proxy is a fallback for the day that header disappears. Outside NL/BE it
 * answers 404 and the caller uses the Open-Meteo minutely_15 fallback instead.
 */
import type { Nowcast, RainStep } from '@/domain/types';
import { roundRate } from '@/domain/rain';
import { AMSTERDAM, HOUR, MINUTE, fromZoned, zoned } from '@/domain/time';
import { roundCoord } from '@/domain/locations';
import { NetworkError, getText } from './http';

export const RAINTEXT_URL = 'https://gpsgadget.buienradar.nl/data/raintext';
export const PROXY_URL = '/api/rain';

/** Raw 0-255 value to mm/h: 10^((value - 109) / 32), 0 is dry. */
export function valueToMm(value: number): number {
  if (!(value > 0)) return 0;
  return roundRate(10 ** ((value - 109) / 32));
}

/**
 * Parse the text into steps. Times are HH:MM in Amsterdam; the first line is anchored to the
 * day closest to `now` and every later time that goes backwards moves to the next day, so a
 * forecast across midnight keeps counting up.
 */
export function parseRaintext(text: string, now: number): RainStep[] {
  const rows = text
    .split(/\r?\n/)
    .map((l) => /^\s*(\d{1,3})\s*\|\s*(\d{1,2}):(\d{2})\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null);
  const steps: RainStep[] = [];
  const today = zoned(now, AMSTERDAM);
  let dayOffset = 0;
  let prev = -Infinity;
  for (const [, v, hh, mm] of rows) {
    let t = fromZoned(today.year, today.month, today.day + dayOffset, Number(hh), Number(mm), AMSTERDAM);
    if (steps.length === 0) {
      // 23:58 with a first line of 00:00 means tomorrow; 00:02 with 23:55 means yesterday.
      if (t < now - 12 * HOUR) {
        dayOffset = 1;
        t = fromZoned(today.year, today.month, today.day + 1, Number(hh), Number(mm), AMSTERDAM);
      } else if (t > now + 12 * HOUR) {
        dayOffset = -1;
        t = fromZoned(today.year, today.month, today.day - 1, Number(hh), Number(mm), AMSTERDAM);
      }
    } else if (t <= prev) {
      dayOffset += 1;
      t = fromZoned(today.year, today.month, today.day + dayOffset, Number(hh), Number(mm), AMSTERDAM);
    }
    prev = t;
    steps.push({ time: t, mmPerHour: valueToMm(Number(v)) });
  }
  return steps;
}

export async function fetchBuienradar(lat: number, lon: number, signal?: AbortSignal, now = Date.now()): Promise<Nowcast> {
  const q = `lat=${roundCoord(lat)}&lon=${roundCoord(lon)}`;
  let text: string;
  try {
    text = await getText(`${RAINTEXT_URL}?${q}`, { timeoutMs: 8_000, signal });
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // Blocked or unreachable directly: try the proxy before giving up.
    text = await getText(`${PROXY_URL}?${q}`, { timeoutMs: 8_000, signal });
  }
  const steps = parseRaintext(text, now);
  if (steps.length < 2) throw new Error('Buienradar: unexpected raintext format');
  return { source: 'buienradar', stepMinutes: 5, steps, fetchedAt: now };
}

// ---------------- radar images ----------------
//
// Buienradar's forecast radar images (SPEC §6.3): the same nowcast as the raintext, one image
// per 5 minutes up to ~2 hours ahead, transparent PNG in Web Mercator. The geographic extent is
// not documented; RADAR_BOUNDS is the extent other projects use, and scripts/check-radar-bounds.mjs
// checks it against KNMI's exactly georeferenced radar (it matched to the pixel, see SPEC §6.3).

export const RADAR_IMAGE = { type: 'RadarMapRainWebMercatorNL', width: 500, height: 512 } as const;
/** [[south, west], [north, east]] of every radar image. */
export const RADAR_BOUNDS: [[number, number], [number, number]] = [
  [49.5, 0],
  [54.8, 10],
];

export const RADAR_META_URL =
  `https://image.buienradar.nl/2.0/metadata/sprite/${RADAR_IMAGE.type}?extension=png&width=${RADAR_IMAGE.width}&height=${RADAR_IMAGE.height}` +
  '&renderText=False&renderBranding=False&renderBackground=False&history=0&forecast=24&skip=0';

export interface RadarFrame {
  time: number;
  url: string;
}

interface RadarMeta {
  times?: { timestamp?: string; url?: string }[];
}

/** The frame list. Timestamps are UTC without a zone ("2026-10-27T14:45:00"). */
export function parseRadarMeta(json: RadarMeta): RadarFrame[] {
  return (json.times ?? [])
    .map((t) => ({ time: Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t.timestamp ?? '') ? t.timestamp! : `${t.timestamp}Z`), url: t.url ?? '' }))
    .filter((f) => Number.isFinite(f.time) && f.url.startsWith('https://image.buienradar.nl/'))
    .sort((a, b) => a.time - b.time);
}

export async function fetchRadarFrames(signal?: AbortSignal): Promise<RadarFrame[]> {
  return parseRadarMeta(JSON.parse(await getText(RADAR_META_URL, { timeoutMs: 8_000, signal })) as RadarMeta);
}

/** 15-minute Open-Meteo steps as a nowcast: 8 bars covering the next 2 hours. */
export function nowcastFromMinutely(minutely: RainStep[], fetchedAt: number, now: number): Nowcast | null {
  const ahead = minutely.filter((s) => s.time + 15 * MINUTE > now).slice(0, 8);
  return ahead.length >= 2 ? { source: 'open-meteo', stepMinutes: 15, steps: ahead, fetchedAt } : null;
}
