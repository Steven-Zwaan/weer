/**
 * Dagdetail (§2.3): pick a day, see its summary, linked charts and tiles. Swiping sideways
 * anywhere outside the charts and the day picker goes to the next or previous day.
 */
import { useEffect } from 'react';
import { useActive } from '@/app/store';
import { useArrowKeys, useSwipePager } from '@/app/hooks';
import { navigate, parseHash } from '@/app/router';
import { averageWind } from '@/domain/days';
import { describe } from '@/domain/weather';
import { dec, longDate, tempLabel, uvLabel, windDirection } from '@/domain/format';
import { hhmm } from '@/domain/time';
import { BackBar } from '@/ui/TopBars';
import { DayPicker } from '@/ui/DayPicker';
import { DayCharts } from '@/ui/DayCharts';
import { Tile } from '@/ui/DetailTiles';

export function DayDetail({ index }: { index: number }) {
  const { location, entry } = useActive();
  const f = entry.forecast;
  const count = f?.days.length ?? 0;
  const i = Math.max(0, Math.min(count - 1, index));
  const select = (d: number) => navigate({ name: 'day', index: d }, { replace: true });
  // The day shown right now, from the address: two steps in one frame must both count.
  const current = () => {
    const route = parseHash(window.location.hash);
    return route.name === 'day' ? Math.min(route.index, count - 1) : i;
  };
  const pager = useSwipePager<HTMLDivElement>(
    (dir) => current() + dir >= 0 && current() + dir < count,
    (dir) => select(current() + dir),
  );
  useArrowKeys(pager.slide);

  // Nothing to show (no forecast yet, or the location went away): back to Vandaag.
  useEffect(() => {
    if (!location || (!f && !entry.loading)) navigate({ name: 'today' }, { replace: true });
  }, [location, f, entry.loading]);
  if (!location || !f || count === 0) return <main className="screen sub" />;

  const day = f.days[i];
  const tz = f.timezone;

  return (
    <main className="screen sub swipe-area" {...pager.handlers}>
      <BackBar label={location.name} title={`${count} dagen`} />
      <DayPicker days={f.days} selected={i} tz={tz} onSelect={select} />
      <div className="pager" ref={pager.ref}>
        <section className="card daysum">
          <span style={{ fontSize: 15, color: 'var(--muted)' }}>{longDate(day.date, tz)}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 300, letterSpacing: '-0.03em' }}>{tempLabel(day.max)}</span>
            <span style={{ fontSize: 22, fontWeight: 400, color: 'var(--muted)' }}>{tempLabel(day.min)}</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 500 }}>{describe(day.code)}</span>
        </section>
        <DayCharts key={day.key} day={day} tz={tz} />
        <div className="tiles compact">
          <Tile label="Neerslag" value={`${dec(day.precipSumMm)} mm`} sub={day.precipProb !== null ? `Kans ${Math.round(day.precipProb)}%` : undefined} />
          <Tile label="Wind" value={`${Math.round(averageWind(day))} km/u`} sub={`${windDirection(day.windDirDeg)} · stoten ${Math.round(day.gustMaxKmh)} km/u`} />
          <Tile label="Zon" value={day.sunrise !== null ? hhmm(day.sunrise, tz) : '–'} sub={day.sunset !== null ? `Op · onder om ${hhmm(day.sunset, tz)}` : undefined} />
          <Tile label="UV-index" value={day.uvMax !== null ? Math.round(day.uvMax) : '–'} sub={day.uvMax !== null ? uvLabel(day.uvMax) : 'Niet beschikbaar'} />
        </div>
        <p className="footnote" style={{ padding: '0 8px', margin: 0 }}>
          Verwachting: KNMI Harmonie (eerste 2,5 dag) en ECMWF via Open-Meteo. Verder dan 3 dagen vooruit is de verwachting een indicatie.
        </p>
      </div>
    </main>
  );
}
