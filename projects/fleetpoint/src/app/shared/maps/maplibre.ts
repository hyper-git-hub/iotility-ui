import maplibregl, {
  GeoJSONSource,
  IControl,
  LngLatBounds,
  Map,
  MapOptions,
} from 'maplibre-gl';
import { attachTooltip } from '@iotility/shared-ui';
import { environment } from '../../../environments/environment';

export type LatLng = [number, number];
type LayerWithoutSource<T = maplibregl.LayerSpecification> =
  T extends { source: unknown } ? Omit<T, 'source'> : T;

const BUILDINGS_LAYER = 'iotility-3d-buildings';

export function createIotMap(
  container: HTMLElement,
  center: LatLng,
  zoom: number,
  options: Partial<MapOptions> = {},
): Map {
  const map = new maplibregl.Map({
    container,
    center: [center[1], center[0]],
    zoom,
    pitch: 0,
    bearing: 0,
    attributionControl: false,
    canvasContextAttributes: { antialias: true },
    style: isDark() ? environment.mapDarkStyleUrl : environment.mapLightStyleUrl,
    ...options,
  });
  map.addControl(new LocationSearchControl(), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new ThreeDimensionalControl(), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  replaceNativeTitles(map.getContainer());
  let darkTheme = isDark();

  const configureStyle = () => {
    applyEnglishLabels(map);
    applyFleetMapStyle(map, isDark());
    addThreeDimensionalBuildings(map);
    applyAtmosphere(map, isDark());
  };
  map.on('style.load', configureStyle);

  const themeObserver = new MutationObserver(() => {
    const nextDarkTheme = isDark();
    if (nextDarkTheme === darkTheme) return;
    darkTheme = nextDarkTheme;
    const nextStyle = nextDarkTheme ? environment.mapDarkStyleUrl : environment.mapLightStyleUrl;
    map.setStyle(nextStyle, { diff: false });
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

export function fitLatLngs(
  map: Map,
  coordinates: LatLng[],
  padding = 40,
  maxZoom = 14,
): void {
  if (!coordinates.length) return;
  const bounds = new LngLatBounds();
  for (const [lat, lng] of coordinates) bounds.extend([lng, lat]);
  map.fitBounds(bounds, { padding, maxZoom, duration: 700 });
}

export function markerElement(html: string, className = 'iotility-map-marker'): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.innerHTML = html;
  return element;
}

export function popup(text: string): maplibregl.Popup {
  return new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 }).setText(text);
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

export function lineFeature(points: LatLng[], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature {
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

function applyEnglishLabels(map: Map): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || !layer.layout?.['text-field']) continue;
    const textField = JSON.stringify(layer.layout['text-field']);
    if (!textField.includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', [
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name_en'],
      ['get', 'name:latin'],
      '',
    ]);
  }
}

