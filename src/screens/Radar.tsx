/**
 * Radar (§2.2): from "Nu" to about +2 hours. The map shows Buienradar's forecast radar image
 * for every step and the chart the nowcast at the location, both from the same nowcast. Play
 * runs through the steps; dragging the chart or the slider stops it and the cursor stays.
 *
 * The map fills the screen between the top bar and a bottom sheet with the chart. Dragging
 * the sheet up makes the chart taller (easier to tell the rain levels apart) while the map
 * stays visible above it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActive, useStore } from '@/app/store';
import { useNow } from '@/app/hooks';
import { persist } from '@/app/persist';
import { navigate } from '@/app/router';
import { frameAt, radarTimeline } from '@/domain/radar';
import { offsetLabel, rainAxis } from '@/domain/axis';
import { UNCERTAIN_AFTER, levelWithAmount } from '@/domain/rain';
import { AMSTERDAM, MINUTE, hhmm } from '@/domain/time';
import { BackBar } from '@/ui/TopBars';
import { RainChart, TimeAxis } from '@/ui/RainChart';
import { RadarMap } from '@/ui/RadarMap';
import { BottomSheet } from '@/ui/BottomSheet';
import { IconPause, IconPlay } from '@/ui/Icons';

const STEP_MS = 450;
const CHART_SMALL = 72; // the design's chart height
/** The large chart: about a third of the screen, leaving the map a good part of the rest. */
const chartLarge = (viewport: number) => Math.max(140, Math.min(300, Math.round(viewport * 0.34)));

function useViewportHeight(): number {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

export default function Radar() {
  const { location, entry } = useActive();
  const radar = useStore((s) => s.radar);
  const refreshRadar = useStore((s) => s.refreshRadar);
  const now = useNow(30_000);
  const [picked, setPicked] = useState(0); // 0 = "Nu"
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(persist.loadRadarExpanded);
  const viewport = useViewportHeight();
  // What the timeline was before a touch on the sheet; restored when that touch drags the sheet.
  const beforeGesture = useRef({ picked: 0, playing: false });

  useEffect(() => {
    if (!location) {
      navigate({ name: 'today' }, { replace: true });
      return;
    }
    void refreshRadar();
    const id = window.setInterval(() => void refreshRadar(), 5 * MINUTE);
    return () => window.clearInterval(id);
  }, [location, refreshRadar]);

  const frames = useMemo(() => radar?.frames ?? [], [radar]);
  const steps = useMemo(() => radarTimeline(entry.nowcast, frames.map((f) => f.time), now), [entry.nowcast, frames, now]);
  const n = steps.length;
  const step = Math.max(0, Math.min(n - 1, picked));

  useEffect(() => {
    if (!playing || n === 0) return;
    const id = window.setInterval(() => setPicked((p) => (p + 1) % n), STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, n]);

  if (!location) return <main className="radar-screen" />;

  const tz = entry.forecast?.timezone ?? AMSTERDAM;
  const s = steps[step];
  // Only the frames the timeline uses go on the map.
  const used = new Set(steps.map((x) => x.frame));
  const shown = frames.filter((f) => used.has(f.time));
  const status = !s || s.mmPerHour === null ? 'Geen gegevens' : levelWithAmount(s.mmPerHour);
  const wet = (s?.mmPerHour ?? 0) > 0;
  const offset = s ? offsetLabel(s.time, steps[0].time) : '';
  const scrub = (i: number | null) => {
    if (i === null) return;
    setPlaying(false);
    setPicked(i);
  };

  return (
    <main className="radar-screen">
      <BackBar label={location.name} title="Radar" />
      <div className="radarmap">
        <RadarMap lat={location.lat} lon={location.lon} frames={shown} frame={frameAt(steps, step)} label={`Neerslagradar rond ${location.name}`} />
        {s && (
          <div className="chip time" aria-live="polite">
            <b>{hhmm(s.time, tz)}</b>
            <span>{step > UNCERTAIN_AFTER ? `${offset} · minder zeker` : offset}</span>
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

      <BottomSheet
        min={CHART_SMALL}
        max={chartLarge(viewport)}
        expanded={expanded}
        onExpandedChange={(v) => {
          setExpanded(v);
          persist.saveRadarExpanded(v);
        }}
        onGestureStart={() => (beforeGesture.current = { picked: step, playing })}
        onSheetDrag={() => {
          setPicked(beforeGesture.current.picked);
          setPlaying(beforeGesture.current.playing);
        }}
        label="Tijdlijn"
      >
        {(chartHeight) => (
          <>
            {n > 0 ? (
              <>
                <RainChart
                  values={steps.map((x) => x.mmPerHour ?? 0)}
                  height={chartHeight}
                  strongLabels
                  cursor={step}
                  cursorMode="sticky"
                  onScrub={scrub}
                  ariaLabel={`Neerslag op ${location.name}: ${status}`}
                />
                <TimeAxis labels={rainAxis(steps.map((x) => x.time), tz)} n={n} />
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
            <p className="footnote">Radar en nowcast: Buienradar · Kaart: OpenStreetMap-bijdragers. Na 40 minuten is de verwachting minder zeker.</p>
          </>
        )}
      </BottomSheet>
    </main>
  );
}
