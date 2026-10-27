/**
 * Place search (SPEC §6.4): Open-Meteo Geocoding, no key, CORS open.
 *   GET https://geocoding-api.open-meteo.com/v1/search?name=utrecht&count=8&language=nl
 */
import type { Location } from '@/domain/types';
import { fromGeocode, sortPlaces, type GeocodeResult } from '@/domain/locations';
import { getJson } from './http';

export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** Towns and regions only: no airfields, stations or other features that share a name. */
const isPlace = (r: GeocodeResult) => !r.feature_code || /^(PPL|ADM)/.test(r.feature_code);

export function parsePlaces(json: { results?: GeocodeResult[] }): Location[] {
  return sortPlaces((json.results ?? []).filter((r) => isPlace(r) && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)).map(fromGeocode));
}

/** The geocoder knows 4-digit postcodes but not "3511 AB": search a Dutch postcode by its digits. */
export function searchTerm(query: string): string {
  const q = query.trim();
  const postcode = /^(\d{4})\s*[a-z]{2}$/i.exec(q);
  return postcode ? postcode[1] : q;
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Location[]> {
  const q = new URLSearchParams({ name: searchTerm(query), count: '8', language: 'nl', format: 'json' });
  return parsePlaces(await getJson<{ results?: GeocodeResult[] }>(`${GEOCODING_URL}?${q}`, { signal, timeoutMs: 8_000 }));
}
