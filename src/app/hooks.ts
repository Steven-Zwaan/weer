import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent } from 'react';
import { MINUTE } from '@/domain/time';
import { useStore } from './store';
import { prefersReducedMotion } from './platform';

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

export interface SwipePager<T extends HTMLElement> {
  /** The element that slides: the page content. */
  ref: React.RefObject<T | null>;
  /** Touch handlers for the area that listens (usually the whole screen). */
  handlers: {
    onTouchStart(e: TouchEvent): void;
    onTouchMove(e: TouchEvent): void;
    onTouchEnd(e: TouchEvent): void;
    onTouchCancel(e: TouchEvent): void;
  };
  /** Slide to the next (+1) or previous (-1) page, as a swipe would (arrow keys). */
  slide(dir: 1 | -1): void;
}

const LOCK_PX = 10; // movement before a gesture counts as sideways or vertical
const EDGE_RESISTANCE = 0.3; // there is no page that way: the content only gives a little

/**
 * Swipe between pages (days, locations) like a pager: while the finger moves sideways the
 * content follows it; on release it slides out and the next page slides in from the other
 * side, or it springs back. Left = next (+1), right = previous (-1). A gesture that starts
 * inside `[data-noswipe]` (charts, horizontal strips) belongs to that element. Transforms are
 * set on the element directly, so a drag does not re-render React on every move.
 */
export function useSwipePager<T extends HTMLElement>(canGo: (dir: 1 | -1) => boolean, go: (dir: 1 | -1) => void): SwipePager<T> {
  const ref = useRef<T>(null);
  const latest = useRef({ canGo, go });
  latest.current = { canGo, go };
  const start = useRef<{ x: number; y: number; t: number; lock: 'h' | 'v' | null; dx: number } | null>(null);
  const busy = useRef(false);

  const setX = (x: number) => {
    if (ref.current) ref.current.style.transform = x ? `translateX(${x}px)` : '';
  };
  /**
   * Move from `from` to `to`; the element keeps `to` afterwards. Never waits longer than the
   * animation should take: a paused timeline (app sent to the background mid-swipe) must not
   * leave the pager stuck, so a timer ends it at its final position.
   */
  const run = (from: number, to: number, ms: number): Promise<void> => {
    setX(to);
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return Promise.resolve();
    const anim = el.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: ms, easing: 'cubic-bezier(.2,.7,.3,1)' });
    const done = anim.finished.then(
      () => undefined,
      () => undefined,
    );
    const late = new Promise<void>((r) => setTimeout(r, ms + 100)).then(() => anim.cancel());
    return Promise.race([done, late]);
  };
  const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

  const slide = async (dir: 1 | -1, fromX = 0) => {
    if (busy.current) return;
    if (!latest.current.canGo(dir)) {
      if (fromX) await run(fromX, 0, 200);
      return;
    }
    busy.current = true;
    const width = ref.current?.offsetWidth || window.innerWidth;
    await run(fromX, -dir * width, 170); // the old page leaves
    latest.current.go(dir);
    await nextFrame(); // React renders the new page into the same element, still off screen
    await run(dir * width, 0, 230); // and it comes in from the other side
    busy.current = false;
  };

  const handlers = {
    onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      start.current =
        e.touches.length === 1 && !busy.current && !target.closest('[data-noswipe]') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), lock: null, dx: 0 } : null;
    },
    onTouchMove(e: TouchEvent) {
      const s = start.current;
      if (!s || s.lock === 'v') return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!s.lock) {
        if (Math.abs(dx) > LOCK_PX && Math.abs(dx) > Math.abs(dy)) s.lock = 'h';
        else if (Math.abs(dy) > LOCK_PX) s.lock = 'v'; // a scroll: leave it to the page
        else return;
      }
      s.dx = latest.current.canGo(dx < 0 ? 1 : -1) ? dx : dx * EDGE_RESISTANCE;
      setX(s.dx);
    },
    onTouchEnd(e: TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s || s.lock !== 'h') return;
      const dx = e.changedTouches[0].clientX - s.x;
      const width = ref.current?.offsetWidth || window.innerWidth;
      const fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.45; // px per ms: a flick
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      if (Math.abs(dx) > width * 0.22 || (fast && Math.abs(dx) > 40)) void slide(dir, s.dx);
      else void run(s.dx, 0, 200);
    },
    onTouchCancel() {
      const s = start.current;
      start.current = null;
      if (s?.lock === 'h') void run(s.dx, 0, 200);
    },
  };

  return { ref, handlers, slide: (dir) => void slide(dir) };
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
