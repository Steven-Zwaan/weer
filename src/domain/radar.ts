/**
 * The radar timeline (§2.2): from "Nu" to about +2 hours, one step per nowcast step, each
 * paired with the Buienradar radar image for that moment. Chart and map come from the same
 * nowcast, so the rain on the map reaches the location when the chart says it does.
 */
import type { Nowcast, RadarStep } from './types';
import { upcoming } from './rain';

export const MAX_STEPS = 25;
const MATCH_MS = 150_000; // a frame belongs to a step within 2.5 minutes

/** `frames`: times of the available radar images, any order. */
export function radarTimeline(nowcast: Nowcast | null, frames: number[], now: number): RadarStep[] {
  const sorted = [...frames].sort((a, b) => a - b);
  const nearest = (t: number): number | null => {
    let best: number | null = null;
    for (const f of sorted) if (Math.abs(f - t) <= MATCH_MS && (best === null || Math.abs(f - t) < Math.abs(best - t))) best = f;
    return best;
  };
  if (nowcast) {
    const ahead = upcoming(nowcast, now).slice(0, MAX_STEPS);
    if (ahead.length) return ahead.map((s) => ({ time: s.time, mmPerHour: s.mmPerHour, frame: nearest(s.time) }));
  }
  // No nowcast (yet): the images alone, without a value at the location.
  return sorted.filter((f) => f + 5 * 60_000 > now).slice(0, MAX_STEPS).map((f) => ({ time: f, mmPerHour: null, frame: f }));
}

/** The image for step `i`: its own, or the nearest earlier one so the map never goes blank. */
export function frameAt(steps: RadarStep[], i: number): number | null {
  for (let j = Math.min(i, steps.length - 1); j >= 0; j--) if (steps[j].frame !== null) return steps[j].frame;
  return steps.find((s) => s.frame !== null)?.frame ?? null;
}
