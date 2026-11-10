import maplibregl, {
  GeoJSONSource,
  IControl,
  LngLatBounds,
  Map,
  MapOptions,
  PaddingOptions,
  StyleSpecification,
} from 'maplibre-gl';
import { attachTooltip } from '@iotility/shared-ui';
import { environment } from '../../../environments/environment';

export type LatLng = [number, number];

// Timezone-driven default map center: resolves the user's IANA timezone to a
// geographic [lat, lng] so maps open on their region (no hardcoded country).
export function timezoneCenter(): LatLng {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byName: Record<string, LatLng> = {
    'Europe/London': [51.507, -0.127],
    'Europe/Paris': [48.857, 2.352],
    'Europe/Berlin': [52.52, 13.405],
    'Europe/Madrid': [40.416, -3.703],
    'Europe/Rome': [41.902, 12.453],
    'Asia/Karachi': [24.861, 67.01],
    'Asia/Dubai': [25.204, 55.27],
    'Asia/Tehran': [35.689, 51.389],
    'Asia/Kolkata': [22.572, 88.364],
    'Asia/Dhaka': [23.685, 90.356],
    'Asia/Shanghai': [31.23, 121.47],
    'Asia/Hong_Kong': [22.319, 114.169],
    'Asia/Singapore': [1.352, 103.82],
    'Asia/Tokyo': [35.676, 139.65],
    'Asia/Seoul': [37.566, 126.978],
    'America/New_York': [40.713, -74.006],
    'America/Chicago': [41.878, -87.63],
    'America/Denver': [39.739, -104.99],
    'America/Los_Angeles': [34.052, -118.24],
    'America/Toronto': [43.653, -79.383],
    'America/Mexico_City': [19.432, -99.133],
    'Africa/Cairo': [30.044, 31.236],
    'Africa/Johannesburg': [-26.204, 28.047],
    'Australia/Sydney': [-33.868, 151.209],
    'Australia/Perth': [-31.952, 115.86],
    'UTC': [51.507, -0.127],
    'Etc/UTC': [51.507, -0.127],
    'Etc/GMT': [51.507, -0.127],
  };
  const named = byName[zone];
  if (named) return named;

  // Fallback: derive longitude from the timezone's UTC offset (15° per hour).
  const offsetMinutes = -new Date().getTimezoneOffset();
  const lng = (offsetMinutes / 60) * 15;
  const lat = offsetMinutes >= 0 ? 25 : 40;
  return [lat, lng];
}

// Returns the geographic center of the country associated with the user's IANA
// timezone. Used as the default map center when no markers are present.
export function timezoneCountryCenter(): LatLng {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byName: Record<string, LatLng> = {
    'Europe/London': [54.0, -2.0],        // United Kingdom
    'Europe/Paris': [46.6, 2.2],          // France
    'Europe/Berlin': [51.1, 10.4],        // Germany
    'Europe/Madrid': [40.0, -4.0],        // Spain
    'Europe/Rome': [42.8, 12.8],          // Italy
    'Asia/Karachi': [30.4, 69.3],         // Pakistan
    'Asia/Dubai': [23.4, 53.8],           // UAE
    'Asia/Tehran': [32.4, 53.7],          // Iran
    'Asia/Kolkata': [22.0, 78.0],         // India
    'Asia/Dhaka': [23.7, 90.4],           // Bangladesh
    'Asia/Shanghai': [35.0, 103.0],       // China
    'Asia/Hong_Kong': [22.3, 114.2],      // Hong Kong (China)
    'Asia/Singapore': [1.35, 103.8],      // Singapore
    'Asia/Tokyo': [36.2, 138.3],          // Japan
    'Asia/Seoul': [35.9, 127.8],          // South Korea
    'America/New_York': [40.0, -74.0],    // United States (East Coast representative)
    'America/Chicago': [39.8, -98.5],     // United States (geographic center)
    'America/Denver': [39.8, -98.5],      // United States (geographic center)
    'America/Los_Angeles': [39.8, -98.5], // United States (geographic center)
    'America/Toronto': [45.0, -79.0],     // Canada (Ontario representative)
    'America/Mexico_City': [23.6, -102.5],// Mexico
    'Africa/Cairo': [26.8, 30.8],         // Egypt
    'Africa/Johannesburg': [-28.5, 24.7], // South Africa
    'Australia/Sydney': [-25.3, 133.8],   // Australia
    'Australia/Perth': [-25.3, 133.8],    // Australia
    'UTC': [54.0, -2.0],                  // United Kingdom
    'Etc/UTC': [54.0, -2.0],              // United Kingdom
    'Etc/GMT': [54.0, -2.0],              // United Kingdom
  };
  const named = byName[zone];
  if (named) return named;

  // Fallback: derive longitude from the timezone's UTC offset (15° per hour).
  const offsetMinutes = -new Date().getTimezoneOffset();
  const lng = (offsetMinutes / 60) * 15;
  const lat = offsetMinutes >= 0 ? 25 : 40;
  return [lat, lng];
}
/** A style layer with its `source` omitted — `upsertGeoJson` supplies it. */
export type LayerWithoutSource<T = maplibregl.LayerSpecification> = T extends { source: unknown }
  ? Omit<T, 'source'>
  : T;

