/**
 * Reverse geocoding for the GPS location (SPEC §8): Open-Meteo has none, so the free PDOK
 * Locatieserver of the Dutch government names the place. NL only; elsewhere the GPS
 * location stays "Mijn locatie".
 *   GET https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=..&lon=..&type=woonplaats&rows=1
 */
import { roundCoord } from '@/domain/locations';
import { getJson } from './http';

export const PDOK_REVERSE_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse';

interface PdokResponse {
  response?: { docs?: { woonplaatsnaam?: string; gemeentenaam?: string; provincienaam?: string }[] };
}

export function parseReverse(json: PdokResponse): { name: string; admin?: string } | null {
  const doc = json.response?.docs?.[0];
  const name = doc?.woonplaatsnaam ?? doc?.gemeentenaam;
  return name ? { name, admin: doc?.provincienaam } : null;
}

export async function reverseName(lat: number, lon: number, signal?: AbortSignal): Promise<{ name: string; admin?: string } | null> {
  const q = new URLSearchParams({
    lat: String(roundCoord(lat, 3)),
    lon: String(roundCoord(lon, 3)),
    type: 'woonplaats',
    rows: '1',
    fl: 'woonplaatsnaam,gemeentenaam,provincienaam',
  });
  return parseReverse(await getJson<PdokResponse>(`${PDOK_REVERSE_URL}?${q}`, { signal, timeoutMs: 6_000 }));
}
