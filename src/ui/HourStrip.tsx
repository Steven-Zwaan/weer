import type { Forecast } from '@/domain/types';
import { hoursAhead } from '@/domain/days';
import { iconOf, describe } from '@/domain/weather';
import { dec, tempLabel } from '@/domain/format';
import { zoned } from '@/domain/time';
import { WeatherIcon } from './Icons';

/** "Per uur": 10 columns of 52 px, scrolling sideways (§2.1 item 4). */
export function HourStrip({ forecast, now }: { forecast: Forecast; now: number }) {
  const hours = hoursAhead(forecast, now, 10);
  const c = forecast.current;
  return (
    <section className="card hourstrip" aria-label="Per uur">
      <div className="eyebrow">Per uur</div>
      <div className="hours" data-noswipe>
        {hours.map((h, i) => {
          const first = i === 0;
          // "Nu" shows the current conditions; later columns the hourly forecast.
          const temp = first ? c.temp : h.temp;
          const icon = first ? iconOf(c.condition, c.isDay) : iconOf(h.condition, h.isDay);
          const label = first ? 'Nu' : String(zoned(h.time, forecast.timezone).hour).padStart(2, '0');
          return (
            <div key={h.time} className={`hourcol${first ? ' now' : ''}`} aria-label={`${label}: ${tempLabel(temp)}, ${describe(first ? c.code : h.code, first ? c.isDay : h.isDay)}`}>
              <span className="t">{label}</span>
              <div className="icon">
                <WeatherIcon name={icon} size={26} />
              </div>
              <span className="temp">{tempLabel(temp)}</span>
              <span className="mm">{h.precipMm > 0 ? `${dec(h.precipMm)} mm` : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
