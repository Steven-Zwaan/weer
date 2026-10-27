/**
 * The 10-day list, the day picker, the day chart and the detail tiles: pure derivations
 * from a Forecast.
 */
import type { Day, Forecast, Hour } from './types';
import { MONTHS, WEEKDAYS_SHORT, uvLabel } from './format';
import { hhmm, zoned } from './time';

export const WARM_FROM = 13; // max >= 13° paints the temperature bar warm (§2.1)

export interface TempBar {
  left: number; // percent
  width: number; // percent
  warm: boolean;
}

/** Each day's bar on one shared scale: the coldest night to the warmest day of all 10 days. */
export function tempBars(days: Day[]): TempBar[] {
  if (days.length === 0) return [];
  const lo = Math.min(...days.map((d) => Math.round(d.min)));
  const hi = Math.max(...days.map((d) => Math.round(d.max)));
  const span = Math.max(1, hi - lo);
  return days.map((d) => {
    const min = Math.round(d.min);
    const max = Math.round(d.max);
    return { left: ((min - lo) / span) * 100, width: (Math.max(0, max - min) / span) * 100, warm: max >= WARM_FROM };
  });
}

/** "Vandaag", then "Wo", "Do"… */
export function dayName(day: Day, index: number, tz: string): string {
  return index === 0 ? 'Vandaag' : WEEKDAYS_SHORT[zoned(day.date, tz).weekday];
}

/** Day picker: "Vand." and the day of the month. */
export function pickerLabel(day: Day, index: number, tz: string): { short: string; num: number } {
  const z = zoned(day.date, tz);
  return { short: index === 0 ? 'Vand.' : WEEKDAYS_SHORT[z.weekday], num: z.day };
}

export function monthName(day: Day, tz: string): string {
  return MONTHS[zoned(day.date, tz).month - 1];
}

/** The hours from the current hour on; the first is labelled "Nu" in the strip. */
export function hoursAhead(forecast: Forecast, now: number, count = 10): Hour[] {
  const start = forecast.hours.findIndex((h) => h.time + 3_600_000 > now);
  return start < 0 ? [] : forecast.hours.slice(start, start + count);
}

export interface SunTile {
  time: number;
  label: 'Op' | 'Onder';
  other: { label: 'op' | 'onder'; time: number } | null;
}

/** The next sunrise or sunset, and the event after it (§2.1 "eerstvolgende op of onder"). */
export function nextSunEvent(days: Day[], now: number): SunTile | null {
  const events: { label: 'Op' | 'Onder'; time: number }[] = [];
  for (const d of days) {
    if (d.sunrise !== null) events.push({ label: 'Op', time: d.sunrise });
    if (d.sunset !== null) events.push({ label: 'Onder', time: d.sunset });
  }
  events.sort((a, b) => a.time - b.time);
  const i = events.findIndex((e) => e.time > now);
  if (i < 0) return null;
  const next = events[i + 1];
  return {
    time: events[i].time,
    label: events[i].label,
    other: next ? { label: next.label === 'Op' ? 'op' : 'onder', time: next.time } : null,
  };
}

/** UV tile: the current hour's index plus how the rest of the day looks. */
export function uvTile(forecast: Forecast, now: number): { value: number; text: string } | null {
  const today = forecast.days[0];
  const hour = hoursAhead(forecast, now, 1)[0];
  const value = forecast.current.uv ?? hour?.uv ?? null;
  if (value === null) return null;
  const max = today?.uvMax ?? null;
  const label = uvLabel(value);
  if (max === null) return { value: Math.round(value), text: label };
  if (uvLabel(max) === 'Laag') return { value: Math.round(value), text: 'Laag, de hele dag' };
  if (uvLabel(max) === label) return { value: Math.round(value), text: label };
  let peak: Hour | null = null;
  for (const h of today.hours) if (h.uv !== null && (peak === null || h.uv > (peak.uv ?? -1))) peak = h;
  const at = peak && peak.time > now ? ` om ${hhmm(peak.time, forecast.timezone)}` : '';
  return { value: Math.round(value), text: `${label} · max ${Math.round(max)}${at}` };
}

/** Average wind over a day's hours (Dagdetail tile: "gemiddelde, richting, stoten"). */
export function averageWind(day: Day): number {
  if (day.hours.length === 0) return day.windMaxKmh;
  return day.hours.reduce((s, h) => s + h.windKmh, 0) / day.hours.length;
}

export interface TempChart {
  points: { x: number; y: number }[];
  line: string;
  area: string;
  tTop: number;
  tBottom: number;
  peak: number; // index of the warmest hour
  y(t: number): number;
}

/**
 * The temperature line of Dagdetail: one point in the middle of each hour column, scaled to
 * 1° under the coldest and 1° over the warmest hour (the design's formula).
 */
export function tempChart(hours: Hour[], width: number, top = 20, bottom = 100, areaBottom = 110): TempChart {
  const temps = hours.map((h) => h.temp);
  const tMin = Math.round(Math.min(...temps)) - 1;
  const tMax = Math.round(Math.max(...temps)) + 1;
  const n = Math.max(1, hours.length);
  const x = (i: number) => ((i + 0.5) / n) * width;
  const y = (t: number) => bottom - ((t - tMin) / Math.max(1, tMax - tMin)) * (bottom - top);
  const points = temps.map((t, i) => ({ x: x(i), y: y(t) }));
  const f = (v: number) => v.toFixed(1);
  const line = points.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
  const area = points.length ? `M${f(points[0].x)},${areaBottom} L${points.map((p) => `${f(p.x)},${f(p.y)}`).join(' L')} L${f(points[points.length - 1].x)},${areaBottom} Z` : '';
  let peak = 0;
  temps.forEach((t, i) => {
    if (t > temps[peak]) peak = i;
  });
  return { points, line, area, tTop: tMax, tBottom: tMin, peak, y };
}
