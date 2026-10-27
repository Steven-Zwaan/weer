/**
 * Locaties (§2.4): search and add places, open one, and in edit mode remove or reorder
 * them. The GPS location is always first and can be neither removed nor moved.
 */
import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Location } from '@/domain/types';
import { placeLine } from '@/domain/locations';
import { searchPlaces } from '@/api/geocoding';
import { useLocations, useStore } from '@/app/store';
import { useNow } from '@/app/hooks';
import { back } from '@/app/router';
import { LocationCard } from '@/ui/LocationCard';
import { IconGrip, IconLocation, IconPlus, IconRemove, IconSearch } from '@/ui/Icons';

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function useSearch(query: string) {
  const [results, setResults] = useState<Location[] | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setState('idle');
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setState('busy');
      searchPlaces(q, ctrl.signal).then(
        (r) => {
          setResults(r);
          setState('idle');
        },
        () => {
          if (!ctrl.signal.aborted) setState('error');
        },
      );
    }, 300); // debounce (§2.4)
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);
  return { results, state };
}

/**
 * "Gebruik mijn locatie" when the GPS location is not in the list: asks for access again and
 * goes straight to it once there is a fix; otherwise says where iOS keeps the setting.
 */
function UseMyLocation({ onFound }: { onFound(): void }) {
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const run = () => {
    setState('busy');
    const unsubscribe = useStore.subscribe((s) => {
      if (!s.gps) return;
      unsubscribe();
      onFound();
    });
    void useStore
      .getState()
      .locate()
      .then(() => {
        if (useStore.getState().gps) return;
        unsubscribe();
        setState('failed');
      });
  };
  return (
    <>
      <button type="button" className="result card" style={{ borderRadius: 18 }} onClick={run} disabled={state === 'busy'}>
        <IconLocation />
        <span>{state === 'busy' ? 'Locatie bepalen…' : 'Gebruik mijn locatie'}</span>
      </button>
      {state === 'failed' && (
        <p className="footnote" style={{ margin: 0, padding: '0 4px' }}>
          Geen toegang tot je locatie. Op de iPhone: Instellingen › Privacy en beveiliging › Locatievoorzieningen › Safari-websites › Bij gebruik van app.
        </p>
      )}
    </>
  );
}

function SortableCard({ location, editing, now, onOpen, onRemove }: { location: Location; editing: boolean; now: number; onOpen(): void; onRemove(): void }) {
  const entry = useStore((s) => s.entries[location.id]);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: location.id, disabled: !editing });
  return (
    <LocationCard
      innerRef={setNodeRef}
      location={location}
      entry={entry}
      now={now}
      onOpen={onOpen}
      editing={editing}
      className={isDragging ? 'dragging' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      before={
        editing && (
          <button type="button" className="editbtn" onClick={onRemove} aria-label={`Verwijder ${location.name}`}>
            <IconRemove />
          </button>
        )
      }
      after={
        editing && (
          <button type="button" ref={setActivatorNodeRef} className="editbtn grip" aria-label={`Verplaats ${location.name}`} {...attributes} {...listeners}>
            <IconGrip />
          </button>
        )
      }
    />
  );
}

export function Locations({ focus }: { focus?: boolean }) {
  const locations = useLocations();
  const gps = useStore((s) => s.gps);
  const saved = useStore((s) => s.saved);
  const gpsEntry = useStore((s) => (gps ? s.entries[gps.id] : undefined));
  const { addPlace, removePlace, movePlace, setActive, showMyLocation, refresh } = useStore.getState();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const { results, state } = useSearch(query);
  const input = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    void refresh();
  }, [refresh]);
  // Focus the search on arrival when asked to, or when there is nothing to pick yet (§8).
  const nothingYet = locations.length === 0;
  useEffect(() => {
    if (focus || nothingYet) input.current?.focus();
  }, [focus, nothingYet]);

  const open = (i: number) => {
    setActive(i);
    back();
  };
  const add = (loc: Location) => {
    addPlace(loc);
    setQuery('');
    back();
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = saved.findIndex((l) => l.id === e.active.id);
    const to = saved.findIndex((l) => l.id === e.over!.id);
    if (from >= 0 && to >= 0) movePlace(from, to);
  };
  const offset = gps ? 1 : 0;
  const searching = query.trim().length >= 2;

  return (
    <main className="screen sub" style={{ gap: 12 }}>
      <div className="topbar" style={{ justifyContent: 'flex-end' }}>
        {saved.length > 0 && (
          <button type="button" className="textbtn" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
            {editing ? 'Gereed' : 'Wijzig'}
          </button>
        )}
      </div>
      <h1 className="loc-title">Locaties</h1>

      <div className="search">
        <label htmlFor="loc-search" className="sr-only">
          Zoek een plaats
        </label>
        <IconSearch />
        <input
          id="loc-search"
          ref={input}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Zoek een plaats of postcode"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results?.[0]) add(results[0]);
          }}
        />
      </div>

      {searching && (
        <div className="results" aria-live="polite">
          {results && results.length > 0 ? (
            results.map((r) => (
              <button key={r.id} type="button" className="result" onClick={() => add(r)}>
                <IconPlus />
                <span aria-label={placeLine(r)}>
                  {r.name}
                  {r.admin ? `, ${r.admin}` : ''} <small>· {r.country}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="result" style={{ color: 'var(--muted)', cursor: 'default' }}>
              {state === 'busy' || results === null ? 'Zoeken…' : state === 'error' ? 'Zoeken lukt nu niet' : 'Geen plaats gevonden'}
            </div>
          )}
        </div>
      )}

      {!searching && (
        <div className="loccards">
          {!gps && !editing && (
            <UseMyLocation
              onFound={() => {
                showMyLocation();
                back();
              }}
            />
          )}
          {gps && (
            <LocationCard
              location={gps}
              entry={gpsEntry}
              now={now}
              onOpen={() => {
                showMyLocation(); // straight to it, with a fresh fix on the way
                back();
              }}
              editing={editing}
            />
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
            <SortableContext items={saved.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {saved.map((l, i) => (
                <SortableCard key={l.id} location={l} editing={editing} now={now} onOpen={() => open(i + offset)} onRemove={() => removePlace(l.id)} />
              ))}
            </SortableContext>
          </DndContext>
          {locations.length === 0 && <p className="footnote" style={{ margin: 0, padding: '0 4px' }}>Zoek een plaats om te beginnen. Geef je locatietoegang, dan staat je eigen plek hier ook.</p>}
        </div>
      )}
    </main>
  );
}
