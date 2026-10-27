/**
 * WMO weather codes -> condition, Dutch text and icon (SPEC §7). The table itself is
 * platform-neutral JSON in shared/data/weathercodes.json.
 */
import table from '@shared/data/weathercodes.json';
import type { Condition, Current, Nowcast } from './types';
import { isWet, levelText, upcoming } from './rain';

interface CodeEntry {
  condition: Condition;
  text: string;
  night?: string;
}

const CODES = table.codes as Record<string, CodeEntry>;

export type IconName = 'sun' | 'moon' | 'sun-cloud' | 'moon-cloud' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

function entry(code: number): CodeEntry {
  // Unknown codes fall back to the nearest lower code in the table, or "Bewolkt".
  const exact = CODES[String(code)];
  if (exact) return exact;
  const lower = Object.keys(CODES)
    .map(Number)
    .filter((c) => c <= code)
    .sort((a, b) => b - a)[0];
  return lower !== undefined ? CODES[String(lower)] : CODES['3'];
}

export function conditionOf(code: number): Condition {
  return entry(code).condition;
}

export function describe(code: number, isDay = true): string {
  const e = entry(code);
  return !isDay && e.night ? e.night : e.text;
}

export function iconOf(condition: Condition, isDay = true): IconName {
  switch (condition) {
    case 'clear':
      return isDay ? 'sun' : 'moon';
    case 'partly':
      return isDay ? 'sun-cloud' : 'moon-cloud';
    case 'cloudy':
      return 'cloud';
    case 'fog':
      return 'fog';
    case 'drizzle':
      return 'drizzle';
    case 'rain':
    case 'showers':
      return 'rain';
    case 'snow':
      return 'snow';
    case 'thunder':
      return 'thunder';
  }
}

const DRY: Condition[] = ['clear', 'partly', 'cloudy', 'fog'];

/**
 * The hero line under the temperature. When the radar says it rains right now but the
 * model code is dry, the radar wins: it is more reliable for the present moment (§7).
 */
export function heroDescription(current: Current, nowcast: Nowcast | null, now: number): string {
  const first = nowcast ? upcoming(nowcast, now)[0] : undefined;
  if (first && isWet(first.mmPerHour) && DRY.includes(current.condition)) return levelText(first.mmPerHour);
  return describe(current.code, current.isDay);
}