/** Highest pixel ratio the map renders at: sharp on retina, without paying for 3x on every frame. */
const MAX_PIXEL_RATIO = 2;
/** Closest zoom on every map: a 5 m scale bar. Roads are drawn to scale up to here. */
export const MAX_ZOOM = 20;

/** The app's --ease-out curve, so the map moves like everything around it. */
export const mapEase = (t: number): number => 1 - (1 - t) ** 5;

/** A CSS-style cubic-bézier timing function (x1, y1, x2, y2), solved for any t in 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const curveX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const curveY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton's method converges in a few steps; bisection covers the flat spots it can't.
    let s = t;
    for (let step = 0; step < 6; step++) {
      const error = curveX(s) - t;
      const slope = slopeX(s);
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }
    if (s < 0 || s > 1 || Math.abs(curveX(s) - t) > 1e-4) {
      let low = 0, high = 1;
      s = t;
      for (let step = 0; step < 24 && Math.abs(curveX(s) - t) > 1e-6; step++) {
        if (curveX(s) < t) low = s; else high = s;
        s = (low + high) / 2;
      }
    }
    return curveY(s);
  };
}

/**
 * Camera travel to a vehicle. Mapped user actions (zoom buttons, panning) keep the snappy
 * ease-out above; a trip across the map instead starts softly, cruises, and settles in slowly,
 * which is how Google and Apple Maps fly: an ease-out start reads as a jump.
 */
export const flightEase = cubicBezier(0.42, 0, 0.18, 1);
/** A short glide between nearby vehicles: moving at once, then a long gentle landing. */
export const glideEase = cubicBezier(0.25, 0.1, 0.2, 1);

// Every camera move in the app goes through these, so they all share one curve.
class IotMap extends maplibregl.Map {
  override easeTo(...[options, eventData]: Parameters<Map['easeTo']>): this {
    return super.easeTo({ easing: mapEase, ...options }, eventData);
  }

  override flyTo(...[options, eventData]: Parameters<Map['flyTo']>): this {
    return super.flyTo({ easing: mapEase, ...options }, eventData);
  }
}

// Map labels are drawn from the page's fonts, and a glyph drawn before its font has
// loaded stays in the fallback for the life of the map. index.html preloads Inter, and
// asking here brings in the semibold family and the extended Latin subset (the sample
// text covers both) well ahead of the first map's tiles.
for (const font of ['400 16px Inter', "600 16px 'Inter SemiBold'"])
  document.fonts.load(font, 'a\u0100').catch(() => undefined);

// Urdu and Arabic names need shaping and right-to-left order, or they draw as disconnected,
// reversed letters. MapLibre's workers fetch the plugin only once such a label first appears.
if (maplibregl.getRTLTextPluginStatus() === 'unavailable')
  void maplibregl
    .setRTLTextPlugin(new URL('/assets/fleetpoint/vendor/mapbox-gl-rtl-text.js', location.origin).href, true)
    .catch(() => undefined);

