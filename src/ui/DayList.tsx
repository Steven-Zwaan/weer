import type { Forecast } from '@/domain/types';
import { dayName, tempBars } from '@/domain/days';
import { describe, iconOf } from '@/domain/weather';
import { tempLabel } from '@/domain/format';
import { navigate } from '@/app/router';
import { IconChevronRight, WeatherIcon } from './Icons';

/** "Komende 10 dagen" (§2.1 item 5). A row opens Dagdetail on that day. */
export function DayList({ forecast }: { forecast: Forecast }) {
  const bars = tempBars(forecast.days);
  const tz = forecast.timezone;
  return (
    <section className="card daylist" aria-label="Komende 10 dagen">
      <div className="eyebrow">Komende {forecast.days.length} dagen</div>
      {forecast.days.map((d, i) => {
        const pct = d.precipProb !== null && d.precipProb >= 30 ? `${Math.round(d.precipProb)}%` : '';
        const name = dayName(d, i, tz);
        return (
          <button
            key={d.key}
            type="button"
            className={`dayrow${i === 0 ? ' today' : ''}`}
            onClick={() => navigate({ name: 'day', index: i })}
            aria-label={`${name}: ${describe(d.code)}, ${tempLabel(d.min)} tot ${tempLabel(d.max)}${pct ? `, ${pct} kans op neerslag` : ''}`}
          >
            <span className="name">{name}</span>
            <span className="icon">
              <WeatherIcon name={iconOf(d.condition, true)} />
            </span>
            <span className="pct">{pct}</span>
            <span className="range">
              <span className="lo">{tempLabel(d.min)}</span>
              <span className="track">
                <span className="fill" style={{ left: `${bars[i].left.toFixed(1)}%`, width: `${bars[i].width.toFixed(1)}%`, background: bars[i].warm ? 'var(--warm)' : 'var(--cool)' }} />
              </span>
            </span>
            <span className="hi">{tempLabel(d.max)}</span>
            <IconChevronRight size={12} stroke="var(--uncertain)" strokeWidth={2.6} />
          </button>
        );
      })}
    </section>
  );
}
