/**
 * Open-Meteo forecast (SPEC §6.2): current conditions, 240 hours and 10 days from the
 * `knmi_seamless` model (KNMI Harmonie for about 2.5 days, then ECMWF). No key, CORS open.
 *
 * `timeformat=unixtime` returns epoch seconds, so no local-time strings have to be parsed
 * across a DST switch; `timezone=auto` makes the daily boundaries those of the place itself.
 */
import type { Current, Day, Forecast, Hour, Location, RainStep } from '@/domain/types';
import { conditionOf } from '@/domain/weather';
import { roundRate } from '@/domain/rain';
import { roundCoord } from '@/domain/locations';
import { dayKey } from '@/domain/time';
import { getJson } from './http';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const MODEL = 'knmi_seamless';

const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,uv_index';
const HOURLY = 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day,uv_index';
const DAILY =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant';

type Series = (number | null)[];

export interface OMResponse {
  timezone: string;
  current?: Record<string, number | null> & { time: number };
  hourly?: { time: number[] } & Record<string, Series>;
  daily?: { time: number[] } & Record<string, Series>;
  minutely_15?: { time: number[]; precipitation: Series };
}

export function forecastUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    models: MODEL,
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '10',
    forecast_minutely_15: '12',
    current: CURRENT,
    hourly: HOURLY,
    daily: DAILY,
    minutely_15: 'precipitation',
  });
  return `${FORECAST_URL}?${q.toString().replace(/%2C/g, ',')}`;
}

/** Same place without `models`: Open-Meteo picks a model that has the variables KNMI lacks (§6.2). */
export function supplementUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '10',
    hourly: 'uv_index',
    daily: 'precipitation_probability_max,uv_index_max',
  });
  return `${FORECAST_URL}?${q.toString().replace(/%2C/g, ',')}`;
}

const num = (v: number | null | undefined, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const opt = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ms = (s: number) => s * 1000;

export function parseForecast(json: OMResponse, locationId: string, lat: number, lon: number, fetchedAt: number, supplement?: OMResponse): Forecast {
  const tz = json.timezone || 'Europe/Amsterdam';
  const h = json.hourly;
  const d = json.daily;
  const c = json.current;
  if (!h || !d || !c) throw new Error('Open-Meteo: response without current, hourly or daily');

  const extraUv = new Map<number, number | null>();
  supplement?.hourly?.time.forEach((t, i) => extraUv.set(t, opt(supplement.hourly?.uv_index?.[i])));

  const hours: Hour[] = [];
  h.time.forEach((t, i) => {
    const temp = opt(h.temperature_2m?.[i]);
    if (temp === null) return; // a model gap: skip the hour rather than draw a fake value
    const code = num(h.weather_code?.[i], 3);
    hours.push({
      time: ms(t),
      temp,
      precipMm: roundRate(num(h.precipitation?.[i])),
      code,
      condition: conditionOf(code),
      isDay: num(h.is_day?.[i], 1) === 1,
      windKmh: num(h.wind_speed_10m?.[i]),
      windDirDeg: num(h.wind_direction_10m?.[i]),
      uv: opt(h.uv_index?.[i]) ?? extraUv.get(t) ?? null,
    });
  });

  const extraProb = supplement?.daily?.precipitation_probability_max;
  const extraUvMax = supplement?.daily?.uv_index_max;
  const days: Day[] = [];
  d.time.forEach((t, i) => {
    const min = opt(d.temperature_2m_min?.[i]);
    const max = opt(d.temperature_2m_max?.[i]);
    if (min === null || max === null) return;
    const key = dayKey(ms(t), tz);
    const code = num(d.weather_code?.[i], 3);
    const sunrise = opt(d.sunrise?.[i]);
    const sunset = opt(d.sunset?.[i]);
    days.push({
      date: ms(t),
      key,
      min,
      max,
      code,
      condition: conditionOf(code),
      precipSumMm: Math.round(num(d.precipitation_sum?.[i]) * 10) / 10,
      precipProb: opt(d.precipitation_probability_max?.[i]) ?? opt(extraProb?.[i]),
      sunrise: sunrise === null ? null : ms(sunrise),
      sunset: sunset === null ? null : ms(sunset),
      uvMax: opt(d.uv_index_max?.[i]) ?? opt(extraUvMax?.[i]),
      windMaxKmh: num(d.wind_speed_10m_max?.[i]),
      gustMaxKmh: num(d.wind_gusts_10m_max?.[i]),
      windDirDeg: num(d.wind_direction_10m_dominant?.[i]),
      hours: hours.filter((hr) => dayKey(hr.time, tz) === key),
    });
  });

  const code = num(c.weather_code, 3);
  const current: Current = {
    time: ms(c.time),
    temp: num(c.temperature_2m),
    feelsLike: num(c.apparent_temperature, num(c.temperature_2m)),
    humidity: num(c.relative_humidity_2m),
    dewPoint: num(c.dew_point_2m),
    windKmh: num(c.wind_speed_10m),
    gustKmh: num(c.wind_gusts_10m),
    windDirDeg: num(c.wind_direction_10m),
    uv: opt(c.uv_index),
    code,
    condition: conditionOf(code),
    isDay: num(c.is_day, 1) === 1,
  };

  const m = json.minutely_15;
  const minutely: RainStep[] = m ? m.time.map((t, i) => ({ time: ms(t), mmPerHour: roundRate(num(m.precipitation[i]) * 4) })) : [];

  return { locationId, lat, lon, timezone: tz, current, hours, days, minutely, fetchedAt };
}

/** True when the KNMI model left the rain chance or UV empty for every day. */
export function needsSupplement(json: OMResponse): boolean {
  const empty = (s?: Series) => !s || s.every((v) => v === null);
  return empty(json.daily?.precipitation_probability_max) || empty(json.daily?.uv_index_max);
}

export async function fetchForecast(loc: Location, signal?: AbortSignal, now = Date.now()): Promise<Forecast> {
  const json = await getJson<OMResponse>(forecastUrl(loc.lat, loc.lon), { signal });
  let supplement: OMResponse | undefined;
  if (needsSupplement(json)) {
    try {
      supplement = await getJson<OMResponse>(supplementUrl(loc.lat, loc.lon), { signal });
    } catch {
      supplement = undefined; // the fields stay hidden
    }
  }
  return parseForecast(json, loc.id, loc.lat, loc.lon, now, supplement);
}
