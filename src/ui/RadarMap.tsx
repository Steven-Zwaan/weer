/**
 * The radar map (§2.2, §6.3): Leaflet on OpenStreetMap tiles with one Buienradar image overlay
 * per forecast step. Every overlay is on the map from the start so it is loaded before it is
 * shown; only the current one is visible. Hidden ones use `visibility: hidden` rather than
 * opacity 0, so a phone does not composite two dozen map-sized layers.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RADAR_BOUNDS, type RadarFrame } from '@/api/buienradar';

const ZOOM = 10; // about 35-40 km across a phone-wide map at Dutch latitudes

interface Props {
  lat: number;
  lon: number;
  frames: RadarFrame[];
  frame: number | null; // time of the frame to show
  label: string;
}

export function RadarMap({ lat, lon, frames, frame, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.LayerGroup | null>(null);
  const overlays = useRef(new Map<number, L.ImageOverlay>());

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [lat, lon], zoom: ZOOM, minZoom: 6, maxZoom: 13, zoomControl: false, attributionControl: false });
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(m);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'osm-tiles',
      crossOrigin: true,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bijdragers',
    }).addTo(m);
    map.current = m;
    // The map grows and shrinks with the chart sheet: keep Leaflet's size in step (a ResizeObserver
    // reports at most once per frame) and keep the centre, the location, in the middle of what stays visible.
    const ro = new ResizeObserver(() => m.invalidateSize({ pan: true, debounceMoveend: true }));
    ro.observe(el.current);
    const layers = overlays.current;
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      marker.current = null;
      layers.clear();
    };
    // Created once; centre changes are handled below.
  }, []);

  // Centre and the location dot (accent with a halo).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setView([lat, lon], m.getZoom() || ZOOM);
    marker.current?.remove();
    marker.current = L.layerGroup([
      L.circleMarker([lat, lon], { radius: 18, stroke: false, fillColor: '#2b6fd6', fillOpacity: 0.18, interactive: false }),
      L.circleMarker([lat, lon], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2b6fd6', fillOpacity: 1, interactive: false }),
    ]).addTo(m);
  }, [lat, lon]);

  // One overlay per frame; frames that left the list go away.
  const key = frames.map((f) => f.time).join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const want = new Map(frames.map((f) => [f.time, f.url]));
    for (const [t, layer] of overlays.current) {
      if (!want.has(t)) {
        layer.remove();
        overlays.current.delete(t);
      }
    }
    for (const [t, url] of want) {
      if (overlays.current.has(t)) continue;
      const layer = L.imageOverlay(url, RADAR_BOUNDS, { crossOrigin: true, interactive: false, className: 'radar-frame', attribution: 'Radar: Buienradar' });
      layer.addTo(m);
      const img = layer.getElement();
      if (img) img.style.visibility = 'hidden';
      overlays.current.set(t, layer);
    }
  }, [key]);

  // Show the current frame.
  useEffect(() => {
    for (const [t, layer] of overlays.current) {
      const img = layer.getElement();
      if (img) img.style.visibility = t === frame ? 'visible' : 'hidden';
    }
  }, [frame, key]);

  return <div ref={el} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }} />;
}
