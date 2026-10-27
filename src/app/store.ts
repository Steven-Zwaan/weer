/**
 * Zustand store: locations, the cached forecasts and every refresh. Domain logic lives in
 * src/domain and fetching in src/api; this file only wires them to state and persistence.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import type { Forecast, Location, Nowcast, RainStep } from '@/domain/types';
import { addPlace as addTo, distanceKm, inBuienradarArea, movePlace as moveIn, removePlace as removeFrom, roundCoord } from '@/domain/locations';
import { MINUTE } from '@/domain/time';
import { fetchForecast } from '@/api/openmeteo';
import { fetchBuienradar, nowcastFromMinutely } from '@/api/buienradar';
import { fetchRadarPast } from '@/api/knmi';
import { reverseName } from '@/api/pdok';
import { isOffline } from '@/api/http';
import { persist, type CacheEntry } from './persist';
import { currentPosition } from './platform';

export const FRESH_MS = 2 * MINUTE; // newer data is not fetched again (§8)
export const GPS_NAME = 'Mijn locatie';

export interface Entry {
  forecast: Forecast | null;
  nowcast: Nowcast | null;
  loading: boolean;
  error: 'offline' | 'failed' | null; // of the last forecast attempt
}

export interface RadarData {
  past: RainStep[];
  fetchedAt: number;
}

export type GpsStatus = 'pending' | 'ok' | 'denied' | 'unavailable';

export interface WeerStore {
  ready: boolean;
  saved: Location[];
  gps: Location | null;
  gpsStatus: GpsStatus;
  activeIndex: number;
  entries: Record<string, Entry>;
  radar: Record<string, RadarData>;

  boot(): void;
  locate(): Promise<void>;
  refresh(opts?: { force?: boolean; only?: string[] }): Promise<void>;
  refreshRadar(loc: Location): Promise<void>;
  setActive(index: number): void;
  addPlace(loc: Location): void;
  removePlace(id: string): void;
  movePlace(from: number, to: number): void;
}

const EMPTY: Entry = { forecast: null, nowcast: null, loading: false, error: null };

export const allLocations = (s: Pick<WeerStore, 'gps' | 'saved'>): Location[] => (s.gps ? [s.gps, ...s.saved] : s.saved);

const clamp = (i: number, n: number) => Math.max(0, Math.min(Math.max(0, n - 1), i));

const inflight = new Map<string, Promise<void>>();
let lastLocate = 0;
let cacheTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<WeerStore>()((set, get) => {
  const patch = (id: string, p: Partial<Entry>) => set((s) => ({ entries: { ...s.entries, [id]: { ...(s.entries[id] ?? EMPTY), ...p } } }));

  /** Write the shown data of every current location to localStorage, debounced. */
  const saveCache = () => {
    if (cacheTimer) clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => {
      const s = get();
      const out: Record<string, CacheEntry> = {};
      for (const l of allLocations(s)) {
        const e = s.entries[l.id];
        if (e?.forecast || e?.nowcast) out[l.id] = { forecast: e.forecast, nowcast: e.nowcast };
      }
      persist.saveCache(out);
    }, 400);
  };

  const setActiveById = (id: string | undefined) => {
    const list = allLocations(get());
    const i = id ? list.findIndex((l) => l.id === id) : -1;
    const index = clamp(i >= 0 ? i : get().activeIndex, list.length);
    set({ activeIndex: index });
    persist.saveActiveIndex(index);
  };

  async function refreshLocation(loc: Location, force: boolean): Promise<void> {
    const e = get().entries[loc.id];
    const now = Date.now();
    const moved = !!e?.forecast && distanceKm(e.forecast, loc) > 1;
    const fresh = !!e?.forecast && !!e.nowcast && now - e.forecast.fetchedAt < FRESH_MS && now - e.nowcast.fetchedAt < FRESH_MS;
    if (!force && fresh && !moved) return;
    const running = inflight.get(loc.id);
    if (running) return running;

    const job = (async () => {
      patch(loc.id, { loading: true });
      // Forecast and nowcast are fetched side by side; neither waits for the other (§8).
      const forecastJob = fetchForecast(loc).then(
        (forecast) => {
          patch(loc.id, { forecast, error: null });
          return forecast;
        },
        (err: unknown) => {
          patch(loc.id, { error: isOffline(err) ? 'offline' : 'failed' });
          return null;
        },
      );
      const nowcastJob = (async () => {
        if (inBuienradarArea(loc.lat, loc.lon)) {
          try {
            patch(loc.id, { nowcast: await fetchBuienradar(loc.lat, loc.lon) });
            return;
          } catch {
            // out of range (404), blocked or down: fall back to Open-Meteo below
          }
        }
        const forecast = await forecastJob;
        const fallback = forecast ? nowcastFromMinutely(forecast.minutely, forecast.fetchedAt, Date.now()) : null;
        if (fallback) patch(loc.id, { nowcast: fallback });
      })();
      await Promise.all([forecastJob, nowcastJob]);
      patch(loc.id, { loading: false });
      saveCache();
    })().finally(() => inflight.delete(loc.id));
    inflight.set(loc.id, job);
    return job;
  }

  return {
    ready: false,
    saved: [],
    gps: null,
    gpsStatus: 'pending',
    activeIndex: 0,
    entries: {},
    radar: {},

    boot() {
      if (get().ready) return;
      const saved = persist.loadLocations();
      const gps = persist.loadGps();
      const cache = persist.loadCache();
      const entries: Record<string, Entry> = {};
      for (const l of allLocations({ gps, saved })) {
        const c = cache[l.id];
        if (c) entries[l.id] = { ...EMPTY, forecast: c.forecast ?? null, nowcast: c.nowcast ?? null };
      }
      const activeIndex = clamp(persist.loadActiveIndex(), allLocations({ gps, saved }).length);
      // Cached data first, then refresh (§8).
      set({ ready: true, saved, gps, entries, activeIndex });
      void get().refresh();
      void get().locate();
    },

    async locate() {
      lastLocate = Date.now();
      const res = await currentPosition();
      const prev = get().gps;
      if (!res.ok) {
        if (res.reason === 'denied') {
          // No error message: the GPS location is simply not part of the list (§2.4).
          const activeId = allLocations(get())[get().activeIndex]?.id;
          set({ gps: null, gpsStatus: 'denied' });
          persist.saveGps(null);
          setActiveById(activeId === 'gps' ? undefined : activeId);
        } else {
          set({ gpsStatus: prev ? 'ok' : 'unavailable' });
        }
        return;
      }
      const pos = { lat: roundCoord(res.position.lat, 3), lon: roundCoord(res.position.lon, 3) };
      const sameSpot = prev !== null && distanceKm(prev, pos) < 1;
      const gps: Location = prev && sameSpot ? { ...prev, ...pos } : { id: 'gps', name: GPS_NAME, lat: pos.lat, lon: pos.lon, isGps: true };
      set({ gps, gpsStatus: 'ok' });
      persist.saveGps(gps);
      void refreshLocation(gps, !sameSpot);
      if ((!sameSpot || gps.name === GPS_NAME) && inBuienradarArea(pos.lat, pos.lon)) {
        try {
          const named = await reverseName(pos.lat, pos.lon);
          const cur = get().gps;
          if (named && cur && distanceKm(cur, pos) < 1) {
            const next = { ...cur, name: named.name, admin: named.admin };
            set({ gps: next });
            persist.saveGps(next);
          }
        } catch {
          /* keep "Mijn locatie" */
        }
      }
    },

    async refresh({ force = false, only } = {}) {
      const list = allLocations(get()).filter((l) => !only || only.includes(l.id));
      // The location on screen first; the others right behind it.
      const active = allLocations(get())[get().activeIndex];
      list.sort((a, b) => (a.id === active?.id ? -1 : b.id === active?.id ? 1 : 0));
      await Promise.all(list.map((l) => refreshLocation(l, force)));
      if (get().gps && Date.now() - lastLocate > 10 * MINUTE) void get().locate();
    },

    async refreshRadar(loc) {
      try {
        const past = await fetchRadarPast(loc.lat, loc.lon);
        set((s) => ({ radar: { ...s.radar, [loc.id]: { past, fetchedAt: Date.now() } } }));
      } catch {
        /* the timeline falls back to the nowcast alone */
      }
    },

    setActive(index) {
      const i = clamp(index, allLocations(get()).length);
      set({ activeIndex: i });
      persist.saveActiveIndex(i);
    },

    addPlace(loc) {
      const { list, index } = addTo(get().saved, loc);
      set({ saved: list });
      persist.saveLocations(list);
      get().setActive(index + (get().gps ? 1 : 0));
      void refreshLocation(list[index], false);
    },

    removePlace(id) {
      const activeId = allLocations(get())[get().activeIndex]?.id;
      const saved = removeFrom(get().saved, id);
      const entries = { ...get().entries };
      delete entries[id];
      set({ saved, entries });
      persist.saveLocations(saved);
      setActiveById(activeId === id ? undefined : activeId);
      saveCache();
    },

    movePlace(from, to) {
      const activeId = allLocations(get())[get().activeIndex]?.id;
      const saved = moveIn(get().saved, from, to);
      set({ saved });
      persist.saveLocations(saved);
      setActiveById(activeId);
    },
  };
});

/** All locations, GPS first: memoised so components do not re-render on every store change. */
export function useLocations(): Location[] {
  const gps = useStore((s) => s.gps);
  const saved = useStore((s) => s.saved);
  return useMemo(() => allLocations({ gps, saved }), [gps, saved]);
}

export function useActive(): { location: Location | null; entry: Entry; index: number; count: number } {
  const locations = useLocations();
  const index = useStore((s) => s.activeIndex);
  const location = locations[index] ?? null;
  const entry = useStore((s) => (location ? s.entries[location.id] : undefined)) ?? EMPTY;
  return { location, entry, index, count: locations.length };
}

export const emptyEntry = EMPTY;
