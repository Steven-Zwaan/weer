import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { forecastUrl, needsSupplement, parseForecast, type OMResponse } from '@/api/openmeteo';
import { parsePlaces, searchTerm } from '@/api/geocoding';
import { parseReverse } from '@/api/pdok';
import { AMSTERDAM, hhmm } from '@/domain/time';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// Real answers recorded on 27 October 2026 for Utrecht.
const OM: OMResponse = load('open-meteo-utrecht.json');
const FETCHED = Date.UTC(2026, 9, 27, 14, 3);

describe('Open-Meteo forecast (§6.2)', () => {
  const f = parseForecast(OM, 'om-2745912', 52.09, 5.12, FETCHED);

  it('asks for knmi_seamless, unixtime, 10 days and minutely_15', () => {
    const url = forecastUrl(52.0907, 5.1214);
    expect(url).toContain('models=knmi_seamless');
    expect(url).toContain('timeformat=unixtime');
    expect(url).toContain('forecast_days=10');
    expect(url).toContain('minutely_15=precipitation');
    expect(url).toContain('latitude=52.09&longitude=5.12'); // rounded to 2 decimals
  });

  it('normalises current conditions', () => {
    expect(f.timezone).toBe('Europe/Amsterdam');
    expect(f.current.temp).toBe(15.5);
    expect(f.current.condition).toBe('cloudy');
    expect(f.current.isDay).toBe(true);
    expect(f.current.uv).toBe(0.3);
  });

  it('has 240 hours and 10 days of 24 local hours each', () => {
    expect(f.hours).toHaveLength(240);
    expect(f.days).toHaveLength(10);
    expect(f.days.every((d) => d.hours.length === 24)).toBe(true);
    expect(f.days[0].key).toBe('2026-10-27');
    expect(hhmm(f.days[0].hours[0].time, AMSTERDAM)).toBe('00:00');
  });

  it('keeps daily values and real sun times', () => {
    const d = f.days[0];
    expect(d.max).toBe(15.9);
    expect(d.precipProb).toBe(100);
    expect(hhmm(d.sunrise!, AMSTERDAM)).toBe('07:25');
    expect(hhmm(d.sunset!, AMSTERDAM)).toBe('17:20');
  });

  it('turns minutely_15 (mm per 15 min) into mm/h', () => {
    expect(f.minutely).toHaveLength(12);
    expect(f.minutely[1].mmPerHour).toBe(0.4);
  });

  it('never invents a missing value', () => {
    const gap: OMResponse = structuredClone(OM);
    gap.daily!.precipitation_probability_max = gap.daily!.precipitation_probability_max.map(() => null);
    gap.hourly!.temperature_2m[5] = null;
    const g = parseForecast(gap, 'x', 52, 5, FETCHED);
    expect(g.days.every((d) => d.precipProb === null)).toBe(true);
    expect(g.hours).toHaveLength(239);
    expect(needsSupplement(gap)).toBe(true);
    expect(needsSupplement(OM)).toBe(false);
  });

  it('fills missing variables from the supplement request', () => {
    const gap: OMResponse = structuredClone(OM);
    gap.daily!.precipitation_probability_max = gap.daily!.precipitation_probability_max.map(() => null);
    const supplement: OMResponse = { timezone: 'Europe/Amsterdam', daily: { time: OM.daily!.time, precipitation_probability_max: OM.daily!.time.map(() => 42) } };
    expect(parseForecast(gap, 'x', 52, 5, FETCHED, supplement).days[0].precipProb).toBe(42);
  });
});

describe('geocoding (§6.4)', () => {
  it('lists places with the Netherlands first', () => {
    const places = parsePlaces(load('geocoding-utrecht.json'));
    expect(places[0]).toMatchObject({ id: 'om-2745912', name: 'Utrecht', admin: 'Utrecht', country: 'Nederland', countryCode: 'NL', isGps: false });
    expect(places.length).toBeGreaterThan(1);
  });
  it('an empty answer has no results key', () => {
    expect(parsePlaces({})).toEqual([]);
  });
  it('drops features that are not towns (the recorded answer has an airfield)', () => {
    const places = parsePlaces(load('geocoding-utrecht.json'));
    expect(places.map((p) => p.id)).not.toContain('om-945817');
  });
  it('searches a Dutch postcode by its four digits', () => {
    expect(searchTerm('3511 AB')).toBe('3511');
    expect(searchTerm('3511ab')).toBe('3511');
    expect(searchTerm(' Utrecht ')).toBe('Utrecht');
  });
});

describe('PDOK reverse geocoding', () => {
  it('names the town', () => {
    expect(parseReverse(load('pdok-reverse-utrecht.json'))).toEqual({ name: 'Utrecht', admin: 'Utrecht' });
    expect(parseReverse({ response: { docs: [] } })).toBeNull();
  });
});
