import type { Forecast, Location, Nowcast } from '@/domain/types';
import { heroDescription } from '@/domain/weather';
import { tempLabel } from '@/domain/format';
import { IconLocation } from './Icons';

export function HeroNow({ location, forecast, nowcast, now }: { location: Location; forecast: Forecast | null; nowcast: Nowcast | null; now: number }) {
  const today = forecast?.days[0];
  return (
    <section className="hero" aria-live="polite">
      <h1 className="hero-place" style={{ margin: 0 }}>
        {location.name}
        {location.isGps && <IconLocation aria-label="Mijn locatie" role="img" />}
      </h1>
      <div className="hero-temp">{forecast ? tempLabel(forecast.current.temp) : '–°'}</div>
      <div className="hero-desc">{forecast ? heroDescription(forecast.current, nowcast, now) : 'Weer ophalen…'}</div>
      {forecast && today && (
        <div className="hero-sub">
          H {tempLabel(today.max)} · L {tempLabel(today.min)} · Voelt als {tempLabel(forecast.current.feelsLike)}
        </div>
      )}
    </section>
  );
}
