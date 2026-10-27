/**
 * Saved places: add, remove, reorder and present them. The GPS location is never part of
 * the saved list; it is put in front of it when the user allows location access (§2.4).
 */
import type { Location } from './types';

export interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  feature_code?: string;
}

export function fromGeocode(r: GeocodeResult): Location {
  return {
    id: `om-${r.id}`,
    name: r.name,
    admin: r.admin1,
    country: r.country,
    countryCode: r.country_code,
    lat: r.latitude,
    lon: r.longitude,
    isGps: false,
  };
}

const PRIORITY: Record<string, number> = { NL: 0, BE: 1 };

/** Netherlands first, then Belgium, the rest in the geocoder's own (population) order. */
export function sortPlaces(places: Location[]): Location[] {
  return places
    .map((p, i) => ({ p, i, rank: PRIORITY[p.countryCode ?? ''] ?? 2 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.p);
}

/** "Utrecht, Utrecht · Nederland". */
export function placeLine(p: Location): string {
  const head = p.admin ? `${p.name}, ${p.admin}` : p.name;
  return p.country ? `${head} · ${p.country}` : head;
}

function samePlace(a: Location, b: Location): boolean {
  return a.id === b.id || (Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01);
}

/** Add a place (or find it when it is already saved). Returns the list and the place's index in it. */
export function addPlace(list: Location[], place: Location): { list: Location[]; index: number } {
  const existing = list.findIndex((l) => samePlace(l, place));
  if (existing >= 0) return { list, index: existing };
  return { list: [...list, place], index: list.length };
}

export function removePlace(list: Location[], id: string): Location[] {
  return list.filter((l) => l.id !== id);
}

export function movePlace(list: Location[], from: number, to: number): Location[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Coordinates leave the device rounded (about 1 km at 2 decimals): cacheable and private (§6.5). */
export function roundCoord(v: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Rough NL/BE box: inside it Buienradar has a 5-minute nowcast, outside it returns 404. */
export function inBuienradarArea(lat: number, lon: number): boolean {
  return lat >= 49.4 && lat <= 53.7 && lon >= 2.4 && lon <= 7.3;
}