function applyFleetMapStyle(map: Map, dark: boolean): void {
  const paint = (layerId: string, property: string, value: unknown) => {
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
  };
  const layout = (layerId: string, property: string, value: unknown) => {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, property, value);
  };

  // Cooler, higher-contrast "control room" palette — dark mode leans near-black
  // navy so live vehicle markers / trail glows pop; light mode leans crisp
  // slate so geozone fills and POI pins read clearly against roads.
  const palette = dark
    ? {
        canvas: '#0b0f19', residential: '#141b2e', water: '#0d3856', waterLine: '#2f8fc4',
        park: '#123a2e', grass: '#163f2f', wood: '#102e26', wetland: '#123531', sand: '#332c1f',
        hospital: '#3a2230', school: '#1c2740', building: '#1f2937', buildingEdge: '#2f3b52',
        boundary: '#475569', label: '#f1f5f9', mutedLabel: '#94a3b8', halo: 'rgba(11,15,25,0.92)',
        motorway: '#3b82f6', motorwayCase: '#16233a', primary: '#60a5fa', primaryCase: '#20304a',
        secondary: '#3c4a63', secondaryCase: '#1c2637', local: '#2a3548', localCase: '#182130',
        path: '#475569', rail: '#64748b', runway: '#2d3648',
      }
    : {
        canvas: '#f8fafc', residential: '#eef1f6', water: '#a8d8f0', waterLine: '#5bb8e0',
        park: '#c8ecd4', grass: '#dcf3e1', wood: '#bfe4c8', wetland: '#cfeee7', sand: '#f6edd9',
        hospital: '#fde3e9', school: '#e6edfb', building: '#e4e8ee', buildingEdge: '#cfd7e2',
        boundary: '#94a3b8', label: '#1e293b', mutedLabel: '#64748b', halo: 'rgba(255,255,255,0.94)',
        motorway: '#2563eb', motorwayCase: '#c3d7f0', primary: '#3b82f6', primaryCase: '#d6e4f7',
        secondary: '#dbe8fa', secondaryCase: '#c7d8ee', local: '#ffffff', localCase: '#dde4ec',
        path: '#c2cad4', rail: '#94a3b8', runway: '#d8dee7',
      };

  paint('background', 'background-color', palette.canvas);
  paint('landuse_residential', 'fill-color', palette.residential);
  paint('water', 'fill-color', palette.water);
  for (const id of ['waterway_river', 'waterway_other', 'waterway_tunnel'])
    paint(id, 'line-color', palette.waterLine);
  paint('park', 'fill-color', palette.park);
  paint('park_outline', 'line-color', dark ? '#2b5b49' : '#a9d7b6');
  paint('landcover_grass', 'fill-color', palette.grass);
  paint('landcover_wood', 'fill-color', palette.wood);
  paint('landcover_wetland', 'fill-color', palette.wetland);
  paint('landcover_sand', 'fill-color', palette.sand);
  paint('landuse_hospital', 'fill-color', palette.hospital);
  paint('landuse_school', 'fill-color', palette.school);
  paint('building', 'fill-color', palette.building);
  paint('building', 'fill-outline-color', palette.buildingEdge);
  paint('aeroway_fill', 'fill-color', palette.runway);
  paint('aeroway_runway', 'line-color', palette.runway);
  paint('aeroway_taxiway', 'line-color', palette.runway);
  for (const id of ['boundary_2', 'boundary_3', 'boundary_disputed']) {
    paint(id, 'line-color', palette.boundary);
    paint(id, 'line-dasharray', [3, 2]); // modern dashed admin boundaries instead of solid lines
  }

  const roadKinds: Array<[string, string, string, unknown, unknown]> = [
    ['motorway', palette.motorway, palette.motorwayCase,
      ['interpolate', ['linear'], ['zoom'], 6.5, 0.45, 9, 1.3, 12, 3.2, 14, 6, 18, 18],
      ['interpolate', ['linear'], ['zoom'], 6.5, 0.9, 9, 2, 12, 4.5, 14, 8, 18, 21]],
    ['motorway_link', palette.motorway, palette.motorwayCase,
      ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 4, 18, 11],
      ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 6, 18, 14]],
    ['trunk_primary', palette.primary, palette.primaryCase,
      ['interpolate', ['linear'], ['zoom'], 8, 0.5, 11, 1.8, 14, 5, 18, 15],
      ['interpolate', ['linear'], ['zoom'], 8, 1, 11, 3, 14, 7, 18, 18]],
    ['secondary_tertiary', palette.secondary, palette.secondaryCase,
      ['interpolate', ['linear'], ['zoom'], 9, 0.7, 12, 1.8, 15, 4, 18, 11],
      ['interpolate', ['linear'], ['zoom'], 9, 1.4, 12, 3, 15, 6, 18, 14]],
    ['minor', palette.local, palette.localCase,
      ['interpolate', ['linear'], ['zoom'], 12, 0.6, 15, 2.2, 18, 7],
      ['interpolate', ['linear'], ['zoom'], 12, 1.2, 15, 3.4, 18, 9]],
    ['street', palette.local, palette.localCase,
      ['interpolate', ['linear'], ['zoom'], 12, 0.7, 15, 2.4, 18, 7.5],
      ['interpolate', ['linear'], ['zoom'], 12, 1.3, 15, 3.6, 18, 9.5]],
    ['service_track', palette.local, palette.localCase,
      ['interpolate', ['linear'], ['zoom'], 13, 0.5, 16, 1.6, 19, 5],
      ['interpolate', ['linear'], ['zoom'], 13, 1, 16, 2.5, 19, 6.5]],
    ['link', palette.primary, palette.primaryCase,
      ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 3.5, 18, 10],
      ['interpolate', ['linear'], ['zoom'], 10, 1.6, 14, 5.5, 18, 13]],
  ];
  for (const prefix of ['road', 'bridge', 'tunnel']) {
    for (const [kind, roadColor, casingColor, width, casingWidth] of roadKinds) {
      paint(`${prefix}_${kind}`, 'line-color', roadColor);
      paint(`${prefix}_${kind}`, 'line-width', width);
      layout(`${prefix}_${kind}`, 'line-cap', 'round');
      layout(`${prefix}_${kind}`, 'line-join', 'round');
      paint(`${prefix}_${kind}_casing`, 'line-color', casingColor);
      paint(`${prefix}_${kind}_casing`, 'line-width', casingWidth);
      layout(`${prefix}_${kind}_casing`, 'line-cap', 'round');
      layout(`${prefix}_${kind}_casing`, 'line-join', 'round');
    }
    // Faint glow on motorways so live-tracking trails/markers riding on top read as "on the highway", not floating.
    paint(`${prefix}_motorway`, 'line-blur', 0.3);
  }

  const roadMinZooms: Array<[string, number]> = [
    ['motorway', 6.5],
    ['motorway_link', 9],
    ['trunk_primary', 8],
    ['secondary_tertiary', 10],
    ['link', 10],
    ['minor', 11.5],
    ['street', 12],
    ['service_track', 13.5],
    ['path_pedestrian', 14],
  ];
  for (const prefix of ['road', 'bridge', 'tunnel']) {
    for (const [kind, minZoom] of roadMinZooms) {
      for (const suffix of ['', '_casing']) {
        const id = `${prefix}_${kind}${suffix}`;
        if (map.getLayer(id)) map.setLayerZoomRange(id, minZoom, 24);
      }
    }
  }

  for (const prefix of ['road', 'bridge', 'tunnel']) {
    paint(`${prefix}_path_pedestrian`, 'line-color', palette.path);
    paint(`${prefix}_major_rail`, 'line-color', palette.rail);
    paint(`${prefix}_transit_rail`, 'line-color', palette.rail);
  }

  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || !layer.layout?.['text-field']) continue;
    paint(layer.id, 'text-halo-color', palette.halo);
    paint(layer.id, 'text-halo-width', layer.id.startsWith('label_') ? 1.8 : 1.4);
    paint(layer.id, 'text-halo-blur', 0.4);
    if (layer.id.startsWith('label_')) paint(layer.id, 'text-color', palette.label);
    if (layer.id.startsWith('highway-name')) paint(layer.id, 'text-color', palette.mutedLabel);
  }

  for (const [id, minZoom] of [['poi_r1', 7.5], ['poi_r7', 8.5], ['poi_r20', 9.5], ['poi_transit', 7.5]] as const) {
    if (!map.getLayer(id)) continue;
    map.setLayerZoomRange(id, minZoom, 24);
    paint(id, 'text-color', palette.label);
    paint(id, 'icon-opacity', 1);
    paint(id, 'text-opacity', 1);
    layout(id, 'text-size', ['interpolate', ['linear'], ['zoom'], 8, 9, 13, 10, 17, 12]);
    layout(id, 'text-padding', 0.5);
    layout(id, 'icon-padding', 0.5);
    layout(id, 'text-optional', false);
    layout(id, 'icon-optional', true);
    layout(id, 'text-variable-anchor', ['top', 'bottom', 'left', 'right', 'top-left', 'top-right']);
    layout(id, 'text-radial-offset', 0.65);
    layout(id, 'text-justify', 'auto');
  }

  for (const [id, minZoom] of [
    ['label_city_capital', 3],
    ['label_city', 4],
    ['label_town', 6],
    ['label_village', 8],
    ['label_other', 8.5],
    ['highway-name-major', 8],
    ['highway-name-minor', 11],
  ] as const) {
    if (map.getLayer(id)) map.setLayerZoomRange(id, minZoom, 24);
  }

  // OpenFreeMap's defaults leave generous collision boxes. Fleet maps benefit
  // from seeing districts, nearby settlements and road names one zoom earlier.
  for (const id of ['label_other', 'label_village', 'label_town', 'label_city', 'label_city_capital']) {
    if (!map.getLayer(id)) continue;
    layout(id, 'text-padding', 1);
    layout(id, 'icon-optional', true);
    layout(id, 'text-variable-anchor', ['center', 'top', 'bottom', 'left', 'right']);
    layout(id, 'text-radial-offset', 0.35);
    layout(id, 'text-justify', 'auto');
  }

  for (const id of ['highway-name-major', 'highway-name-minor', 'highway-name-path']) {
    if (!map.getLayer(id)) continue;
    layout(id, 'text-padding', 1);
    layout(id, 'symbol-spacing', id === 'highway-name-major' ? 180 : 220);
  }
}

