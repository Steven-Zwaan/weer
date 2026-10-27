import type { ReactNode } from 'react';
import type { Forecast } from '@/domain/types';
import { nextSunEvent, uvTile } from '@/domain/days';
import { tempLabel, windDirection } from '@/domain/format';
import { hhmm } from '@/domain/time';

export function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="tile">
      <span className="eyebrow">{label}</span>
      <span className="value">{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

/** Vandaag's 2 × 2 tiles (§2.1 item 6): wind, humidity, UV and the next sun event. */
export function DetailTiles({ forecast, now }: { forecast: Forecast; now: number }) {
  const c = forecast.current;
  const uv = uvTile(forecast, now);
  const sun = nextSunEvent(forecast.days, now);
  const tz = forecast.timezone;
  return (
    <div className="tiles">
      <Tile label="Wind" value={`${Math.round(c.windKmh)} km/u`} sub={`${windDirection(c.windDirDeg)} · stoten tot ${Math.round(c.gustKmh)} km/u`} />
      <Tile label="Luchtvochtigheid" value={`${Math.round(c.humidity)}%`} sub={`Dauwpunt ${tempLabel(c.dewPoint)}`} />
      <Tile label="UV-index" value={uv ? uv.value : '–'} sub={uv?.text ?? 'Niet beschikbaar'} />
      <Tile
        label="Zon"
        value={sun ? hhmm(sun.time, tz) : '–'}
        sub={sun ? `${sun.label}${sun.other ? ` · ${sun.other.label} om ${hhmm(sun.other.time, tz)}` : ''}` : 'Niet beschikbaar'}
      />
    </div>
  );
}
