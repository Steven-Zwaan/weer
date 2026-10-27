/**
 * Everything about rain charts and rain text (SPEC §4): bar heights, intensity lines,
 * the uncertainty fade and the two forms of the 2-hour summary.
 */
import scale from '@shared/data/rain-scale.json';
import type { Nowcast, RainStep } from './types';
import { MINUTE, hhmm } from './time';
import { dec } from './format';

export const WET = scale.wet; // a step is "wet" from 0.1 mm/h
export const REFERENCE = scale.reference; // the full chart height is 5 mm/h (zwaar)
export const UNCERTAIN_AFTER = scale.uncertainAfterStep;
export const STALE_AFTER_MS = scale.staleAfterMinutes * MINUTE;

export interface BarShape {
  dry: number;
  min: number;
}

export const BAR: BarShape = scale.bar;
export const MINI_BAR: BarShape = scale.miniBar;

/** Bar height in px: square-root scale so drizzle stays visible next to a downpour (§4.1). */
export function barHeight(mmPerHour: number, H: number, shape: BarShape = BAR): number {
  if (!(mmPerHour > 0)) return shape.dry;
  return Math.round(Math.max(shape.min, Math.min(H, Math.sqrt(mmPerHour / REFERENCE) * H)));
}

export interface IntensityLine {
  id: string; // licht | matig | zwaar
  mmPerHour: number;
  y: number; // px from the bottom
}

/** The dotted reference lines, heaviest first (§4.2). */
export function intensityLines(H: number): IntensityLine[] {
  return [...scale.levels].reverse().map((l) => ({ id: l.id, mmPerHour: l.mmPerHour, y: Math.round(Math.sqrt(l.mmPerHour / REFERENCE) * H) }));
}

export function isWet(mmPerHour: number): boolean {
  return mmPerHour >= WET;
}

/** "Droog" / "Lichte regen" / "Matige regen" / "Zware regen". */
export function levelText(mmPerHour: number): string {
  if (!(mmPerHour > 0)) return scale.dryText;
  if (mmPerHour < 1) return 'Lichte regen';
  if (mmPerHour < 5) return 'Matige regen';
  return 'Zware regen';
}

/** "Matige regen · 3,1 mm/u", or "Droog". */
export function levelWithAmount(mmPerHour: number): string {
  return mmPerHour > 0 ? `${levelText(mmPerHour)} · ${dec(mmPerHour)} mm/u` : levelText(mmPerHour);
}

/** Opacity of bar `i` on Vandaag: the forecast gets less certain after 40 minutes (§4.3). */
export function fadeOpacity(i: number, after = UNCERTAIN_AFTER): number {
  if (i <= after) return 1;
  return Math.max(scale.fadeFloor, 1 - (i - after) * scale.fadePerStep);
}

/** Normalise a raw rate: one decimal, anything under 0.05 is dry. */
export function roundRate(mmPerHour: number): number {
  if (!Number.isFinite(mmPerHour) || mmPerHour < 0.05) return 0;
  return Math.round(mmPerHour * 10) / 10;
}

/** The steps still ahead of `now`: a step stays while its interval has not ended. */
export function upcoming(nowcast: Nowcast, now: number): RainStep[] {
  const len = nowcast.stepMinutes * MINUTE;
  return nowcast.steps.filter((s) => s.time + len > now);
}

export function isStale(nowcast: Nowcast, now: number): boolean {
  return now - nowcast.fetchedAt > STALE_AFTER_MS || upcoming(nowcast, now).length < 2;
}

interface Blocks {
  firstWet: number;
  firstDry: number;
  endOfFirstWet: number; // last wet index of the first wet block
}

function blocks(steps: RainStep[]): Blocks {
  const wet = steps.map((s) => isWet(s.mmPerHour));
  const firstWet = wet.indexOf(true);
  const firstDry = wet.indexOf(false);
  let endOfFirstWet = -1;
  if (firstWet >= 0) {
    endOfFirstWet = firstWet;
    while (endOfFirstWet + 1 < wet.length && wet[endOfFirstWet + 1]) endOfFirstWet++;
  }
  return { firstWet, firstDry, endOfFirstWet };
}

/** Headline of the rain card (§4.4). Minutes count from the first step ("Nu"). */
export function rainSummary(steps: RainStep[], stepMinutes: number, tz: string): string {
  if (steps.length === 0) return 'Geen neerslaggegevens';
  const { firstWet, firstDry, endOfFirstWet } = blocks(steps);
  if (firstWet < 0) return 'Droog komende 2 uur';
  if (firstDry < 0) return 'Regen komende 2 uur';
  if (firstWet === 0) return `Regen nu, droog over ${firstDry * stepMinutes} min`;
  const from = hhmm(steps[firstWet].time, tz);
  if (endOfFirstWet === steps.length - 1) return `Regen vanaf ${from}`;
  const until = hhmm(steps[endOfFirstWet].time + stepMinutes * MINUTE, tz);
  return `Regen vanaf ${from}, tot ca. ${until}`;
}

/** The short form on a location card. */
export function rainShort(steps: RainStep[], stepMinutes: number): string {
  if (steps.length === 0) return 'Geen neerslaggegevens';
  const { firstWet, firstDry } = blocks(steps);
  if (firstWet < 0) return 'Droog komende 2 uur';
  if (firstDry < 0) return 'Regen komende 2 uur';
  if (firstWet === 0) return `Droog over ${firstDry * stepMinutes} min`;
  return `Regen over ${firstWet * stepMinutes} min`;
}

/** Eyebrow while scrubbing Vandaag: "Nu" or "15:15 · over 45 min". */
export function scrubEyebrow(steps: RainStep[], i: number, tz: string): string {
  if (i <= 0) return 'Nu';
  const minutes = Math.round((steps[i].time - steps[0].time) / MINUTE);
  return `${hhmm(steps[i].time, tz)} · over ${minutes} min`;
}
