/**
 * The one rain chart (§4): Vandaag (H 96, 25 × 5 min, fades after 40 min), Radar (H 72,
 * sticky cursor), Dagdetail (H 64, 24 hours, cursor driven from outside) and the mini chart
 * on Locaties (H 18, no labels).
 */
import { memo, useCallback } from 'react';
import { BAR, MINI_BAR, barHeight, fadeOpacity, intensityLines, UNCERTAIN_AFTER } from '@/domain/rain';
import type { AxisLabel } from '@/domain/axis';
import { useScrub } from '@/app/hooks';

export type CursorMode =
  | 'transient' // cursor only while dragging; everything else at 40 % (Vandaag)
  | 'sticky' // the cursor stays; earlier bars dim further than later ones (Radar)
  | 'dim'; // cursor from outside; others at 45 % while it is set (Dagdetail)

interface Props {
  values: number[];
  height: number;
  /** Intensity lines and the 40 px label gutter. */
  labels?: boolean;
  strongLabels?: boolean;
  mini?: boolean;
  /** Fade bars after this step and mark "minder zeker →" (Vandaag only). */
  fade?: boolean;
  /** Draw every bar in the dry colour (no current radar data). */
  muted?: boolean;
  cursor?: number | null;
  cursorMode?: CursorMode;
  onScrub?: (i: number | null) => void;
  ariaLabel?: string;
}

function opacityOf(i: number, p: Props): number {
  const c = p.cursor;
  if (p.cursorMode === 'sticky' && c !== null && c !== undefined) return i === c ? 1 : i < c ? 0.35 : 0.6;
  if (c !== null && c !== undefined) return i === c ? 1 : p.cursorMode === 'dim' ? 0.45 : 0.4;
  return p.fade ? fadeOpacity(i) : 1;
}

export const RainChart = memo(function RainChart(props: Props) {
  const { values, height: H, labels = true, mini = false, fade = false, muted = false, cursor = null, onScrub } = props;
  const n = values.length;
  const gutter = labels ? 40 : 0;
  const shape = mini ? MINI_BAR : BAR;
  const top = mini ? 0 : 8;
  const handleIndex = useCallback((i: number) => onScrub?.(i), [onScrub]);
  const handleEnd = useCallback(() => {
    if (props.cursorMode !== 'sticky') onScrub?.(null);
  }, [onScrub, props.cursorMode]);
  const scrub = useScrub(n, handleIndex, handleEnd);
  const frac = (i: number) => `calc((100% - ${gutter}px) * ${((i + 0.5) / Math.max(1, n)).toFixed(4)})`;

  return (
    <div
      className={`rainchart${mini ? ' mini' : ''}${props.strongLabels ? ' strong-labels' : ''}`}
      style={{ height: H + top }}
      data-noswipe
      role="img"
      aria-label={props.ariaLabel}
    >
      {labels &&
        intensityLines(H).map((l) => (
          <div key={l.id}>
            <div className="iline" style={{ bottom: l.y }} />
            <span className="ilabel" style={{ bottom: l.y + 2 }}>
              {l.id}
            </span>
          </div>
        ))}
      {fade && n > UNCERTAIN_AFTER + 1 && cursor === null && (
        <>
          <div className="uncertain" style={{ left: frac(UNCERTAIN_AFTER) }} />
          <span className="uncertain-label" style={{ left: `calc(${frac(UNCERTAIN_AFTER)} + 6px)` }}>
            minder zeker →
          </span>
        </>
      )}
      <div className={`bars${onScrub ? ' interactive' : ''}`} style={{ right: gutter }} {...(onScrub ? scrub : {})}>
        {values.map((v, i) => {
          const active = cursor === i;
          const dry = !(v > 0);
          return (
            <div
              key={i}
              className="bar"
              style={{
                height: barHeight(v, H, shape),
                opacity: opacityOf(i, props),
                background: active ? 'var(--ink)' : dry || muted ? 'var(--grid)' : 'var(--accent)',
              }}
            />
          );
        })}
      </div>
      {cursor !== null && !mini && props.cursorMode !== 'dim' && <div className="cursor" style={{ left: frac(cursor) }} />}
    </div>
  );
});

/** Labels under a chart, each centred under its own bar ("Nu" left-aligned at the start). */
export function TimeAxis({ labels, n, gutter = 40 }: { labels: AxisLabel[]; n: number; gutter?: number }) {
  return (
    <div className="timeaxis" style={{ marginRight: gutter }} aria-hidden="true">
      {labels.map((l) => {
        const f = (l.index + 0.5) / Math.max(1, n);
        const transform = l.index === 0 ? 'none' : f > 0.9 ? 'translateX(-100%)' : 'translateX(-50%)';
        return (
          <span key={l.index} className={l.strong ? 'strong' : undefined} style={{ left: l.index === 0 ? 0 : `${f * 100}%`, transform }}>
            {l.text}
          </span>
        );
      })}
    </div>
  );
}
