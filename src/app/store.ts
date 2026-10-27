/**
 * Zustand store: locations, the cached forecasts and every refresh. Domain logic lives in
 * src/domain and fetching in src/api; this file only wires them to state and persistence.
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import type { Forecast, Location, Nowcast } from '@/domain/types';
import { addPlace as addTo, distanceKm, inBuienradarArea, movePlace as moveIn, removePlace as removeFrom, roundCoord } from '@/domain/locations';
import { MINUTE } from '@/domain/time';
import { fetchForecast } from '@/api/openmeteo';
import { fetchBuienradar, fetchRadarFrames, nowcastFromMinutely, type RadarFrame } from '@/api/buienradar';
import { reverseName } from '@/api/pdok';
import { isOffline } from '@/api/http';
import { persist, type CacheEntry } from './persist';
import { currentPosition, onLocationGranted } from './platform';

export const FRESH_MS = 2 * MINUTE; // newer data is not fetched again (§8)
export const GPS_NAME = 'Mijn locatie';

export interface Entry {
  forecast: Forecast | null;
  nowcast: Nowcast | null;
  loading: boolean;
  error: 'offline' | 'failed' | null; // of the last forecast attempt
}

/** Radar images cover all of NL/BE, so there is one list for every location. */
export interface RadarData {
  frames: RadarFrame[];
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
  radar: RadarData | null;

  boot(): void;
  locate(): Promise<void>;
  /** Show the GPS location and get a fresh fix (also what "Mijn locatie" on Locaties does). */
  showMyLocation(): void;
  /** The app is visible again after `awayMs` in the background. */
  resume(awayMs: number): void;
  refresh(opts?: { force?: boolean; only?: string[] }): Promise<void>;
  refreshRadar(): Promise<void>;
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
let locating: Promise<void> | null = null;
let cacheTimer: ReturnType<typeof setTimeout> | null = null;
/** The user chose a location this session (swipe, tap, add): a late GPS fix must not take over. */
let userPicked = false;
export const BACK_HOME_AFTER_MS = 5 * MINUTE; // away this long: open on my location again

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

  /** A location fix: update the GPS location, show it if the user has not picked another, fetch its weather. */
  function applyPosition(position: { lat: number; lon: number }): void {
    const prev = get().gps;
    const pos = { lat: roundCoord(position.lat, 3), lon: roundCoord(position.lon, 3) };
    const sameSpot = prev !== null && distanceKm(prev, pos) < 1;
    const gps: Location = prev && sameSpot ? { ...prev, ...pos } : { id: 'gps', name: GPS_NAME, lat: pos.lat, lon: pos.lon, isGps: true };
    const activeId = allLocations(get())[get().activeIndex]?.id;
    set({ gps, gpsStatus: 'ok' });
    persist.saveGps(gps);
    if (!prev) {
      // The GPS location just appeared in front of the list: jump to it, unless the user chose
      // another place meanwhile (then keep that one, now one position further).
      if (userPicked) setActiveById(activeId);
      else {
        set({ activeIndex: 0 });
        persist.saveActiveIndex(0);
      }
    }
    void refreshLocation(gps, !sameSpot);
    if ((!sameSpot || gps.name === GPS_NAME) && inBuienradarArea(pos.lat, pos.lon)) {
      reverseName(pos.lat, pos.lon).then(
        (named) => {
          const cur = get().gps;
          if (!named || !cur || distanceKm(cur, pos) >= 1) return;
          const next = { ...cur, name: named.name, admin: named.admin };
          set({ gps: next });
          persist.saveGps(next);
        },
        () => undefined, // keep "Mijn locatie"
      );
    }
  }

  /** Location access was refused: no error message, the GPS location just leaves the list (§2.4). */
  function dropGps(): void {
    const activeId = allLocations(get())[get().activeIndex]?.id;
    set({ gps: null, gpsStatus: 'denied' });
    persist.saveGps(null);
    setActiveById(activeId === 'gps' ? undefined : activeId);
  }

  return {
    ready: false,
    saved: [],
    gps: null,
    gpsStatus: 'pending',
    activeIndex: 0,
    entries: {},
    radar: null,

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
      // Open on my location whenever it is known: the last fix and its weather are cached, so it
      // is on screen at once, before any new fix. Without location access: the last one viewed.
      const activeIndex = gps ? 0 : clamp(persist.loadActiveIndex(), allLocations({ gps, saved }).length);
      // Cached data first, then refresh (§8).
      set({ ready: true, saved, gps, entries, activeIndex });
      void get().locate();
      void get().refresh();
      onLocationGranted(() => get().showMyLocation());
    },

    locate() {
      if (locating) return locating;
      lastLocate = Date.now();
      locating = (async () => {
        // Two steps: first whatever position the OS already has (close to instant), then a fresh
        // fix. Each one updates the location and its weather as soon as it arrives.
        const quick = await currentPosition({ maximumAge: 30 * MINUTE, timeoutMs: 3_000 });
        if (quick.ok) applyPosition(quick.position);
        else if (quick.reason === 'denied') return dropGps();
        const fresh = await currentPosition({ maximumAge: MINUTE, timeoutMs: 12_000 });
        if (fresh.ok) applyPosition(fresh.position);
        else if (fresh.reason === 'denied') dropGps();
        else if (!quick.ok) set({ gpsStatus: get().gps ? 'ok' : 'unavailable' });
      })().finally(() => (locating = null));
      return locating;
    },

    showMyLocation() {
      if (get().gps) {
        userPicked = false;
        set({ activeIndex: 0 });
        persist.saveActiveIndex(0);
      }
      void get().locate();
    },

    resume(awayMs) {
      if (awayMs >= BACK_HOME_AFTER_MS) get().showMyLocation();
      else if (Date.now() - lastLocate > 2 * MINUTE) void get().locate();
      void get().refresh(); // skips data younger than 2 minutes
    },

    async refresh({ force = false, only } = {}) {
      const list = allLocations(get()).filter((l) => !only || only.includes(l.id));
      // The location on screen first; the others right behind it.
      const active = allLocations(get())[get().activeIndex];
      list.sort((a, b) => (a.id === active?.id ? -1 : b.id === active?.id ? 1 : 0));
      await Promise.all(list.map((l) => refreshLocation(l, force)));
      if (get().gps && Date.now() - lastLocate > 10 * MINUTE) void get().locate();
    },

    async refreshRadar() {
      const r = get().radar;
      if (r && Date.now() - r.fetchedAt < FRESH_MS) return;
      try {
        set({ radar: { frames: await fetchRadarFrames(), fetchedAt: Date.now() } });
      } catch {
        /* keep the previous frames; the chart works without them */
      }
    },

    setActive(index) {
      userPicked = true;
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
