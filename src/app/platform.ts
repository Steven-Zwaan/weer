/**
 * Browser APIs behind one small surface. Every call degrades silently; in a Swift port this
 * file becomes CoreLocation and friends.
 */

export interface Position {
  lat: number;
  lon: number;
}

export type GeoResult = { ok: true; position: Position } | { ok: false; reason: 'denied' | 'unavailable' };

/** One GPS fix (SPEC §8: timeout 8 s, maximumAge 10 min). */
export function currentPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ ok: false, reason: 'unavailable' });
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ ok: true, position: { lat: p.coords.latitude, lon: p.coords.longitude } }),
        (e) => resolve({ ok: false, reason: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: false, timeout: 8_000, maximumAge: 10 * 60_000 },
      );
    } catch {
      resolve({ ok: false, reason: 'unavailable' });
    }
  });
}

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
