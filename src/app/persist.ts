/**
 * localStorage persistence (SPEC §8). Every access is guarded: private mode, a full quota or
 * cleared site data must never break the app, it just starts without a cache.
 */
import type { Forecast, Location, Nowcast } from '@/domain/types';

export const KEYS = {
  locations: 'weer.locations', // Location[] without the GPS location
  activeIndex: 'weer.activeIndex', // index into [gps?, ...locations]
  gps: 'weer.gps', // the last GPS location, so its cache shows before the next fix
  cache: 'weer.cache.v1', // Record<locationId, CacheEntry>
  radarExpanded: 'weer.radarExpanded', // the radar's chart sheet was left large
} as const;

export interface CacheEntry {
  forecast: Forecast | null;
  nowcast: Nowcast | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or blocked storage: the app keeps working from memory */
  }
}

const isLocation = (l: unknown): l is Location =>
  typeof l === 'object' && l !== null && typeof (l as Location).id === 'string' && Number.isFinite((l as Location).lat) && Number.isFinite((l as Location).lon);

export const persist = {
  loadLocations: (): Location[] => {
    const list = read<unknown>(KEYS.locations, []);
    return Array.isArray(list) ? list.filter(isLocation).map((l) => ({ ...l, isGps: false })) : [];
  },
  saveLocations: (list: Location[]) => write(KEYS.locations, list),
  loadActiveIndex: (): number => {
    const i = read<unknown>(KEYS.activeIndex, 0);
    return typeof i === 'number' && Number.isInteger(i) && i >= 0 ? i : 0;
  },
  saveActiveIndex: (i: number) => write(KEYS.activeIndex, i),
  loadGps: (): Location | null => {
    const g = read<unknown>(KEYS.gps, null);
    return isLocation(g) ? { ...g, id: 'gps', isGps: true } : null;
  },
  saveGps: (g: Location | null) => write(KEYS.gps, g),
  loadCache: (): Record<string, CacheEntry> => {
    const c = read<unknown>(KEYS.cache, {});
    return typeof c === 'object' && c !== null ? (c as Record<string, CacheEntry>) : {};
  },
  saveCache: (c: Record<string, CacheEntry>) => write(KEYS.cache, c),
  loadRadarExpanded: (): boolean => read<unknown>(KEYS.radarExpanded, false) === true,
  saveRadarExpanded: (v: boolean) => write(KEYS.radarExpanded, v),
};
