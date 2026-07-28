import maplibregl, {
  GeoJSONSource,
  IControl,
  LngLatBounds,
  Map,
  MapOptions,
} from 'maplibre-gl';

export type LatLng = [number, number];
type LayerWithoutSource<T = maplibregl.LayerSpecification> =
  T extends { source: unknown } ? Omit<T, 'source'> : T;

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
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
    style: isDark() ? DARK_STYLE : LIGHT_STYLE,
    ...options,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new ThreeDimensionalControl(), 'top-right');
  let darkTheme = isDark();

  const applyThreeDimensionalBuildings = () => addThreeDimensionalBuildings(map);
  map.on('style.load', applyThreeDimensionalBuildings);

  const themeObserver = new MutationObserver(() => {
    const nextDarkTheme = isDark();
    if (nextDarkTheme === darkTheme) return;
    darkTheme = nextDarkTheme;
    const nextStyle = nextDarkTheme ? DARK_STYLE : LIGHT_STYLE;
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
      minzoom: 14,
      paint: {
        'fill-extrusion-color': isDark() ? '#253044' : '#d6d2dc',
        'fill-extrusion-height': [
          'coalesce',
          ['to-number', ['get', 'render_height']],
          ['to-number', ['get', 'height']],
          6,
        ],
        'fill-extrusion-base': [
          'coalesce',
          ['to-number', ['get', 'render_min_height']],
          ['to-number', ['get', 'min_height']],
          0,
        ],
        'fill-extrusion-opacity': 0.82,
      },
    },
    labelLayer?.id,
  );
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
    button.title = 'Toggle 3D view';
    button.setAttribute('aria-label', 'Toggle 3D view');
    button.textContent = '3D';
    button.style.cssText = 'font:700 10px Inter,sans-serif;width:29px';
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
