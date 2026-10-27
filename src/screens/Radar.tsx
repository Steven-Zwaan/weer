/**
 * Radar (§2.2): the map with the past hour of KNMI frames, a chart of the same timeline at
 * the location (radar values, then the Buienradar nowcast), play and a slider. Dragging the
 * chart or the slider stops playback; the cursor stays where it was left.
 */
import { useEffect, useMemo, useState } from 'react';
import { useActive, useStore } from '@/app/store';
import { useNow } from '@/app/hooks';
import { navigate } from '@/app/router';
import { frameAt, radarTimeline } from '@/domain/radar';
import { offsetLabel, rainAxis } from '@/domain/axis';
import { levelWithAmount } from '@/domain/rain';
import { AMSTERDAM, MINUTE, hhmm } from '@/domain/time';
import { BackBar } from '@/ui/TopBars';
import { RainChart, TimeAxis } from '@/ui/RainChart';
import { RadarMap } from '@/ui/RadarMap';
import { IconPause, IconPlay } from '@/ui/Icons';

const STEP_MS = 450;

export default function Radar() {
  const { location, entry } = useActive();
  const radar = useStore((s) => (location ? s.radar[location.id] : undefined));
  const refreshRadar = useStore((s) => s.refreshRadar);
  const now = useNow(30_000);
  const [picked, setPicked] = useState<number | null>(null); // null: follow "Nu"
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!location) {
      navigate({ name: 'today' }, { replace: true });
      return;
    }
    void refreshRadar(location);
    const id = window.setInterval(() => void refreshRadar(location), 5 * MINUTE);
    return () => window.clearInterval(id);
  }, [location, refreshRadar]);

  const timeline = useMemo(() => radarTimeline(radar?.past ?? [], entry.nowcast, now), [radar, entry.nowcast, now]);
  const n = timeline.steps.length;
  const step = Math.max(0, Math.min(n - 1, picked ?? timeline.nowIndex));

  useEffect(() => {
    if (!playing || n === 0) return;
    const id = window.setInterval(() => setPicked((p) => ((p ?? timeline.nowIndex) + 1) % n), STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, n, timeline.nowIndex]);

  if (!location) return <main className="screen sub" />;

  const tz = entry.forecast?.timezone ?? AMSTERDAM;
  const s = timeline.steps[step];
  const nowStep = timeline.steps[timeline.nowIndex];
  const frames = timeline.steps.filter((x) => x.frame !== null).map((x) => x.frame as number);
  const frame = frameAt(timeline, step);
  const status = s?.mmPerHour === null || s === undefined ? 'Geen gegevens' : levelWithAmount(s.mmPerHour);
  const wet = (s?.mmPerHour ?? 0) > 0;
  const scrub = (i: number | null) => {
    if (i === null) return;
    setPlaying(false);
    setPicked(i);
  };

  return (
    <main className="screen sub" style={{ gap: 12 }}>
      <BackBar label={location.name} title="Radar" />
      <div className="radarmap">
        <RadarMap lat={location.lat} lon={location.lon} frames={frames} frame={frame} dimmed={s?.kind === 'forecast' && step > timeline.nowIndex} label={`Neerslagradar rond ${location.name}`} />
        {s && nowStep && (
          <div className="chip time" aria-live="polite">
            <b>{hhmm(s.time, tz)}</b>
            <span>{offsetLabel(s.time, nowStep.time)}</span>
          </div>
        )}
        <div className="chip status" style={{ color: wet ? 'var(--accent)' : 'var(--muted)' }}>
          {status}
        </div>
        <div className="chip legend" aria-hidden="true">
          <span>
            <i style={{ background: 'var(--radar-1)' }} />
            licht
          </span>
          <span>
            <i style={{ background: 'var(--radar-2)' }} />
            matig
          </span>
          <span>
            <i style={{ background: 'var(--radar-3)' }} />
            zwaar
          </span>
          <span>
            <i style={{ background: 'var(--radar-4)' }} />
            extreem
          </span>
        </div>
      </div>

      <section className="card radarpanel" aria-label="Tijdlijn">
        {n > 0 ? (
          <>
            <RainChart
              values={timeline.steps.map((x) => x.mmPerHour ?? 0)}
              height={72}
              strongLabels
              cursor={step}
              cursorMode="sticky"
              nowIndex={timeline.nowIndex}
              onScrub={scrub}
              ariaLabel={`Neerslag op ${location.name}: ${status}`}
            />
            <TimeAxis labels={rainAxis(timeline.steps.map((x) => x.time), tz, timeline.nowIndex)} n={n} />
            <div className="player">
              <button
                type="button"
                className="playbtn"
                aria-label={playing ? 'Pauzeer' : 'Afspelen'}
                onClick={() => {
                  if (!playing && step === n - 1) setPicked(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? <IconPause /> : <IconPlay />}
              </button>
              <label htmlFor="radar-time" className="sr-only">
                Tijdstip radarbeeld
              </label>
              <input
                id="radar-time"
                type="range"
                min={0}
                max={n - 1}
                step={1}
                value={step}
                onChange={(e) => {
                  setPlaying(false);
                  setPicked(Number(e.target.value));
                }}
              />
            </div>
          </>
        ) : (
          <div className="empty" style={{ padding: 16 }}>
            Radargegevens ophalen…
          </div>
        )}
      </section>

      <p className="footnote" style={{ padding: '0 8px', margin: 0 }}>
        Radar: KNMI (afgelopen uur) · Nowcast: Buienradar · Kaart: OpenStreetMap-bijdragers. Na Nu toont de kaart het laatste radarbeeld en staat de verwachting in de grafiek; na 40
        minuten is die minder zeker.
      </p>
    </main>
  );
}