function styleUrl(dark: boolean): string {
  return dark ? environment.mapDarkStyleUrl : environment.mapLightStyleUrl;
}

/** A theme switch only changes colours, so everything the app has drawn on the map stays put. */
function keepAppLayers(
  previous: StyleSpecification | undefined,
  next: StyleSpecification,
): StyleSpecification {
  if (!previous) return next;
  const themed = Object.fromEntries(next.layers.map((layer) => [layer.id, layer]));
  return {
    ...next,
    sources: { ...previous.sources, ...next.sources },
    layers: previous.layers.map((layer) => themed[layer.id] ?? layer),
  };
}

export function createIotMap(
  container: HTMLElement,
  center: LatLng,
  zoom: number,
  options: Partial<MapOptions> = {},
): Map {
  const map = new IotMap({
    container,
    center: [center[1], center[0]],
    zoom,
    pitch: 0,
    bearing: 0,
    attributionControl: false,
    // In the constructor, not set later: callers reach for map.style the moment they
    // have the map (MapboxOverlay's addControl does), and it must exist by then.
    style: styleUrl(isDark()),
    canvasContextAttributes: { antialias: true },
    pixelRatio: Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
    fadeDuration: 150,
    // The tiles carry no detail past street level, so closer than a 5 m scale bar is an empty
    // canvas, and a moving vehicle crosses the whole screen in a second.
    maxZoom: MAX_ZOOM,
    maxTileCacheZoomLevels: 7,
    refreshExpiredTiles: false,
    ...options,
  });
  map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');
  // Added after the credit, so it sits just above it.
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 88, unit: 'metric' }), 'bottom-right');
  replaceNativeTitles(map.getContainer());
  let darkTheme = isDark();

  // Both styles share their layers, so this is a crossfade rather than a reload.
  // style.load still fires afterwards, which is how each map recolours its own layers.
  const themeObserver = new MutationObserver(() => {
    const nextDarkTheme = isDark();
    if (nextDarkTheme === darkTheme) return;
    darkTheme = nextDarkTheme;
    map.setStyle(styleUrl(nextDarkTheme), { diff: true, transformStyle: keepAppLayers });
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  map.once('remove', () => themeObserver.disconnect());
  return map;
}

export function upsertGeoJson(
  map: Map,
  id: string,
  data: GeoJSON.FeatureCollection | GeoJSON.Feature,
  layers: LayerWithoutSource[],
): void {
  for (const layer of layers) if (map.getLayer(layer.id)) map.removeLayer(layer.id);
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
  for (const layer of layers)
    map.addLayer({ ...layer, source: id } as maplibregl.LayerSpecification);
}

export function removeGeoJson(map: Map, id: string, layerIds: string[]): void {
  for (const layerId of layerIds) if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(id)) map.removeSource(id);
}

// Overlay chrome (zoom/3D/rotate control stacks, search forms, legends and
// playback toolbars) floats above the map, usually hugging a corner. Framing a
// marker set edge-to-edge parks those corner markers underneath the chrome, so
// every fit keeps at least this inset per side. Callers can still request more
// (e.g. the live-tracking details drawer or fullscreen search overlay).
const OVERLAY_INSET = { top: 80, right: 104, bottom: 120, left: 80 };

/** Raises scalar or per-side padding to the overlay-safe minimums. */
export function overlaySafePadding(padding: number | PaddingOptions): PaddingOptions {
  if (typeof padding === 'number') {
    return {
      top: Math.max(padding, OVERLAY_INSET.top),
      right: Math.max(padding, OVERLAY_INSET.right),
      bottom: Math.max(padding, OVERLAY_INSET.bottom),
      left: Math.max(padding, OVERLAY_INSET.left),
    };
  }
  return {
    top: Math.max(padding.top ?? 0, OVERLAY_INSET.top),
    right: Math.max(padding.right ?? 0, OVERLAY_INSET.right),
    bottom: Math.max(padding.bottom ?? 0, OVERLAY_INSET.bottom),
    left: Math.max(padding.left ?? 0, OVERLAY_INSET.left),
  };
}

