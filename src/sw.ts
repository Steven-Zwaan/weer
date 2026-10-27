/// <reference lib="webworker" />
/**
 * Service worker (SPEC §9). Precache the app shell so a cold start works offline; map and
 * radar tiles from a limited cache. Weather API answers are deliberately not cached here:
 * the app keeps the last answer per location in localStorage and knows how old it is. A
 * network-first fallback in this worker would hand the app an old answer that looks fresh
 * (no offline notice, a wrong "Bijgewerkt" time).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }));

const ok = new CacheableResponsePlugin({ statuses: [200] });

// OpenStreetMap tiles: light use, at most 200 tiles kept (§6.3, §9).
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org',
  new StaleWhileRevalidate({ cacheName: 'weer-osm', plugins: [ok, new ExpirationPlugin({ maxEntries: 200, purgeOnQuotaError: true })] }),
);

// KNMI radar: an image for a given TIME never changes; keep the last few hours.
registerRoute(
  ({ url }) => url.hostname === 'geoservices.knmi.nl' && /getmap/i.test(url.searchParams.get('REQUEST') ?? url.searchParams.get('request') ?? ''),
  new CacheFirst({ cacheName: 'weer-radar', plugins: [ok, new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 3 * 3600, purgeOnQuotaError: true })] }),
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
