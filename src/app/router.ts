/**
 * Tiny hash router (as in Iron). Screens are `#/`, `#/radar`, `#/dag/<index>` and
 * `#/locaties`. The hash needs no server rewrites and keeps the history usable.
 */
import { useSyncExternalStore } from 'react';

export type Route = { name: 'today' } | { name: 'radar' } | { name: 'day'; index: number } | { name: 'locations'; focus?: boolean };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(query);
  switch (parts[0]) {
    case 'radar':
      return { name: 'radar' };
    case 'dag': {
      const i = Number(parts[1]);
      return { name: 'day', index: Number.isInteger(i) && i >= 0 ? i : 0 };
    }
    case 'locaties':
      return { name: 'locations', focus: q.get('zoek') === '1' };
    default:
      return { name: 'today' };
  }
}

export function toHash(r: Route): string {
  switch (r.name) {
    case 'today':
      return '#/';
    case 'radar':
      return '#/radar';
    case 'day':
      return `#/dag/${r.index}`;
    case 'locations':
      return r.focus ? '#/locaties?zoek=1' : '#/locaties';
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

const snapshot = () => window.location.hash;

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, snapshot, () => ''));
}

interface EntryState {
  app?: boolean; // pushed by navigate(): the entry below it belongs to this app
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const h = toHash(r);
  if (window.location.hash === h || (h === '#/' && window.location.hash === '')) return;
  const url = `${window.location.pathname}${window.location.search}${h}`;
  if (opts.replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState({ app: true } satisfies EntryState, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Back to the previous screen when it is ours, otherwise to Vandaag. */
export function back(): void {
  const st = window.history.state as EntryState | null;
  if (st?.app) window.history.back();
  else navigate({ name: 'today' }, { replace: true });
}
