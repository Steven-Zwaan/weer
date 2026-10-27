import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseForecast, type OMResponse } from '@/api/openmeteo';
import { dayName, hoursAhead, nextSunEvent, pickerLabel, tempBars, tempChart, uvTile } from '@/domain/days';
import { offsetLabel, rainAxis } from '@/domain/axis';
import { addPlace, distanceKm, movePlace, placeLine, removePlace, sortPlaces } from '@/domain/locations';
import { frameAt, radarTimeline } from '@/domain/radar';
import type { Day, Location, Nowcast } from '@/domain/types';
import { AMSTERDAM, MINUTE, fromZoned, hhmm } from '@/domain/time';

const OM: OMResponse = JSON.parse(readFileSync(new URL('./fixtures/open-meteo-utrecht.json', import.meta.url), 'utf8'));
const F = parseForecast(OM, 'om-2745912', 52.09, 5.12, Date.UTC(2026, 9, 27, 14, 3));
const NOW = fromZoned(2026, 10, 27, 15, 3, AMSTERDAM);

describe('10-day list', () => {
  it('shares one scale across all days, warm from 13°', () => {
    const days = [
      { min: 7, max: 14 },
      { min: 4, max: 10 },
      { min: 6, max: 12 },
    ] as Day[];
    expect(tempBars(days)).toEqual([
      { left: 30, width: 70, warm: true },
      { left: 0, width: 60, warm: false },
      { left: 20, width: 60, warm: false },
    ]);
  });
  it('names today and the weekdays', () => {
    expect(dayName(F.days[0], 0, AMSTERDAM)).toBe('Vandaag');
    expect(dayName(F.days[1], 1, AMSTERDAM)).toBe('Wo');
    expect(pickerLabel(F.days[0], 0, AMSTERDAM)).toEqual({ short: 'Vand.', num: 27 });
    expect(pickerLabel(F.days[2], 2, AMSTERDAM)).toEqual({ short: 'Do', num: 29 });
  });
});

describe('hour strip and tiles', () => {
  it('starts at the current hour', () => {
    const hours = hoursAhead(F, NOW);
    expect(hours).toHaveLength(10);
    expect(hhmm(hours[0].time, AMSTERDAM)).toBe('15:00');
  });
  it('the sun tile shows the next event and the one after it', () => {
    const sun = nextSunEvent(F.days, NOW)!;
    expect(sun.label).toBe('Onder');
    expect(hhmm(sun.time, AMSTERDAM)).toBe('17:20');
    expect(sun.other?.label).toBe('op');
    expect(hhmm(sun.other!.time, AMSTERDAM)).toBe('07:27');
  });
  it('the UV tile says when it stays low all day', () => {
    expect(uvTile(F, NOW)).toEqual({ value: 0, text: 'Laag, de hele dag' });
  });
});

describe('day chart', () => {
  it('puts a point in the middle of every hour, 1° of headroom each side', () => {
    const c = tempChart(F.days[0].hours, 240);
    expect(c.points).toHaveLength(24);
    expect(c.points[0].x).toBe(5);
    expect(c.points[23].x).toBe(235);
    expect(c.tTop).toBe(Math.round(Math.max(...F.days[0].hours.map((h) => h.temp))) + 1);
    expect(Math.min(...c.points.map((p) => p.y))).toBeGreaterThanOrEqual(20);
    expect(Math.max(...c.points.map((p) => p.y))).toBeLessThanOrEqual(100);
    expect(c.area.startsWith('M5.0,110 L')).toBe(true);
  });
});

