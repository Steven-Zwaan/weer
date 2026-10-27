/**
 * Vandaag's rain card (§2.1 item 3): the 2-hour summary, a scrubbable chart and a link to
 * the radar. Scrubbing replaces eyebrow and headline with the step under the finger (§5).
 */
import { useMemo, useState } from 'react';
import type { Nowcast } from '@/domain/types';
import { isStale, levelWithAmount, rainSummary, scrubEyebrow, upcoming } from '@/domain/rain';
import { rainAxis } from '@/domain/axis';
import { navigate } from '@/app/router';
import { RainChart, TimeAxis } from './RainChart';
import { IconChevronRight } from './Icons';

export function RainCard({ nowcast, tz, now }: { nowcast: Nowcast | null; tz: string; now: number }) {
  const [idx, setIdx] = useState<number | null>(null);
  const steps = useMemo(() => (nowcast ? upcoming(nowcast, now).slice(0, nowcast.stepMinutes === 5 ? 25 : 8) : []), [nowcast, now]);
  const stale = !nowcast || isStale(nowcast, now);
  const values = steps.map((s) => s.mmPerHour);
  const summary = stale ? 'Geen actuele radargegevens' : rainSummary(steps, nowcast!.stepMinutes, tz);
  const scrubbing = idx !== null && !stale && steps[idx] !== undefined;
  const eyebrow = scrubbing ? scrubEyebrow(steps, idx, tz) : 'Neerslag · komende 2 uur';
  const headline = scrubbing ? levelWithAmount(steps[idx].mmPerHour) : summary;
  const placeholder = stale && steps.length < 2;

  return (
    <section className={`card raincard${stale ? ' stale' : ''}`} aria-label="Neerslag komende 2 uur">
      <div className="raincard-head">
        <div className="raincard-title">
          <span className="eyebrow">{eyebrow}</span>
          <span className="raincard-headline" aria-live="polite">
            {headline}
          </span>
        </div>
        <a
          className="radarlink"
          href="#/radar"
          onClick={(e) => {
            e.preventDefault();
            navigate({ name: 'radar' });
          }}
        >
          Radar
          <IconChevronRight />
        </a>
      </div>
      <RainChart
        values={placeholder ? Array(25).fill(0) : values}
        height={96}
        fade={!stale && nowcast?.stepMinutes === 5}
        muted={stale}
        cursor={scrubbing ? idx : null}
        cursorMode="transient"
        onScrub={stale ? undefined : setIdx}
        ariaLabel={summary}
      />
      <TimeAxis labels={rainAxis(steps.map((s) => s.time), tz)} n={placeholder ? 25 : steps.length} />
    </section>
  );
}
