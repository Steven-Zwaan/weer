/**
 * Time axis under a rain chart: "Nu" plus the real half hours (§2.1 "afgeleid van de echte
 * tijden, afgerond op het halfuur"). Positions are step indices, so labels sit under the
 * bars they name.
 */
import { MINUTE, hhmm, zoned } from './time';

export interface AxisLabel {
  index: number;
  text: string;
  strong: boolean;
}

export function rainAxis(times: number[], tz: string): AxisLabel[] {
  const n = times.length;
  if (n === 0) return [];
  const minGap = Math.max(2, Math.ceil(n / 6)); // never crowd: about five labels at most
  const labels: AxisLabel[] = [{ index: 0, text: 'Nu', strong: true }];
  times.forEach((t, i) => {
    const z = zoned(t, tz);
    if (z.minute % 30 !== 0) return;
    if (labels.some((l) => Math.abs(l.index - i) < minGap)) return;
    labels.push({ index: i, text: hhmm(t, tz), strong: false });
  });
  return labels.sort((a, b) => a.index - b.index);
}

/** Radar timeline offset: "Nu", "+40 min". */
export function offsetLabel(time: number, nowTime: number): string {
  const m = Math.round((time - nowTime) / MINUTE);
  if (m === 0) return 'Nu';
  return m > 0 ? `+${m} min` : `−${-m} min`;
}
