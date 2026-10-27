/**
 * The radar map (§2.2, §6.3): Leaflet on OpenStreetMap tiles, one KNMI WMS layer per radar
 * frame. Every frame layer stays on the map at opacity 0 so its tiles are loaded before
 * it is shown; switching frames is an opacity change, without flicker.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KNMI_WMS, RADAR_DATASET, RADAR_LAYER, RADAR_STYLE } from '@/api/knmi';
import { wmsTime } from '@/domain/radar';

const ZOOM = 10; // about 35-40 km across a phone-wide map at Dutch latitudes
const SHOWN = 0.85;
const DIMMED = 0.45; // forecast steps: the newest image, faded

interface Props {
  lat: number;
  lon: number;
  frames: number[];
  frame: number | null;
  dimmed: boolean;
  label: string;
}

export function RadarMap({ lat, lon, frames, frame, dimmed, label }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.LayerGroup | null>(null);
  const layers = useRef(new Map<number, L.TileLayer.WMS>());

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
    const frameLayers = layers.current;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
      frameLayers.clear();
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

  // Keep one WMS layer per frame.
  const key = frames.join(',');
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const want = new Set(frames);
    for (const [t, layer] of layers.current) {
      if (!want.has(t)) {
        layer.remove();
        layers.current.delete(t);
      }
    }
    for (const t of frames) {
      if (layers.current.has(t)) continue;
      const layer = L.tileLayer.wms(`${KNMI_WMS}?dataset=${RADAR_DATASET}`, {
        layers: RADAR_LAYER,
        styles: RADAR_STYLE,
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        tileSize: 512,
        opacity: 0,
        crossOrigin: true,
        attribution: 'Radar: KNMI',
        // Unknown options become WMS parameters.
        time: wmsTime(t),
      } as L.WMSOptions);
      layer.addTo(m);
      layers.current.set(t, layer);
    }
  }, [key]);

  // Show the current frame.
  useEffect(() => {
    for (const [t, layer] of layers.current) layer.setOpacity(t === frame ? (dimmed ? DIMMED : SHOWN) : 0);
  }, [frame, dimmed, key]);

  return <div ref={el} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }} />;
}
