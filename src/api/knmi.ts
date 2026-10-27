/**
 * KNMI radar (SPEC §6.3): the public ADAGUC WMS of KNMI, no key, CORS open, a frame every
 * 5 minutes (RAD_NL25_PCP_CM, 1 km, mm/h). Images come straight from the WMS as Leaflet
 * tiles; GetFeatureInfo over a time range gives the frames that exist and the rate at the
 * location in each of them, in one request.
 */
import type { RainStep } from '@/domain/types';
import { roundRate } from '@/domain/rain';
import { roundCoord } from '@/domain/locations';
import { MINUTE, floorTo } from '@/domain/time';
import { wmsTime } from '@/domain/radar';
import { getJson } from './http';

export const KNMI_WMS = 'https://geoservices.knmi.nl/adagucserver';
export const RADAR_DATASET = 'RADAR';
export const RADAR_LAYER = 'RAD_NL25_PCP_CM';
export const RADAR_STYLE = 'precip-blue-transparent/nearest';

type FeatureInfo = { data?: Record<string, string | number | null> }[];

export function parseFeatureInfo(json: FeatureInfo): RainStep[] {
  const data = json[0]?.data ?? {};
  return Object.entries(data)
    .map(([time, v]) => ({ time: Date.parse(time), mmPerHour: roundRate(Number(v)) }))
    .filter((s) => Number.isFinite(s.time))
    .sort((a, b) => a.time - b.time);
}

/** The frames of the last ~70 minutes with the rate at (lat, lon). */
export async function fetchRadarPast(lat: number, lon: number, signal?: AbortSignal, now = Date.now()): Promise<RainStep[]> {
  const end = floorTo(now, 5);
  const start = end - 70 * MINUTE;
  const la = roundCoord(lat, 3);
  const lo = roundCoord(lon, 3);
  const q = new URLSearchParams({
    dataset: RADAR_DATASET,
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetFeatureInfo',
    LAYERS: RADAR_LAYER,
    QUERY_LAYERS: RADAR_LAYER,
    CRS: 'EPSG:4326',
    BBOX: `${la - 0.01},${lo - 0.01},${la + 0.01},${lo + 0.01}`,
    WIDTH: '3',
    HEIGHT: '3',
    I: '1',
    J: '1',
    INFO_FORMAT: 'application/json',
    TIME: `${wmsTime(start)}/${wmsTime(end)}`,
  });
  return parseFeatureInfo(await getJson<FeatureInfo>(`${KNMI_WMS}?${q}`, { signal, timeoutMs: 10_000 }));
}
