/**
 * Vandaag (§2.1): hero, rain card, hours, 10 days and tiles for the active location.
 * Swiping sideways anywhere outside the charts and the hour strip switches location.
 */
import { useEffect, useRef, type TouchEvent } from 'react';
import { useActive, useStore } from '@/app/store';
import { useNow } from '@/app/hooks';
import { navigate } from '@/app/router';
import { AMSTERDAM, hhmm } from '@/domain/time';
import { HeroNow } from '@/ui/HeroNow';
import { RainCard } from '@/ui/RainCard';
import { HourStrip } from '@/ui/HourStrip';
import { DayList } from '@/ui/DayList';
import { DetailTiles } from '@/ui/DetailTiles';
import { PageDots, SourceLine } from '@/ui/TopBars';
import { IconList } from '@/ui/Icons';

function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (e.touches.length !== 1 || target.closest('[data-noswipe]')) {
        start.current = null;
        return;
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy) && Date.now() - s.t < 800) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

export function Today() {
  const { location, entry, index, count } = useActive();
  const gpsStatus = useStore((s) => s.gpsStatus);
  const setActive = useStore((s) => s.setActive);
  const refresh = useStore((s) => s.refresh);
  const now = useNow();
  const swipe = useSwipe((dir) => {
    const next = index + dir;
    if (next >= 0 && next < count) setActive(next);
  });

  // Arrow keys do what the swipe does (handy on a desktop browser).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight' && index + 1 < count) setActive(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) setActive(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, setActive]);

  const topbar = (
    <div className="topbar">
      <button type="button" className="pill" onClick={() => navigate({ name: 'locations' })}>
        <IconList />
        Locaties
      </button>
      {location && entry.forecast && (
        <button type="button" className="updated" onClick={() => void refresh({ force: true, only: [location.id] })} aria-label="Nu verversen">
          {entry.loading ? 'Bijwerken…' : `Bijgewerkt ${hhmm(entry.forecast.fetchedAt, AMSTERDAM)}`}
        </button>
      )}
    </div>
  );

  if (!location) {
    return (
      <main className="screen">
        {topbar}
        <div className="empty">
          {gpsStatus === 'pending' ? 'Je locatie wordt bepaald…' : 'Nog geen locatie.'}
          <button type="button" className="primary" onClick={() => navigate({ name: 'locations', focus: true })}>
            Kies een plaats
          </button>
        </div>
      </main>
    );
  }

  const f = entry.forecast;
  const tz = f?.timezone ?? AMSTERDAM;
  return (
    <main className="screen" {...swipe}>
      {topbar}
      <PageDots count={count} index={index} />
      {entry.error && f && (
        <div className="notice" role="status">
          {entry.error === 'offline' ? 'Offline' : 'Bijwerken lukt niet'} · gegevens van {hhmm(f.fetchedAt, AMSTERDAM)}
        </div>
      )}
      <HeroNow location={location} forecast={f} nowcast={entry.nowcast} now={now} />
      <RainCard nowcast={entry.nowcast} tz={tz} now={now} />
      {f ? (
        <>
          <HourStrip forecast={f} now={now} />
          <DayList forecast={f} />
          <DetailTiles forecast={f} now={now} />
        </>
      ) : (
        entry.error && (
          <div className="empty card">
            {entry.error === 'offline' ? 'Je bent offline en er zijn nog geen gegevens voor deze plaats.' : 'Het weer kon niet worden opgehaald.'}
            <button type="button" className="primary" onClick={() => void refresh({ force: true, only: [location.id] })}>
              Opnieuw proberen
            </button>
          </div>
        )
      )}
      <SourceLine>Neerslag: Buienradar, KNMI · Verwachting: KNMI Harmonie via Open-Meteo</SourceLine>
    </main>
  );
}
