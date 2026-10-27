/**
 * Dutch formatting (SPEC: komma als decimaalteken, 24-uursklok, zinshoofdletters).
 */
import { zoned } from './time';

export const WEEKDAYS_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
export const WEEKDAYS_LONG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** 0.8 -> "0,8". */
export function dec(v: number, digits = 1): string {
  return v.toFixed(digits).replace('.', ',');
}

/** Whole degrees; never "-0". */
export function deg(v: number): number {
  const r = Math.round(v);
  return r === 0 ? 0 : r;
}

export function tempLabel(v: number): string {
  return `${deg(v)}°`;
}

export const WIND_SECTORS = ['Noord', 'Noordoost', 'Oost', 'Zuidoost', 'Zuid', 'Zuidwest', 'West', 'Noordwest'];

/** Degrees to one of 8 sectors, "Zuidwest". */
export function windDirection(degrees: number): string {
  const d = ((degrees % 360) + 360) % 360;
  return WIND_SECTORS[Math.round(d / 45) % 8];
}

/** UV index to its category (SPEC §6.2). */
export function uvLabel(uv: number): string {
  const u = Math.round(uv);
  if (u <= 2) return 'Laag';
  if (u <= 5) return 'Matig';
  if (u <= 7) return 'Hoog';
  if (u <= 10) return 'Zeer hoog';
  return 'Extreem';
}

/** "Donderdag 29 oktober". */
export function longDate(ms: number, tz: string): string {
  const z = zoned(ms, tz);
  return `${WEEKDAYS_LONG[z.weekday]} ${z.day} ${MONTHS[z.month - 1]}`;
}

export function shortWeekday(ms: number, tz: string): string {
  return WEEKDAYS_SHORT[zoned(ms, tz).weekday];
}
