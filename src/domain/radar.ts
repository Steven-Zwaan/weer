/**
 * The radar timeline (§2.2): the past hour of KNMI radar frames, then the Buienradar nowcast.
 * No free source publishes forecast radar images, so forecast steps have no frame of their
 * own: the map keeps the newest image and the chart carries the forecast (§6.3, option 3).
 */
import type { Nowcast, RadarStep, RainStep } from './types';
import { MINUTE } from './time';
import { upcoming } from './rain';

export const PAST_FRAMES = 12; // one hour of 5-minute frames before the newest one

export interface RadarTimeline {
  steps: RadarStep[];
  nowIndex: number;
  newestFrame: number | null;
}

/** `past`: radar frames with the rate at the location, any order. */
export function radarTimeline(past: RainStep[], nowcast: Nowcast | null, now: number): RadarTimeline {
  const frames = [...past].sort((a, b) => a.time - b.time).slice(-(PAST_FRAMES + 1));
  const newestFrame = frames.length ? frames[frames.length - 1].time : null;
  const steps: RadarStep[] = frames.map((f) => ({ time: f.time, mmPerHour: f.mmPerHour, frame: f.time, kind: 'past' }));
  const ahead = nowcast ? upcoming(nowcast, now).filter((s) => newestFrame === null || s.time > newestFrame + MINUTE) : [];
  for (const s of ahead) steps.push({ time: s.time, mmPerHour: s.mmPerHour, frame: null, kind: 'forecast' });
  const firstForecast = steps.findIndex((s) => s.kind === 'forecast');
  const nowIndex = firstForecast >= 0 ? firstForecast : Math.max(0, steps.length - 1);
  return { steps, nowIndex, newestFrame };
}

/** The image to show at step `i`: its own frame, or the newest one for forecast steps. */
export function frameAt(t: RadarTimeline, i: number): number | null {
  return t.steps[i]?.frame ?? t.newestFrame;
}

/** WMS TIME value: "2026-10-27T13:50:00Z". */
export function wmsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
