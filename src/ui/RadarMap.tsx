/**
 * The radar map (§2.2, §6.3): Leaflet on OpenStreetMap tiles with Buienradar's radar images.
 *
 * The images cover all of NL/BE; at a city zoom one is thousands of CSS pixels across. Placed
 * as image overlays, two dozen of them ran iOS Safari out of memory. So there is one canvas
 * the size of the map, and only the visible part of the current image is drawn on it. All
 * frames are preloaded as small 500 × 512 images; switching steps is one draw.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RADAR_BOUNDS, type RadarFrame } from '@/api/buienradar';

const ZOOM = 10; // about 35-40 km across a phone-wide map at Dutch latitudes
const MAX_DPR = 2; // a radar image is soft anyway; 3x would only cost memory

/** A Leaflet layer: one canvas over the map, drawing the visible part of one radar image. */
class RadarCanvas extends L.Layer {
  private readonly canvas = document.createElement('canvas');
  private image: HTMLImageElement | null = null;
  private host: L.Map | null = null;

  onAdd(map: L.Map): this {
    this.host = map;
    this.canvas.className = 'radar-canvas';
    map.getPane('radar')?.appendChild(this.canvas);
    map.on('move zoom resize viewreset zoomend', this.draw, this);
    // An animated zoom scales the tiles, not this canvas: hide it until the zoom has ended.
    map.on('zoomanim', this.hide, this);
    this.draw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('move zoom resize viewreset zoomend', this.draw, this);
    map.off('zoomanim', this.hide, this);
    this.canvas.remove();
    this.host = null;
    return this;
  }

  /** Show `image`; until it has loaded the previous one stays. */
  show(image: HTMLImageElement | null): void {
    this.image = image;
    if (!image) return this.clear();
    if (image.complete && image.naturalWidth) this.draw();
    else image.addEventListener('load', () => this.image === image && this.draw(), { once: true });
  }

  private hide(): void {
    this.canvas.style.visibility = 'hidden';
  }

  private clear(): void {
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private draw(): void {
    const map = this.host;
    const img = this.image;
    if (!map || !img || !img.complete || !img.naturalWidth) return; // keep what is drawn
    const size = map.getSize();
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const c = this.canvas;
    const w = Math.round(size.x * dpr);
    const h = Math.round(size.y * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      c.style.width = `${size.x}px`;
      c.style.height = `${size.y}px`;
    }
    // The canvas covers the map container; the panes move it along while panning.
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    // Both the image and the map are Web Mercator, so its corners are all it takes.
    const [[south, west], [north, east]] = RADAR_BOUNDS;
    const nw = map.latLngToContainerPoint([north, west]);
    const se = map.latLngToContainerPoint([south, east]);
    ctx.drawImage(img, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    c.style.visibility = 'visible';
  }
}

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
  const radar = useRef<RadarCanvas | null>(null);
  const marker = useRef<L.LayerGroup | null>(null);
  const images = useRef(new Map<number, HTMLImageElement>());

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
    // Radar between the tiles (200) and the location dot (overlay pane, 400).
    const pane = m.createPane('radar');
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';
    const layer = new RadarCanvas({ attribution: 'Radar: Buienradar' });
    layer.addTo(m);
    radar.current = layer;
    map.current = m;
    // The map grows and shrinks with the chart sheet: keep Leaflet's size in step (a ResizeObserver
    // reports at most once per frame) and keep the centre, the location, in the middle of what stays visible.
    const ro = new ResizeObserver(() => m.invalidateSize({ pan: true, debounceMoveend: true }));
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      radar.current = null;
      marker.current = null;
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

  // Preload every frame (small images); frames that left the list are dropped.
  const key = frames.map((f) => f.time).join(',');
  useEffect(() => {
    const want = new Map(frames.map((f) => [f.time, f.url]));
    for (const t of images.current.keys()) if (!want.has(t)) images.current.delete(t);
    for (const [t, url] of want) {
      if (images.current.has(t)) continue;
      const img = new Image();
      img.crossOrigin = 'anonymous'; // a CORS response, so the service worker can cache it
      img.decoding = 'async';
      img.src = url;
      images.current.set(t, img);
    }
  }, [key]);

  // Show the current frame.
  useEffect(() => {
    radar.current?.show(frame === null ? null : (images.current.get(frame) ?? null));
  }, [frame, key]);

  return <div ref={el} role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }} />;
}
