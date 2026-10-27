import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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

/** Refresh on open, when the app becomes visible again and every 5 minutes while visible (§8). */
export function useAutoRefresh(): void {
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
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
        refresh(); // skips data younger than 2 minutes
        start();
      } else stop();
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