// `padding` accepts a single value for all sides or per-side insets, so callers
// can reserve room for overlaid panels (e.g. a details drawer) when re-framing.
// Either way the overlay-safe minimums from `overlaySafePadding` apply, keeping
// fitted markers clear of the map controls.
export function fitLatLngs(
  map: Map,
  coordinates: LatLng[],
  padding: number | PaddingOptions = 40,
  maxZoom = 14,
  camera: { pitch?: number; bearing?: number; duration?: number } = {},
): void {
  if (!coordinates.length) return;
  const bounds = new LngLatBounds();
  for (const [lat, lng] of coordinates) bounds.extend([lng, lat]);
  map.fitBounds(bounds, {
    padding: overlaySafePadding(padding),
    maxZoom,
    duration: 700,
    // A move within the current view glides straight there; only a real journey
    // across the map gets flyTo's zoom-out-and-back arc.
    linear: map.getBounds().contains(bounds.getCenter()),
    ...camera,
  });
}

/**
 * Escapes a value for interpolation into popup / marker HTML strings. Backend
 * fields (driver, model, location, reverse-geocoded place, …) flow through
 * `setHTML` / `innerHTML` below, so markup inside the data must be neutralised
 * or it executes as HTML. Covers both text and double-quoted attribute
 * contexts; ordinary values (no `& < > " '`) are returned unchanged, so the
 * rendered output is identical for all legitimate data.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function markerElement(html: string, className = 'iotility-map-marker'): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.innerHTML = html;
  return element;
}

export function popup(text: string): maplibregl.Popup {
  return new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 }).setText(
    text,
  );
}

export function popupHtml(html: string): maplibregl.Popup {
  return new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 20 }).setHTML(
    html,
  );
}

export function circlePolygon(center: LatLng, radiusMeters: number, steps = 64): LatLng[] {
  const [latitude, longitude] = center;
  const latitudeRadius = radiusMeters / 111_320;
  const longitudeRadius = radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const points: LatLng[] = [];
  for (let index = 0; index <= steps; index++) {
    const angle = (index / steps) * Math.PI * 2;
    points.push([
      latitude + Math.sin(angle) * latitudeRadius,
      longitude + Math.cos(angle) * longitudeRadius,
    ]);
  }
  return points;
}

export function lineFeature(
  points: LatLng[],
  properties: GeoJSON.GeoJsonProperties = {},
): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'LineString', coordinates: points.map(([lat, lng]) => [lng, lat]) },
  };
}

export function polygonFeature(
  points: LatLng[],
  properties: GeoJSON.GeoJsonProperties = {},
): GeoJSON.Feature {
  const coordinates = points.map(([lat, lng]) => [lng, lat]);
  if (coordinates.length && coordinates.at(-1)?.join() !== coordinates[0].join())
    coordinates.push([...coordinates[0]]);
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [coordinates] } };
}

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

/** The edge under a route line, which keeps it readable on any road in either theme. */
export function routeCasingColor(): string {
  return isDark() ? '#0e0c14' : '#ffffff';
}

function replaceNativeTitles(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('button[title]').forEach((button) => {
    const label = button.title;
    button.removeAttribute('title');
    attachTooltip(button, label, 'left');
  });
}

class ThreeDimensionalControl implements IControl {
  private map?: Map;
  private container?: HTMLElement;

  onAdd(map: Map): HTMLElement {
    this.map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Toggle 3D view');
    button.textContent = '3D';
    button.style.cssText = 'font:700 10px Inter,sans-serif;width:29px';
    attachTooltip(button, 'Toggle 3D view', 'left');
    button.addEventListener('click', () => {
      const enabled = map.getPitch() > 10;
      map.easeTo({ pitch: enabled ? 0 : 55, bearing: enabled ? 0 : -18, duration: 600 });
      button.classList.toggle('active', !enabled);
    });
    container.append(button);
    this.container = container;
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.map = undefined;
  }
}

interface LocationSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

class LocationSearchControl implements IControl {
  private map?: Map;
  private container?: HTMLElement;
  private results?: HTMLElement;
  private input?: HTMLInputElement;
  private marker?: maplibregl.Marker;
  private request?: AbortController;
  private debounce?: ReturnType<typeof setTimeout>;
  private matches: LocationSearchResult[] = [];

