import { back } from '@/app/router';
import { IconChevronLeft } from './Icons';

/** "‹ Utrecht" back link with a centred title (Radar, Dagdetail). */
export function BackBar({ label, title }: { label: string; title: string }) {
  return (
    <div className="backbar">
      <button type="button" className="backlink" onClick={back} aria-label={`Terug naar ${label}`}>
        <IconChevronLeft />
        <span>{label}</span>
      </button>
      <span className="bartitle">{title}</span>
      <span />
    </div>
  );
}

/** Page dots under the top bar when there is more than one location (§2.1). */
export function PageDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <div className="dots" role="img" aria-label={`Locatie ${index + 1} van ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={i === index ? 'on' : undefined} />
      ))}
    </div>
  );
}

export function SourceLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="footnote" style={{ textAlign: 'center', padding: '4px 12px', margin: 0 }}>
      {children}
    </p>
  );
}
