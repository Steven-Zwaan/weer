import { describe, expect, it } from 'vitest';
import { barHeight, fadeOpacity, intensityLines, isStale, levelText, levelWithAmount, MINI_BAR, rainShort, rainSummary, roundRate, scrubEyebrow, upcoming } from '@/domain/rain';
import type { Nowcast, RainStep } from '@/domain/types';
import { fromZoned, AMSTERDAM, MINUTE } from '@/domain/time';

/** 25 five-minute steps from 14:30 Amsterdam, the design's example series. */
const START = fromZoned(2026, 10, 27, 14, 30, AMSTERDAM);
const steps = (values: number[], stepMinutes = 5): RainStep[] => values.map((v, i) => ({ time: START + i * stepMinutes * MINUTE, mmPerHour: v }));
const DESIGN = [0, 0, 0, 0, 0, 0.2, 0.8, 1.6, 2.4, 3.1, 2.2, 1.4, 0.9, 0.5, 0.3, 0.2, 0.1, 0, 0, 0.3, 0.6, 0.4, 0.2, 0, 0];

describe('bar height (§4.1)', () => {
  it('dry is a 3 px stub', () => {
    expect(barHeight(0, 96)).toBe(3);
    expect(barHeight(-1, 96)).toBe(3);
    expect(barHeight(NaN, 96)).toBe(3);
  });
  it('follows the square-root formula with a 5 px floor and the chart height as ceiling', () => {
    expect(barHeight(0.1, 96)).toBe(14); // sqrt(0.02) * 96 = 13.6
    expect(barHeight(0.01, 96)).toBe(5); // floor
    expect(barHeight(1, 96)).toBe(43);
    expect(barHeight(5, 96)).toBe(96);
    expect(barHeight(40, 96)).toBe(96); // ceiling
    expect(barHeight(3.1, 72)).toBe(57);
  });
  it('the mini chart on Locaties uses 2 px dry and a 4 px floor at 18 px', () => {
    expect(barHeight(0, 18, MINI_BAR)).toBe(2);
    expect(barHeight(0.05, 18, MINI_BAR)).toBe(4);
    expect(barHeight(5, 18, MINI_BAR)).toBe(18);
  });
});

describe('intensity lines (§4.2)', () => {
  it('match the design at every chart height', () => {
    expect(intensityLines(96).map((l) => [l.id, l.y])).toEqual([['zwaar', 96], ['matig', 43], ['licht', 14]]);
    expect(intensityLines(72).map((l) => l.y)).toEqual([72, 32, 10]);
    expect(intensityLines(64).map((l) => l.y)).toEqual([64, 29, 9]);
  });
  it('level text per rate', () => {
    expect(levelText(0)).toBe('Droog');
    expect(levelText(0.4)).toBe('Lichte regen');
    expect(levelText(1)).toBe('Matige regen');
    expect(levelText(4.9)).toBe('Matige regen');
    expect(levelText(5)).toBe('Zware regen');
    expect(levelWithAmount(3.1)).toBe('Matige regen · 3,1 mm/u');
    expect(levelWithAmount(0)).toBe('Droog');
  });
  it('rounds rates to one decimal and calls anything under 0.05 dry', () => {
    expect(roundRate(0.049)).toBe(0);
    expect(roundRate(0.05)).toBe(0.1);
    expect(roundRate(0.2054)).toBe(0.2);
    expect(roundRate(-3)).toBe(0);
  });
});

describe('uncertainty fade (§4.3)', () => {
  it('is full up to step 8, then fades 4.5% per step down to 30%', () => {
    expect(fadeOpacity(0)).toBe(1);
    expect(fadeOpacity(8)).toBe(1);
    expect(fadeOpacity(9)).toBeCloseTo(0.955);
    expect(fadeOpacity(24)).toBeCloseTo(0.3);
    expect(fadeOpacity(40)).toBe(0.3);
  });
});

describe('rain summary (§4.4)', () => {
  it('dry for 2 hours', () => {
    expect(rainSummary(steps(Array(25).fill(0)), 5, AMSTERDAM)).toBe('Droog komende 2 uur');
    expect(rainShort(steps(Array(25).fill(0)), 5)).toBe('Droog komende 2 uur');
  });
  it('wet for 2 hours', () => {
    expect(rainSummary(steps(Array(25).fill(0.4)), 5, AMSTERDAM)).toBe('Regen komende 2 uur');
    expect(rainShort(steps(Array(25).fill(0.4)), 5)).toBe('Regen komende 2 uur');
  });
  it('dry now, wet later: start and end of the first wet block (+5 min)', () => {
    // Wet from index 5 (14:55) to index 16 (0.1 counts as wet), so until 15:50 + 5 = 15:55.
    expect(rainSummary(steps(DESIGN), 5, AMSTERDAM)).toBe('Regen vanaf 14:55, tot ca. 15:55');
    expect(rainShort(steps(DESIGN), 5)).toBe('Regen over 25 min');
  });
  it('a wet block that runs to the end has no end time', () => {
    const v = [0, 0, 0, ...Array(22).fill(1)];
    expect(rainSummary(steps(v), 5, AMSTERDAM)).toBe('Regen vanaf 14:45');
  });
  it('wet now, dry later', () => {
    const v = [1.2, 1.8, 2.0, 1.4, 0.9, 0.6, 0.3, 0.1, ...Array(17).fill(0)];
    expect(rainSummary(steps(v), 5, AMSTERDAM)).toBe('Regen nu, droog over 40 min');
    expect(rainShort(steps(v), 5)).toBe('Droog over 40 min');
  });
  it('works with the 15-minute fallback', () => {
    const v = [0, 0, 0.4, 0.8, 0, 0, 0, 0];
    expect(rainSummary(steps(v, 15), 15, AMSTERDAM)).toBe('Regen vanaf 15:00, tot ca. 15:30');
    expect(rainShort(steps(v, 15), 15)).toBe('Regen over 30 min');
  });
  it('scrub eyebrow: "Nu" at the first step, then time and minutes ahead', () => {
    const s = steps(DESIGN);
    expect(scrubEyebrow(s, 0, AMSTERDAM)).toBe('Nu');
    expect(scrubEyebrow(s, 9, AMSTERDAM)).toBe('15:15 · over 45 min');
  });
});

describe('nowcast age', () => {
  const nc: Nowcast = { source: 'buienradar', stepMinutes: 5, steps: steps(DESIGN), fetchedAt: START };
  it('drops the steps that are over', () => {
    expect(upcoming(nc, START + 2 * MINUTE)).toHaveLength(25);
    expect(upcoming(nc, START + 5 * MINUTE)).toHaveLength(24);
    expect(upcoming(nc, START + 12 * MINUTE)[0].time).toBe(START + 10 * MINUTE);
  });
  it('is stale after 15 minutes', () => {
    expect(isStale(nc, START + 15 * MINUTE)).toBe(false);
    expect(isStale(nc, START + 16 * MINUTE)).toBe(true);
  });
});
