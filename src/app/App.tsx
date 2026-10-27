import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLocations, useStore } from './store';
import { useAutoRefresh } from './hooks';
import { navigate, useRoute } from './router';
import { Today } from '@/screens/Today';
import { DayDetail } from '@/screens/DayDetail';
import { Locations } from '@/screens/Locations';

// Leaflet only loads when the radar is opened.
const Radar = lazy(() => import('@/screens/Radar'));

function UpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true });
  const [need] = needRefresh;
  const [dismissed, setDismissed] = useState(false);
  if (!need || dismissed) return null;
  return (
    <div className="toast" role="status">
      Nieuwe versie beschikbaar
      <button
        type="button"
        onClick={() => {
          void updateServiceWorker(true);
          // On a first visit the page has no controlling worker, so the new one is active already
          // and no reload follows from the worker: reload ourselves.
          window.setTimeout(() => window.location.reload(), 1500);
        }}
      >
        Vernieuw
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Later" style={{ background: 'transparent', padding: '0 6px' }}>
        ✕
      </button>
    </div>
  );
}

export function App() {
  const ready = useStore((s) => s.ready);
  const boot = useStore((s) => s.boot);
  const gpsStatus = useStore((s) => s.gpsStatus);
  const locations = useLocations();
  const route = useRoute();
  useAutoRefresh();

  useEffect(() => boot(), [boot]);

  // First start without location access and without saved places: open Locaties on the search (§8).
  useEffect(() => {
    if (ready && locations.length === 0 && gpsStatus !== 'pending' && route.name !== 'locations') navigate({ name: 'locations', focus: true }, { replace: true });
  }, [ready, locations.length, gpsStatus, route.name]);

  // Every screen starts at the top.
  const lastRoute = useRef(route.name);
  useEffect(() => {
    if (lastRoute.current !== route.name) window.scrollTo(0, 0);
    lastRoute.current = route.name;
  }, [route.name]);

  if (!ready) return null;

  let screen: React.ReactNode;
  switch (route.name) {
    case 'radar':
      screen = (
        <Suspense fallback={<main className="screen sub" />}>
          <Radar />
        </Suspense>
      );
      break;
    case 'day':
      screen = <DayDetail index={route.index} />;
      break;
    case 'locations':
      screen = <Locations focus={route.focus} />;
      break;
    default:
      screen = <Today />;
  }
  return (
    <>
      {screen}
      <UpdatePrompt />
    </>
  );
}
