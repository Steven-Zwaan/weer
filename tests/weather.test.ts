import { describe, expect, it } from 'vitest';
import { conditionOf, describe as describeCode, heroDescription, iconOf } from '@/domain/weather';
import { deg, dec, longDate, tempLabel, uvLabel, windDirection } from '@/domain/format';
import type { Current, Nowcast } from '@/domain/types';
import { AMSTERDAM, MINUTE, fromZoned } from '@/domain/time';

describe('weather codes (§7)', () => {
  it('maps every code group to its condition', () => {
    const groups: [number[], string][] = [
      [[0, 1], 'clear'],
      [[2], 'partly'],
      [[3], 'cloudy'],
      [[45, 48], 'fog'],
      [[51, 53, 55, 56, 57], 'drizzle'],
      [[61, 63, 65, 66, 67], 'rain'],
      [[71, 73, 75, 77, 85, 86], 'snow'],
      [[80, 81, 82], 'showers'],
      [[95, 96, 99], 'thunder'],
    ];
    for (const [codes, condition] of groups) for (const c of codes) expect(conditionOf(c), `code ${c}`).toBe(condition);
  });
  it('has Dutch text with night variants for clear skies', () => {
    expect(describeCode(0, true)).toBe('Zonnig');
    expect(describeCode(0, false)).toBe('Helder');
    expect(describeCode(1, false)).toBe('Overwegend helder');
    expect(describeCode(2, false)).toBe('Half bewolkt');
    expect(describeCode(61)).toBe('Lichte regen');
    expect(describeCode(65)).toBe('Zware regen');
    expect(describeCode(66)).toBe('IJzel');
    expect(describeCode(77)).toBe('Sneeuwkorrels');
    expect(describeCode(80)).toBe('Lichte buien');
    expect(describeCode(99)).toBe('Onweer met hagel');
  });
  it('falls back for codes outside the table', () => {
    expect(conditionOf(64)).toBe('rain'); // nearest lower: 63
    expect(conditionOf(-1)).toBe('cloudy');
  });
  it('picks day and night icons', () => {
    expect(iconOf('clear', true)).toBe('sun');
    expect(iconOf('clear', false)).toBe('moon');
    expect(iconOf('partly', false)).toBe('moon-cloud');
    expect(iconOf('showers')).toBe('rain');
    expect(iconOf('thunder')).toBe('thunder');
  });
});

describe('hero description: the radar beats the model for right now', () => {
  const now = fromZoned(2026, 10, 27, 14, 30, AMSTERDAM);
  const current = { code: 3, condition: 'cloudy', isDay: true } as Current;
  const nc = (v: number): Nowcast => ({ source: 'buienradar', stepMinutes: 5, fetchedAt: now, steps: [0, 1, 2].map((i) => ({ time: now + i * 5 * MINUTE, mmPerHour: v })) });
  it('uses the nowcast text when it rains but the code is dry', () => {
    expect(heroDescription(current, nc(0.8), now)).toBe('Lichte regen');
  });
  it('keeps the code text otherwise', () => {
    expect(heroDescription(current, nc(0), now)).toBe('Bewolkt');
    expect(heroDescription(current, null, now)).toBe('Bewolkt');
    expect(heroDescription({ ...current, code: 81, condition: 'showers' }, nc(2), now)).toBe('Buien');
  });
});

describe('Dutch formatting', () => {
  it('decimal comma and whole degrees', () => {
    expect(dec(3.14)).toBe('3,1');
    expect(tempLabel(11.6)).toBe('12°');
    expect(deg(-0.4)).toBe(0);
    expect(tempLabel(-0.4)).toBe('0°');
  });
  it('wind in 8 sectors', () => {
    expect(windDirection(0)).toBe('Noord');
    expect(windDirection(199)).toBe('Zuid');
    expect(windDirection(225)).toBe('Zuidwest');
    expect(windDirection(337.6)).toBe('Noord');
    expect(windDirection(-90)).toBe('West');
  });
  it('UV categories', () => {
    expect([0, 2.4, 3, 5, 6, 7, 8, 10, 11].map(uvLabel)).toEqual(['Laag', 'Laag', 'Matig', 'Matig', 'Hoog', 'Hoog', 'Zeer hoog', 'Zeer hoog', 'Extreem']);
  });
  it('long dates', () => {
    expect(longDate(fromZoned(2026, 10, 29, 0, 0, AMSTERDAM), AMSTERDAM)).toBe('Donderdag 29 oktober');
  });
});
