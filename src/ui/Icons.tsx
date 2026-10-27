/**
 * Inline stroke icons in the design's style (§3): 24 viewBox, 1.7 px lines, round caps.
 * The sun, cloud, moon, sun-cloud and rain icons are the design's own paths; fog, drizzle,
 * snow, thunder and moon-cloud are drawn to match.
 */
import type { SVGProps } from 'react';
import type { IconName } from '@/domain/weather';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

const RAIN_CLOUD = 'M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.1 3.5 3.5 0 0 0 7 15z';
const CLOUD = 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 7 18z';
const SMALL_CLOUD = 'M9 20h8a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8 13.6 3.2 3.2 0 0 0 9 20z';

export function WeatherIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  switch (name) {
    case 'sun':
      return (
        <Svg size={size} stroke="var(--sun)">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </Svg>
      );
    case 'moon':
      return (
        <Svg size={size} stroke="var(--cloud)">
          <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" />
        </Svg>
      );
    case 'sun-cloud':
      return (
        <Svg size={size}>
          <path stroke="var(--sun)" d="M8 2.5V4M3 7.5h1.5M4.5 4l1 1M12.4 6.6l-1 1M11.6 9.6A4 4 0 0 0 4.5 9.8" />
          <path stroke="var(--cloud)" d={SMALL_CLOUD} />
        </Svg>
      );
    case 'moon-cloud':
      return (
        <Svg size={size} stroke="var(--cloud)">
          <path d="M11.2 9.3A4.3 4.3 0 0 1 5.6 3.7a4.6 4.6 0 1 0 5.6 5.6z" />
          {/* Filled with the card colour so the moon disappears behind the cloud. */}
          <path d={SMALL_CLOUD} fill="var(--surface)" />
        </Svg>
      );
    case 'cloud':
      return (
        <Svg size={size} stroke="var(--cloud)">
          <path d={CLOUD} />
        </Svg>
      );
    case 'fog':
      return (
        <Svg size={size} stroke="var(--cloud)">
          <path d="M7 12h10a3.6 3.6 0 0 0 .4-7.17A5.4 5.4 0 0 0 6.9 5.6 3.2 3.2 0 0 0 7 12z" />
          <path d="M4 15.5h16M6 19h12" />
        </Svg>
      );
    case 'drizzle':
      return (
        <Svg size={size} stroke="var(--accent)">
          <path d={RAIN_CLOUD} />
          <path d="M9 18.5v.6M13 18.5v.6M17 18.5v.6M11 21v.4M15 21v.4" strokeWidth={2} />
        </Svg>
      );
    case 'rain':
      return (
        <Svg size={size} stroke="var(--accent)">
          <path d={RAIN_CLOUD} />
          <path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" />
        </Svg>
      );
    case 'snow':
      return (
        <Svg size={size}>
          <path stroke="var(--cloud)" d={RAIN_CLOUD} />
          <path stroke="var(--cool)" d="M8.5 18v3M7.2 18.75l2.6 1.5M7.2 20.25l2.6-1.5M15.5 18v3M14.2 18.75l2.6 1.5M14.2 20.25l2.6-1.5" strokeWidth={1.4} />
        </Svg>
      );
    case 'thunder':
      return (
        <Svg size={size}>
          <path stroke="var(--cloud)" d={RAIN_CLOUD} />
          <path stroke="var(--sun)" d="M13 15.5l-2.5 3.5h3L11 22.5" />
        </Svg>
      );
  }
}

// ---------------- UI icons ----------------

export const IconList = (p: P) => (
  <Svg size={20} stroke="currentColor" strokeWidth={1.8} {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="0.8" />
    <circle cx="4" cy="12" r="0.8" />
    <circle cx="4" cy="18" r="0.8" />
  </Svg>
);

export const IconChevronRight = ({ size = 14, ...p }: P) => (
  <Svg size={size} stroke="currentColor" strokeWidth={2.4} {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconChevronLeft = ({ size = 18, ...p }: P) => (
  <Svg size={size} stroke="currentColor" strokeWidth={2.4} {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
);

/** The filled arrow after the place name when it is the GPS location. */
export const IconLocation = ({ size = 16, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true" {...p}>
    <path d="M21 3 3 10.5l7.5 3L13.5 21z" />
  </svg>
);

export const IconSearch = (p: P) => (
  <Svg size={18} stroke="var(--muted)" strokeWidth={2} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg size={18} stroke="var(--accent)" strokeWidth={2.2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconGrip = (p: P) => (
  <Svg size={22} stroke="currentColor" strokeWidth={2} {...p}>
    <path d="M5 9h14M5 15h14" />
  </Svg>
);

export const IconRemove = (p: P) => (
  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="10" fill="var(--danger)" />
    <path d="M7.5 12h9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
  </svg>
);

export const IconPlay = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);

export const IconPause = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="5" y="4" width="5" height="16" rx="1.5" />
    <rect x="14" y="4" width="5" height="16" rx="1.5" />
  </svg>
);