describe('time axis', () => {
  const start = fromZoned(2026, 10, 27, 14, 30, AMSTERDAM);
  const times = Array.from({ length: 25 }, (_, i) => start + i * 5 * MINUTE);
  it('is "Nu" plus the half hours, as in the design', () => {
    expect(rainAxis(times, AMSTERDAM).map((l) => l.text)).toEqual(['Nu', '15:00', '15:30', '16:00', '16:30']);
  });
  it('drops a half hour that would sit on top of "Nu"', () => {
    const t = times.map((x) => x + 25 * MINUTE); // 14:55 onwards
    expect(rainAxis(t, AMSTERDAM).map((l) => l.text)).toEqual(['Nu', '15:30', '16:00', '16:30']);
  });
  it('offsets on the radar timeline', () => {
    expect(offsetLabel(start + 40 * MINUTE, start)).toBe('+40 min');
    expect(offsetLabel(start - 20 * MINUTE, start)).toBe('−20 min');
    expect(offsetLabel(start, start)).toBe('Nu');
  });
});

describe('radar timeline (§2.2, §6.3)', () => {
  const t0 = fromZoned(2026, 10, 27, 15, 0, AMSTERDAM);
  const nowcast: Nowcast = {
    source: 'buienradar',
    stepMinutes: 5,
    fetchedAt: t0,
    steps: Array.from({ length: 24 }, (_, i) => ({ time: t0 + 5 * MINUTE + i * 5 * MINUTE, mmPerHour: i < 6 ? 0 : 1 })), // 15:05-17:00
  };
  const frames = Array.from({ length: 24 }, (_, i) => t0 + i * 5 * MINUTE); // 15:00-16:55
  const now = t0 + 7 * MINUTE;
  const steps = radarTimeline(nowcast, frames, now);
  it('runs from "Nu" into the future only, with the nowcast at the location', () => {
    expect(hhmm(steps[0].time, AMSTERDAM)).toBe('15:05'); // the 15:05 step is still running at 15:07
    expect(steps).toHaveLength(24);
    expect(steps[6].mmPerHour).toBe(1);
  });
  it('pairs every step with the image of the same moment', () => {
    expect(steps[0].frame).toBe(t0 + 5 * MINUTE);
    expect(steps[22].frame).toBe(t0 + 115 * MINUTE);
    expect(steps[23].frame).toBeNull(); // 17:00 has no image yet
    expect(frameAt(steps, 23)).toBe(t0 + 115 * MINUTE); // so the map keeps the last one
  });
  it('without a nowcast the images alone are the timeline', () => {
    const only = radarTimeline(null, frames, now);
    expect(only[0].frame).toBe(t0 + 5 * MINUTE);
    expect(only.every((s) => s.mmPerHour === null)).toBe(true);
  });
  it('without images the chart still runs', () => {
    const noImages = radarTimeline(nowcast, [], now);
    expect(noImages).toHaveLength(24);
    expect(frameAt(noImages, 3)).toBeNull();
  });
});

describe('saved places (§2.4)', () => {
  const place = (id: string, cc: string, lat = 52, lon = 5): Location => ({ id, name: id, countryCode: cc, lat, lon, isGps: false });
  it('sorts NL, then BE, then the rest in their own order', () => {
    expect(sortPlaces([place('za', 'ZA'), place('be', 'BE'), place('sr', 'SR'), place('nl', 'NL')]).map((p) => p.id)).toEqual(['nl', 'be', 'za', 'sr']);
  });
  it('adds, dedupes, removes and moves', () => {
    const a = place('a', 'NL', 52, 5);
    const b = place('b', 'NL', 51, 4);
    let { list, index } = addPlace([], a);
    ({ list, index } = addPlace(list, b));
    expect(index).toBe(1);
    expect(addPlace(list, { ...a, id: 'a2' }).index).toBe(0); // same coordinates
    expect(movePlace(list, 1, 0).map((p) => p.id)).toEqual(['b', 'a']);
    expect(removePlace(list, 'a').map((p) => p.id)).toEqual(['b']);
  });
  it('place line and distance', () => {
    expect(placeLine({ ...place('x', 'NL'), name: 'Utrecht', admin: 'Utrecht', country: 'Nederland' })).toBe('Utrecht, Utrecht · Nederland');
    expect(distanceKm({ lat: 52.09, lon: 5.12 }, { lat: 52.37, lon: 4.9 })).toBeCloseTo(34.5, 0);
  });
});
