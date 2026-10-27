/**
 * Vandaag (§2.1): hero, rain card, hours, 10 days and tiles for the active location.
 * Swiping sideways anywhere outside the charts and the hour strip switches location.
 */
import { useActive, useStore } from '@/app/store';
import { useArrowKeys, useNow, useSwipe } from '@/app/hooks';
import { navigate } from '@/app/router';
import { AMSTERDAM, hhmm } from '@/domain/time';
import { HeroNow } from '@/ui/HeroNow';
import { RainCard } from '@/ui/RainCard';
import { HourStrip } from '@/ui/HourStrip';
import { DayList } from '@/ui/DayList';
import { DetailTiles } from '@/ui/DetailTiles';
import { PageDots, SourceLine } from '@/ui/TopBars';
import { IconList } from '@/ui/Icons';

export function Today() {
  const { location, entry, index, count } = useActive();
  const gpsStatus = useStore((s) => s.gpsStatus);
  const setActive = useStore((s) => s.setActive);
  const refresh = useStore((s) => s.refresh);
  const now = useNow();
  // Swipe (or arrow keys on a desktop) to the next or previous location.
  const step = (dir: 1 | -1) => {
    const next = useStore.getState().activeIndex + dir; // not `index`: two steps in one frame both count
    if (next >= 0 && next < count) setActive(next);
  };
  const swipe = useSwipe(step);
  useArrowKeys(step);

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
      <SourceLine>
        Neerslag: {entry.nowcast?.source === 'open-meteo' ? 'Open-Meteo (buiten bereik van Buienradar)' : 'Buienradar, KNMI'} · Verwachting: KNMI Harmonie via Open-Meteo
      </SourceLine>
    </main>
  );
}
