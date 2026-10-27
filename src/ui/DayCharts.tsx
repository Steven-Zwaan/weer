/**
 * Dagdetail's linked charts (§2.3, §5): temperature line and hourly rain share one scrub
 * area, one cursor and one info bar.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Day } from '@/domain/types';
import { tempChart } from '@/domain/days';
import { describe } from '@/domain/weather';
import { levelText } from '@/domain/rain';
import { dec, tempLabel, windDirection } from '@/domain/format';
import { zoned } from '@/domain/time';
import { useScrub, useWidth } from '@/app/hooks';
import { RainChart } from './RainChart';

const GUTTER = 40;

export function DayCharts({ day, tz }: { day: Day; tz: string }) {
  const [hour, setHour] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(0, width - GUTTER);
  const hours = day.hours;
  const n = hours.length;
  const chart = useMemo(() => (n ? tempChart(hours, W) : null), [hours, n, W]);
  const end = useCallback(() => setHour(null), []);
  const scrub = useScrub(n, setHour, end, GUTTER);
  const h = hour !== null ? hours[hour] : undefined;

  let main = 'Sleep over de grafieken';
  let sub = 'Zie per uur temperatuur, weer en neerslag';
  if (h) {
    const hh = String(zoned(h.time, tz).hour).padStart(2, '0');
    main = `${hh}:00 · ${tempLabel(h.temp)} · ${h.precipMm > 0 ? levelText(h.precipMm) : describe(h.code, h.isDay)}`;
    sub = `Neerslag ${dec(h.precipMm)} mm · Wind ${Math.round(h.windKmh)} km/u ${windDirection(h.windDirDeg).toLowerCase()}`;
  }
  const peak = chart && hours[chart.peak];

  return (
    <section className="card daycharts" aria-label="Temperatuur en neerslag per uur">
      <span className="eyebrow">Temperatuur</span>
      <div className={`infobar${h ? ' active' : ''}`} aria-live="polite">
        <b>{main}</b>
        <span>{sub}</span>
      </div>
      <div className="scrubarea" ref={ref} {...scrub}>
        <div style={{ position: 'relative', height: 120, pointerEvents: 'none' }}>
          {chart && W > 0 && (
            <svg width={W} height={120} viewBox={`0 0 ${W} 120`} role="img" aria-label={`Temperatuur van ${tempLabel(day.min)} tot ${tempLabel(day.max)}`}>
              {[20, 60, 100].map((y) => (
                <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="var(--line)" />
              ))}
              <path d={chart.area} fill="var(--accent)" opacity={0.08} />
              <polyline points={chart.line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {!h && peak && (
                <>
                  <circle cx={chart.points[chart.peak].x} cy={chart.points[chart.peak].y} r={4.5} fill="#fff" stroke="var(--accent)" strokeWidth={2.5} />
                  <text x={chart.points[chart.peak].x} y={chart.points[chart.peak].y - 10} fontSize={12} fontWeight={600} fill="var(--ink)" textAnchor="middle">
                    {tempLabel(peak.temp)}
                  </text>
                </>
              )}
              {h && hour !== null && <circle cx={chart.points[hour].x} cy={chart.points[hour].y} r={5.5} fill="var(--ink)" stroke="#fff" strokeWidth={2.5} />}
            </svg>
          )}
          {chart && (
            <>
              <span style={{ position: 'absolute', right: 0, top: 13, fontSize: 11, color: 'var(--muted)' }}>{chart.tTop}°</span>
              <span style={{ position: 'absolute', right: 0, top: 93, fontSize: 11, color: 'var(--muted)' }}>{chart.tBottom}°</span>
            </>
          )}
        </div>
        <span className="eyebrow" style={{ paddingTop: 6, pointerEvents: 'none' }}>
          Neerslag per uur
        </span>
        <RainChart values={hours.map((x) => x.precipMm)} height={64} strongLabels cursor={hour} cursorMode="dim" ariaLabel={`Neerslag ${dec(day.precipSumMm)} mm`} />
        {hour !== null && (
          <div
            style={{
              position: 'absolute',
              left: `calc((100% - ${GUTTER}px) * ${((hour + 0.5) / n).toFixed(4)})`,
              top: 0,
              bottom: 0,
              marginLeft: -1,
              borderLeft: '2px solid var(--ink)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: GUTTER, fontSize: 12, color: 'var(--muted)' }} aria-hidden="true">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </section>
  );
}
