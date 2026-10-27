/**
 * The normalised data model (SPEC §7). Components only ever see these shapes, never a raw
 * API response. Every timestamp is epoch milliseconds so the whole model survives
 * JSON.stringify (the cache) and maps 1:1 onto Codable structs in a Swift port.
 */

export type Condition = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'thunder';

export interface Location {
  id: string; // 'gps' for the device location, 'om-<geonames id>' for a saved place
  name: string;
  admin?: string; // province / state
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
  isGps: boolean;
}

export interface RainStep {
  time: number;
  mmPerHour: number;
}

/** Precipitation for the next 2 hours: Buienradar (5 min) or the Open-Meteo fallback (15 min). */
export interface Nowcast {
  source: 'buienradar' | 'open-meteo';
  stepMinutes: 5 | 15;
  steps: RainStep[];
  fetchedAt: number;
}

export interface Current {
  time: number;
  temp: number;
  feelsLike: number;
  humidity: number;
  dewPoint: number;
  windKmh: number;
  gustKmh: number;
  windDirDeg: number;
  uv: number | null;
  condition: Condition;
  code: number;
  isDay: boolean;
}

export interface Hour {
  time: number;
  temp: number;
  precipMm: number; // sum over the hour
  condition: Condition;
  code: number;
  isDay: boolean;
  windKmh: number;
  windDirDeg: number;
  uv: number | null;
}

export interface Day {
  date: number; // local midnight
  key: string; // YYYY-MM-DD in the forecast's time zone
  min: number;
  max: number;
  condition: Condition;
  code: number;
  precipSumMm: number;
  precipProb: number | null; // never invented: null hides the field
  sunrise: number | null;
  sunset: number | null;
  uvMax: number | null;
  windMaxKmh: number;
  gustMaxKmh: number;
  windDirDeg: number;
  hours: Hour[]; // the hours of that local day (23, 24 or 25)
}

export interface Forecast {
  locationId: string;
  lat: number;
  lon: number;
  timezone: string;
  current: Current;
  hours: Hour[];
  days: Day[];
  /** Open-Meteo minutely_15 precipitation in mm/h: the nowcast fallback outside NL/BE. */
  minutely: RainStep[];
  fetchedAt: number;
}

/** One position on the radar timeline: a nowcast step and the radar image for that moment. */
export interface RadarStep {
  time: number;
  mmPerHour: number | null; // at the location; null without a nowcast
  frame: number | null; // time of the radar image to show; null = no image for this moment
}