  onAdd(map: Map): HTMLElement {
    this.map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl iotility-map-search';
    container.style.cssText =
      'position:relative;width:min(18rem,calc(100vw - 5rem));font:500 12px Inter,sans-serif';

    const form = document.createElement('form');
    form.style.cssText =
      'display:flex;align-items:center;height:38px;border:1px solid rgba(148,163,184,.45);border-radius:11px;background:rgba(255,255,255,.96);box-shadow:0 5px 18px rgba(15,23,42,.14);overflow:hidden;backdrop-filter:blur(8px)';
    const icon = document.createElement('span');
    icon.textContent = '⌕';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'padding-left:11px;color:#64748b;font-size:18px;line-height:1';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search a location';
    input.setAttribute('aria-label', 'Search map location');
    input.autocomplete = 'off';
    input.style.cssText =
      'min-width:0;flex:1;border:0;outline:0;background:transparent;padding:0 11px;color:#263445;font:500 12px Inter,sans-serif';
    form.append(icon, input);

    const results = document.createElement('div');
    results.hidden = true;
    results.style.cssText =
      'position:absolute;top:44px;left:0;right:0;max-height:240px;overflow:auto;border:1px solid rgba(148,163,184,.35);border-radius:11px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.18)';
    container.append(form, results);

    input.addEventListener('input', () => {
      clearTimeout(this.debounce);
      const query = input.value.trim();
      if (query.length < 3) {
        this.matches = [];
        results.hidden = true;
        return;
      }
      this.debounce = setTimeout(() => void this.search(query), 300);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') results.hidden = true;
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.matches[0]) this.select(this.matches[0]);
      else if (input.value.trim().length >= 3) void this.search(input.value.trim(), true);
    });
    container.addEventListener('mousedown', (event) => event.stopPropagation());
    container.addEventListener('touchstart', (event) => event.stopPropagation());

    this.container = container;
    this.results = results;
    this.input = input;
    return container;
  }

  private async search(query: string, selectFirst = false): Promise<void> {
    this.request?.abort();
    this.request = new AbortController();
    try {
      const url = new URL(`${environment.nominatimBaseUrl}/search`);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '6');
      url.searchParams.set('addressdetails', '1');
      const response = await fetch(url, { signal: this.request.signal });
      if (!response.ok) throw new Error(`Location search failed: ${response.status}`);
      this.matches = (await response.json()) as LocationSearchResult[];
      if (selectFirst && this.matches[0]) this.select(this.matches[0]);
      else this.renderResults();
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') this.matches = [];
      this.renderResults();
    }
  }

  private renderResults(): void {
    if (!this.results) return;
    this.results.replaceChildren();
    if (!this.matches.length) {
      this.results.hidden = true;
      return;
    }
    for (const result of this.matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = result.display_name;
      button.style.cssText =
        'display:block;width:100%;cursor:pointer;border:0;border-bottom:1px solid #eef2f7;background:#fff;padding:9px 11px;text-align:left;color:#334155;font:500 11px/1.35 Inter,sans-serif';
      button.addEventListener('mouseenter', () => (button.style.background = '#f4f7fb'));
      button.addEventListener('mouseleave', () => (button.style.background = '#fff'));
      button.addEventListener('click', () => this.select(result));
      this.results.append(button);
    }
    this.results.hidden = false;
  }

  private select(result: LocationSearchResult): void {
    const lng = Number(result.lon);
    const lat = Number(result.lat);
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (this.input) this.input.value = result.display_name;
    if (this.results) this.results.hidden = true;
    this.marker?.remove();
    this.marker = new maplibregl.Marker({ color: '#7c3aed' }).setLngLat([lng, lat]).addTo(this.map);
    this.map.flyTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), 14), duration: 900 });
  }

  onRemove(): void {
    clearTimeout(this.debounce);
    this.request?.abort();
    this.marker?.remove();
    this.container?.remove();
    this.map = undefined;
  }
}
