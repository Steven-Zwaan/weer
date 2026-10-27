import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RADAR_BOUNDS, nowcastFromMinutely, parseRadarMeta, parseRaintext, valueToMm } from '@/api/buienradar';
import { AMSTERDAM, MINUTE, fromZoned, hhmm } from '@/domain/time';

// A real answer, recorded on 27 October 2026 at 15:03 for Utrecht.
const FIXTURE = readFileSync(new URL('./fixtures/raintext-utrecht.txt', import.meta.url), 'utf8');
const RECORDED = fromZoned(2026, 10, 27, 15, 3, AMSTERDAM);

describe('Buienradar value to mm/h (§6.1)', () => {
  it('uses 10^((value - 109) / 32), 0 is dry', () => {
    expect(valueToMm(0)).toBe(0);
    expect(valueToMm(77)).toBe(0.1);
    expect(valueToMm(87)).toBe(0.2);
    expect(valueToMm(109)).toBe(1);
    expect(valueToMm(131)).toBe(4.9);
    expect(valueToMm(255)).toBeGreaterThan(30000); // the scale's ceiling, clipped by the chart
  });
  it('anything under 0.05 mm/h is dry', () => {
    expect(valueToMm(60)).toBe(0); // 0.029
    expect(valueToMm(68)).toBe(0.1); // 0.052
  });
});

describe('raintext parsing', () => {
  it('reads the recorded answer: 24 steps of 5 minutes from 15:05', () => {
    const steps = parseRaintext(FIXTURE, RECORDED);
    expect(steps).toHaveLength(24);
    expect(hhmm(steps[0].time, AMSTERDAM)).toBe('15:05');
    expect(steps[1].time - steps[0].time).toBe(5 * MINUTE);
    expect(steps[0].mmPerHour).toBe(0.2); // 087 -> 0.205
  });
  it('accepts CRLF and stray whitespace', () => {
    const steps = parseRaintext('000|14:30\r\n077|14:35\r\n\r\n 109 | 14:40 \r\n', fromZoned(2026, 10, 27, 14, 28, AMSTERDAM));
    expect(steps.map((s) => s.mmPerHour)).toEqual([0, 0.1, 1]);
  });
  it('moves times after midnight to the next day', () => {
    const now = fromZoned(2026, 10, 27, 23, 50, AMSTERDAM);
    const steps = parseRaintext('000|23:55\n000|00:00\n000|00:05\n', now);
    expect(steps[1].time - steps[0].time).toBe(5 * MINUTE);
    expect(steps[2].time).toBe(fromZoned(2026, 10, 28, 0, 5, AMSTERDAM));
  });
  it('anchors a first line of 00:00 at 23:58 to tomorrow', () => {
    const now = fromZoned(2026, 10, 27, 23, 58, AMSTERDAM);
    const steps = parseRaintext('000|00:00\n000|00:05\n', now);
    expect(steps[0].time).toBe(fromZoned(2026, 10, 28, 0, 0, AMSTERDAM));
  });
  it('ignores lines that are not value|HH:MM', () => {
    expect(parseRaintext('Not found: location must be inside the Netherlands or Belgium.', RECORDED)).toEqual([]);
  });
});

describe('radar images (§6.3)', () => {
  // A real frame list, recorded on 27 October 2026 at 15:45 Amsterdam time.
  const meta = JSON.parse(readFileSync(new URL('./fixtures/buienradar-radar-meta.json', import.meta.url), 'utf8'));
  const frames = parseRadarMeta(meta);
  it('lists 24 frames of 5 minutes, about 2 hours ahead', () => {
    expect(frames).toHaveLength(24);
    expect(frames[1].time - frames[0].time).toBe(5 * MINUTE);
    expect(frames[23].time - frames[0].time).toBe(115 * MINUTE);
  });
  it('reads the zone-less timestamps as UTC', () => {
    expect(frames[0].time).toBe(Date.UTC(2026, 9, 27, 14, 45));
    expect(hhmm(frames[0].time, AMSTERDAM)).toBe('15:45');
  });
  it('keeps only Buienradar image URLs', () => {
    expect(frames.every((f) => f.url.startsWith('https://image.buienradar.nl/2.0/image/single/'))).toBe(true);
    expect(parseRadarMeta({ times: [{ timestamp: '2026-10-27T14:45:00', url: 'https://example.com/x.png' }] })).toEqual([]);
    expect(parseRadarMeta({})).toEqual([]);
  });
  it('the image covers NL and BE', () => {
    const [[s, w], [n, e]] = RADAR_BOUNDS;
    for (const [lat, lon] of [[53.45, 6.83], [50.75, 6.02], [51.0, 2.55], [49.5, 5.8]]) {
      expect(lat >= s && lat <= n && lon >= w && lon <= e, `${lat},${lon}`).toBe(true);
    }
  });
});

describe('Open-Meteo minutely_15 fallback', () => {
  const start = fromZoned(2026, 10, 27, 15, 0, AMSTERDAM);
  const minutely = Array.from({ length: 12 }, (_, i) => ({ time: start + i * 15 * MINUTE, mmPerHour: i === 3 ? 0.8 : 0 }));
  it('gives 8 steps of 15 minutes from the current quarter', () => {
    const nc = nowcastFromMinutely(minutely, start, start + 20 * MINUTE)!;
    expect(nc.source).toBe('open-meteo');
    expect(nc.stepMinutes).toBe(15);
    expect(nc.steps).toHaveLength(8);
    expect(nc.steps[0].time).toBe(start + 15 * MINUTE);
  });
  it('is absent when there is nothing ahead', () => {
    expect(nowcastFromMinutely(minutely, start, start + 4 * 60 * MINUTE)).toBeNull();
  });
});
