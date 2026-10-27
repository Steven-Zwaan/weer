/**
 * Buienradar raintext proxy (SPEC §6.5) — a single Vercel Function, only a fallback.
 * Buienradar currently sends `Access-Control-Allow-Origin: *` and the app calls it directly;
 * this exists for the day that header disappears.
 *
 *   GET /api/rain?lat=52.09&lon=5.12  ->  the original text/plain answer and status
 *
 * Coordinates are rounded to 2 decimals (cacheable, about 1 km: private enough). Nothing is
 * logged. CORS only for the app's own origin and localhost.
 */

export const config = { maxDuration: 10 };

const UPSTREAM = 'https://gpsgadget.buienradar.nl/data/raintext';

function allowedOrigin(origin: string | null, host: string | null): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return origin;
    if (host && u.host === host) return origin;
  } catch {
    /* not a URL */
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  const origin = allowedOrigin(req.headers.get('origin'), req.headers.get('host'));
  const cors: Record<string, string> = origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return new Response('lat and lon are required', { status: 400, headers: { 'content-type': 'text/plain', ...cors } });
  }
  const q = `lat=${Math.round(lat * 100) / 100}&lon=${Math.round(lon * 100) / 100}`;
  try {
    const r = await fetch(`${UPSTREAM}?${q}`, { signal: AbortSignal.timeout(8000) });
    return new Response(await r.text(), {
      status: r.status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': r.ok ? 'public, max-age=120' : 'no-store', ...cors },
    });
  } catch {
    return new Response('upstream unavailable', { status: 502, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store', ...cors } });
  }
}
