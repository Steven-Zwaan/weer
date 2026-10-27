import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent } from 'react';
import { MINUTE } from '@/domain/time';
import { useStore } from './store';

/** The current time, re-read every `everyMs` (and when the app comes back to the foreground). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, everyMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [everyMs]);
  return now;
}

/**
 * Refresh on open, when the app becomes visible again and every 5 minutes while visible (§8).
 * Coming back after a while also jumps to my location and gets a new fix (see store.resume).
 */
export function useAutoRefresh(): void {
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    let hiddenAt = 0;
    const refresh = () => void useStore.getState().refresh();
    const stop = () => {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = window.setInterval(refresh, 5 * MINUTE);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        useStore.getState().resume(hiddenAt ? Date.now() - hiddenAt : 0);
        start();
      } else {
        hiddenAt = Date.now();
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', refresh);
    if (document.visibilityState === 'visible') start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', refresh);
    };
  }, [ready]);
}

/**
 * A sideways swipe anywhere on a screen: left = next (+1), right = previous (-1). A swipe
 * that starts inside `[data-noswipe]` (charts, horizontal strips) belongs to that element.
 */
export function useSwipe(onSwipe: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (e.touches.length !== 1 || target.closest('[data-noswipe]')) {
        start.current = null;
        return;
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy) && Date.now() - s.t < 800) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

/**
 * A horizontal strip (Per uur, the day picker) that a mouse can scroll too: drag it sideways,
 * or turn the wheel while the strip can still move that way. Touch scrolls it natively, so
 * only mouse pointers are handled. A drag never ends in a click on what is under the cursor.
 */
export function useDragScroll<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { id: number; x: number; left: number } | null = null;
    let moved = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      start = { id: e.pointerId, x: e.clientX, left: el.scrollLeft };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) {
        moved = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
      }
      el.scrollLeft = start.left - dx;
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      el.classList.remove('dragging');
    };
    const click = (e: MouseEvent) => {
      if (!moved) return;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; // a trackpad scrolls sideways by itself
      const max = el.scrollWidth - el.clientWidth;
      const canMove = e.deltaY > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 0;
      if (!canMove) return; // at the end the page scrolls on
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('click', click, true);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('click', click, true);
      el.removeEventListener('wheel', wheel);
    };
  }, []);
  return ref;
}

/** The arrow keys do what a swipe does (handy in a desktop browser). */
export function useArrowKeys(onStep: (dir: 1 | -1) => void): void {
  const latest = useRef(onStep);
  latest.current = onStep;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') latest.current(1);
      if (e.key === 'ArrowLeft') latest.current(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Width of an element, kept up to date. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export interface ScrubHandlers {
  onPointerDown(e: ReactPointerEvent<HTMLElement>): void;
  onPointerMove(e: ReactPointerEvent<HTMLElement>): void;
  onPointerUp(e: ReactPointerEvent<HTMLElement>): void;
  onPointerCancel(e: ReactPointerEvent<HTMLElement>): void;
}

/**
 * Scrubbing over a chart (§5): pointer capture on down, an index per column while dragging,
 * and a callback only when the index changes (no re-render per pixel). `gutter` is the
 * label column on the right that does not count as chart.
 */
export function useScrub(n: number, onIndex: (i: number) => void, onEnd?: () => void, gutter = 0): ScrubHandlers {
  const dragging = useRef(false);
  const last = useRef<number | null>(null);
  const pick = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const w = Math.max(1, r.width - gutter);
      const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / w) * n)));
      if (i !== last.current) {
        last.current = i;
        onIndex(i);
      }
    },
    [n, gutter, onIndex],
  );
  const end = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    last.current = null;
    onEnd?.();
  }, [onEnd]);
  return {
    onPointerDown(e) {
      if (n === 0) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* a pointer that is already gone; dragging still works inside the element */
      }
      dragging.current = true;
      pick(e);
    },
    onPointerMove(e) {
      if (dragging.current) pick(e);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
