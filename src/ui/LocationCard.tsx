import type { CSSProperties, ReactNode } from 'react';
import type { Location } from '@/domain/types';
import type { Entry } from '@/app/store';
import { heroDescription } from '@/domain/weather';
import { isStale, rainShort, upcoming } from '@/domain/rain';
import { tempLabel } from '@/domain/format';
import { AMSTERDAM, hhmm } from '@/domain/time';
import { RainChart } from './RainChart';

interface Props {
  location: Location;
  entry: Entry | undefined;
  now: number;
  onOpen(): void;
  /** Edit mode: a remove button on the left and a drag handle on the right. */
  before?: ReactNode;
  after?: ReactNode;
  editing?: boolean;
  style?: CSSProperties;
  className?: string;
  innerRef?: (el: HTMLElement | null) => void;
}

/** A place on Locaties (§2.4): name, local time, now, H/L and the 2-hour mini rain chart. */
export function LocationCard({ location, entry, now, onOpen, before, after, editing, style, className, innerRef }: Props) {
  const f = entry?.forecast ?? null;
  const nc = entry?.nowcast ?? null;
  const steps = nc ? upcoming(nc, now).slice(0, nc.stepMinutes === 5 ? 25 : 8) : [];
  const stale = !nc || isStale(nc, now);
  const rainText = stale ? 'Geen actuele radargegevens' : rainShort(steps, nc!.stepMinutes);
  const today = f?.days[0];
  const sub = location.isGps ? 'Mijn locatie' : hhmm(now, f?.timezone ?? AMSTERDAM);

  return (
    <div ref={innerRef} className={`loccard${className ? ` ${className}` : ''}`} style={style}>
      {before}
      <button type="button" className="loccard-main" onClick={onOpen} disabled={editing} aria-label={`${location.name}: ${f ? tempLabel(f.current.temp) : 'nog geen gegevens'}, ${rainText}`}>
        <div className="loccard-top">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="name">{location.name}</span>
            <span className="sub">{sub}</span>
            <span className="cond">{f ? heroDescription(f.current, nc, now) : 'Weer ophalen…'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="temp">{f ? tempLabel(f.current.temp) : '–°'}</span>
            {today && (
              <span className="hl">
                H {tempLabel(today.max)} · L {tempLabel(today.min)}
              </span>
            )}
          </div>
        </div>
        <div className="loccard-rain">
          <div style={{ flex: '0 0 120px' }}>
            <RainChart values={steps.length ? steps.map((s) => s.mmPerHour) : Array(25).fill(0)} height={18} labels={false} mini muted={stale} />
          </div>
          <span style={{ color: !stale && rainText.startsWith('Regen') ? 'var(--accent)' : 'var(--muted)' }}>{rainText}</span>
        </div>
      </button>
      {after}
    </div>
  );
}
