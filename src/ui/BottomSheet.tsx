/**
 * A bottom sheet whose content height follows a vertical drag, between `min` and `max`, and
 * snaps to one of the two on release. The drag works anywhere on the sheet, also over a
 * chart that scrubs sideways: a gesture that starts vertical belongs to the sheet, one that
 * starts sideways to whatever is under the finger. The grabber is also a button (tap or
 * keyboard toggles the size).
 */
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const DECIDE_PX = 8; // movement before a gesture counts as vertical or sideways
const SNAP_PX = 24; // a drag this far up or down snaps that way

interface Drag {
  id: number;
  x: number;
  y: number;
  h: number;
  mode: 'pending' | 'sheet' | 'other';
}

interface Props {
  min: number;
  max: number;
  expanded: boolean;
  onExpandedChange(expanded: boolean): void;
  /** A pointer went down on the sheet, before anything inside it sees it. */
  onGestureStart?(): void;
  /** That gesture turned out to be a sheet drag: undo what its first touch did inside. */
  onSheetDrag?(): void;
  label: string;
  children(height: number): ReactNode;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function BottomSheet({ min, max, expanded, onExpandedChange, onGestureStart, onSheetDrag, label, children }: Props) {
  const [live, setLive] = useState<number | null>(null); // height while dragging
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false); // a drag that ended on the grabber must not also toggle it
  const height = live ?? (expanded ? max : min);

  const end = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || d.mode !== 'sheet') return;
    dragged.current = true;
    window.setTimeout(() => (dragged.current = false), 400);
    const dy = e.clientY - d.y;
    const h = clamp(d.h - dy, min, max);
    setLive(null);
    onExpandedChange(dy < -SNAP_PX ? true : dy > SNAP_PX ? false : h > (min + max) / 2);
  };

  return (
    <section
      className={`sheet${live !== null ? ' dragging' : ''}`}
      aria-label={label}
      // Capture phase: the sheet sees the gesture before the chart under the finger does.
      onPointerDownCapture={(e) => {
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, h: height, mode: 'pending' };
        onGestureStart?.();
      }}
      onPointerMoveCapture={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId || d.mode === 'other') return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (d.mode === 'pending') {
          if (Math.abs(dy) > DECIDE_PX && Math.abs(dy) > Math.abs(dx)) {
            d.mode = 'sheet';
            onSheetDrag?.();
            // Keep following the finger once it leaves the sheet. A chart that captured the pointer
            // keeps it: its events still pass through here first, and it sees its own pointerup.
            const target = e.target as Element;
            if (!target.hasPointerCapture?.(e.pointerId)) {
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* the pointer is already gone */
              }
            }
          } else if (Math.abs(dx) > DECIDE_PX) {
            d.mode = 'other';
            return;
          } else return;
        }
        e.stopPropagation(); // the chart does not scrub during a sheet drag
        setLive(clamp(d.h - dy, min, max));
      }}
      onPointerUpCapture={end}
      onPointerCancelCapture={end}
    >
      <button type="button" className="grabber" aria-expanded={expanded} aria-label={expanded ? 'Grafiek kleiner' : 'Grafiek groter'} onClick={() => !dragged.current && onExpandedChange(!expanded)} />
      {children(height)}
    </section>
  );
}
