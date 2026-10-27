/**
 * Browser APIs behind one small surface. Every call degrades silently; in a Swift port this
 * file becomes CoreLocation and friends.
 */

export interface Position {
  lat: number;
  lon: number;
}

export type GeoResult = { ok: true; position: Position } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * One location fix. `maximumAge` lets the OS answer from a position it already has, which
 * is close to instant; a low-accuracy fix (cell/wifi) is plenty for weather and much faster
 * than waiting for GPS.
 */
export function currentPosition({ maximumAge, timeoutMs }: { maximumAge: number; timeoutMs: number }): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve({ ok: false, reason: 'unavailable' });
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ ok: true, position: { lat: p.coords.latitude, lon: p.coords.longitude } }),
        (e) => resolve({ ok: false, reason: e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge },
      );
    } catch {
      resolve({ ok: false, reason: 'unavailable' });
    }
  });
}

/** Call `cb` when location access becomes granted (e.g. changed in Settings while the app is open). */
export function onLocationGranted(cb: () => void): void {
  try {
    void navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        status.addEventListener('change', () => {
          if (status.state === 'granted') cb();
        });
      })
      .catch(() => undefined);
  } catch {
    /* no Permissions API: the next launch picks it up */
  }
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