function replaceNativeTitles(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('button[title]').forEach((button) => {
    const label = button.title;
    button.removeAttribute('title');
    attachTooltip(button, label, 'left');
  });
}

function addThreeDimensionalBuildings(map: Map): void {
  if (map.getLayer(BUILDINGS_LAYER) || !map.getSource('openmaptiles')) return;
  const labelLayer = map
    .getStyle()
    .layers?.find((layer) => layer.type === 'symbol' && 'layout' in layer && layer.layout?.['text-field']);
  map.addLayer(
    {
      id: BUILDINGS_LAYER,
      source: 'openmaptiles',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': isDark() ? '#25324a' : '#dde3ec',
        'fill-extrusion-height': [
          'interpolate', ['linear'], ['zoom'],
          13, 0,
          14, ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 6],
        ],
        'fill-extrusion-base': [
          'interpolate', ['linear'], ['zoom'],
          13, 0,
          14, ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0],
        ],
        'fill-extrusion-opacity': 0.9,
        // Vertical gradient + AO give buildings real form instead of flat cardboard cutouts.
        // Guarded properties below (added post-load) no-op silently on older MapLibre.
        'fill-extrusion-vertical-gradient': true,
      },
    },
    labelLayer?.id,
  );

  try {
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-ambient-occlusion-intensity', 0.3);
    map.setPaintProperty(BUILDINGS_LAYER, 'fill-extrusion-ambient-occlusion-radius', 3);
  } catch {
    // Older MapLibre versions don't support AO on fill-extrusion — safe to ignore.
  }
}

