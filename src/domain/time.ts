/**
 * Time-zone arithmetic without a library. Everything is shown in the forecast's own zone
 * (Europe/Amsterdam for NL/BE); Buienradar times are Amsterdam wall-clock times.
 */

export const AMSTERDAM = 'Europe/Amsterdam';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zoned(ms: number, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of formatter(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAY[p.weekday] ?? 0,
  };
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds (Amsterdam: +1 h or +2 h). */
export function offsetAt(ms: number, tz: string): number {
  const z = zoned(ms, tz);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute);
  return asUtc - Math.floor(ms / MINUTE) * MINUTE;
}

/** The instant at which the wall clock in `tz` shows the given local time. */
export function fromZoned(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess, tz);
  // Around a DST switch the offset at the result can differ from the one at the guess.
  return guess - offsetAt(first, tz);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "14:30" in `tz`. */
export function hhmm(ms: number, tz: string): string {
  const z = zoned(ms, tz);
  return `${pad(z.hour)}:${pad(z.minute)}`;
}

/** "YYYY-MM-DD" of the local day in `tz`. */
export function dayKey(ms: number, tz: string): string {
  const z = zoned(ms, tz);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}`;
}

/** Round up to the next multiple of `minutes` (an exact multiple stays). */
export function ceilTo(ms: number, minutes: number): number {
  const step = minutes * MINUTE;
  return Math.ceil(ms / step) * step;
}

export function floorTo(ms: number, minutes: number): number {
  const step = minutes * MINUTE;
  return Math.floor(ms / step) * step;
}