function applyAtmosphere(map: Map, dark: boolean): void {
  // Subtle sky so the 3D tilt (see ThreeDimensionalControl) doesn't cut to flat void at the horizon.
  try {
    map.setSky({
      'sky-color': dark ? '#0b0f19' : '#cfe3f7',
      'horizon-color': dark ? '#111827' : '#eef4fb',
      'fog-color': dark ? '#0b0f19' : '#f8fafc',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.6,
      'sky-horizon-blend': 0.8,
      'atmosphere-blend': dark ? 0.3 : 0.15,
    });
  } catch {
    // Sky/fog API isn't in every MapLibre version — degrade gracefully to a flat backdrop.
  }
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
    container.style.cssText = 'position:relative;width:min(18rem,calc(100vw - 5rem));font:500 12px Inter,sans-serif';

    const form = document.createElement('form');
    form.style.cssText = 'display:flex;align-items:center;height:38px;border:1px solid rgba(148,163,184,.45);border-radius:11px;background:rgba(255,255,255,.96);box-shadow:0 5px 18px rgba(15,23,42,.14);overflow:hidden;backdrop-filter:blur(8px)';
    const icon = document.createElement('span');
    icon.textContent = '⌕';
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'padding-left:11px;color:#64748b;font-size:18px;line-height:1';
    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search a location';
    input.setAttribute('aria-label', 'Search map location');
    input.autocomplete = 'off';
    input.style.cssText = 'min-width:0;flex:1;border:0;outline:0;background:transparent;padding:0 11px;color:#263445;font:500 12px Inter,sans-serif';
    form.append(icon, input);

    const results = document.createElement('div');
    results.hidden = true;
    results.style.cssText = 'position:absolute;top:44px;left:0;right:0;max-height:240px;overflow:auto;border:1px solid rgba(148,163,184,.35);border-radius:11px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.18)';
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
      button.style.cssText = 'display:block;width:100%;cursor:pointer;border:0;border-bottom:1px solid #eef2f7;background:#fff;padding:9px 11px;text-align:left;color:#334155;font:500 11px/1.35 Inter,sans-serif';
      button.addEventListener('mouseenter', () => button.style.background = '#f4f7fb');
      button.addEventListener('mouseleave', () => button.style.background = '#fff');
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
