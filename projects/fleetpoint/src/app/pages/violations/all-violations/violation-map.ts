import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import maplibregl, { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { createIotMap, escapeHtml, fitLatLngs, popupHtml, timezoneCenter } from '../../../shared/maps/maplibre';
import { MapControls } from '../../../shared/map-overlays/map-controls';
import { ViolationDisplay } from '../all-violations/all-violations';

const SOURCE_ID = 'violations';
const POINT_LAYER = 'violation-points';
const HALO_LAYER = 'violation-halo';
const CLUSTER_LAYER = 'violation-clusters';
const CLUSTER_COUNT_LAYER = 'violation-cluster-count';
/** Clusters split at this zoom; selecting a violation flies past it. */
const CLUSTER_MAX_ZOOM = 12;
/** Cluster property key → category, in ring order (matches the legend). */
const CLUSTER_CATEGORIES = [
  ['s', 'Speeding'],
  ['b', 'Behaviour'],
  ['f', 'Safety'],
  ['c', 'Compliance'],
  ['g', 'Geozone'],
] as const;
const CLUSTER_ICON_PREFIX = 'violation-cluster|';
/** Donuts are drawn at 2× so they stay sharp on high-density screens. */
const CLUSTER_PIXEL_RATIO = 2;
const SELECTED: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];
/** Heatmap reads its own unclustered copy of the points (a clustered source only exposes the bubbles). */
const HEAT_SOURCE_ID = 'violations-heat';
const HEAT_LAYER = 'violation-heat';
/** Heat counts serious violations more than minor ones. */
const SEVERITY_WEIGHT: Record<string, number> = { Critical: 1, High: 0.75, Medium: 0.5, Low: 0.3 };
export type ViolationMapMode = 'clusters' | 'heat';
const MAP_MODE_STORAGE_KEY = 'fleetpoint:violation-map-mode';
function storedMapMode(): ViolationMapMode {
  try {
    return localStorage.getItem(MAP_MODE_STORAGE_KEY) === 'heat' ? 'heat' : 'clusters';
  } catch {
    return 'clusters';
  }
}

@Component({
  selector: 'app-violation-map',
  imports: [MapControls],
  host: { '[class.is-fullscreen]': 'isFullscreen()' },
  template: `
    <div #map class="map" aria-label="Violation locations"></div>
    <div class="map-overlays">
      <app-map-controls
        class="overlay-controls"
        [fullscreen]="isFullscreen()"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (toggle3D)="onToggle3D()"
        (resetNorth)="onResetNorth()"
        (rotate)="onRotate()"
        (fullscreenToggle)="onFullscreenToggle()"
      />
      <div class="mode-switch" role="group" aria-label="Map view">
        <button type="button" [class.active]="mode() === 'clusters'" [attr.aria-pressed]="mode() === 'clusters'" (click)="setMode('clusters')">Clusters</button>
        <button type="button" [class.active]="mode() === 'heat'" [attr.aria-pressed]="mode() === 'heat'" (click)="setMode('heat')">Heat</button>
      </div>
      @if (mode() === 'heat') {
        <div class="heat-legend" aria-hidden="true"><span>Fewer</span><i></i><span>More</span></div>
      }
    </div>
  `,
  styles: `
    :host,.map{display:block;width:100%;height:100%;min-height:0}
    :host{position:relative}
    :host(.is-fullscreen){position:fixed;inset:0;z-index:1200}
    .map{background:var(--color-brand-50)}
    .map-overlays{pointer-events:none;position:absolute;inset:0;z-index:500}
    .overlay-controls{pointer-events:auto;position:absolute;right:1rem;top:1rem}
    .mode-switch{pointer-events:auto;position:absolute;left:.75rem;top:.75rem;display:flex;gap:2px;padding:3px;border:1px solid var(--color-line);border-radius:.625rem;background:color-mix(in srgb,#fff 92%,transparent);box-shadow:var(--shadow-popover);backdrop-filter:blur(8px)}
    .mode-switch button{height:1.625rem;padding:0 .625rem;border-radius:.5rem;color:var(--color-muted);font-size:10px;font-weight:600;cursor:pointer;transition:background-color 150ms ease,color 150ms ease}
    .mode-switch button:hover{color:var(--color-ink)}
    .mode-switch button.active{background:var(--color-brand-600);color:#fff}
    .heat-legend{position:absolute;left:.75rem;bottom:.75rem;display:flex;align-items:center;gap:.375rem;padding:.25rem .5rem;border:1px solid var(--color-line);border-radius:.5rem;background:color-mix(in srgb,#fff 92%,transparent);color:var(--color-muted);font-size:9px;font-weight:600}
    .heat-legend i{width:4.5rem;height:.375rem;border-radius:9999px;background:linear-gradient(90deg,var(--color-brand-300),var(--color-brand-500),var(--color-warning),var(--color-danger))}
    :host-context(.dark) .mode-switch,:host-context(.dark) .heat-legend{border-color:var(--color-dark-line);background:color-mix(in srgb,var(--color-dark-surface) 92%,transparent);color:var(--color-brand-300)}
    :host-context(.dark) .mode-switch button{color:var(--color-brand-300)}
    :host-context(.dark) .mode-switch button:hover{color:#fff}
    :host-context(.dark) .mode-switch button.active{color:#fff}
  `,
})
/**
 * Violations are drawn as one GeoJSON source + WebGL circle layers instead of a DOM marker per
 * violation: hundreds of points pan/zoom at full frame rate, appending a page only swaps the source
 * data, and selection is a feature-state flip rather than a rebuild. The map runs outside Angular's
 * zone so camera movement never triggers change detection.
 */
export class ViolationMap implements AfterViewInit, OnDestroy {
  readonly violations = input.required<ViolationDisplay[]>();
  readonly selectedId = input<string | null>(null);
  readonly violationSelected = output<ViolationDisplay>();
  protected readonly isFullscreen = signal(false);
  /** Clusters (counts, drill-down) or Heat (density glow, fading into dots when zoomed in). */
  protected readonly mode = signal<ViolationMapMode>(storedMapMode());

  private readonly zone = inject(NgZone);
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private instance?: MapLibreMap;
  private resizeObserver?: ResizeObserver;
  private byId = new Map<string, ViolationDisplay>();
  private highlighted: string | null = null;
  private popup?: maplibregl.Popup;
  private colors?: Record<string, string>;
  private renderedIds = new Set<string>();
  private framesForSet = 0;

  constructor() {
    effect(() => {
      const records = this.violations();
      untracked(() => this.zone.runOutsideAngular(() => this.render(records)));
    });
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.zone.runOutsideAngular(() => this.select(id)));
    });
    effect(() => {
      const mode = this.mode();
      untracked(() => this.zone.runOutsideAngular(() => this.applyMode(mode)));
    });
  }

  protected setMode(mode: ViolationMapMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(MAP_MODE_STORAGE_KEY, mode);
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
  }

  /** Shows one view's layers and hides the other's; dots stay available close up in both. */
  private applyMode(mode: ViolationMapMode): void {
    const map = this.instance;
    if (!map?.getLayer(HEAT_LAYER)) return;
    const heat = mode === 'heat';
    map.setLayoutProperty(HEAT_LAYER, 'visibility', heat ? 'visible' : 'none');
    for (const layer of [CLUSTER_LAYER, CLUSTER_COUNT_LAYER])
      map.setLayoutProperty(layer, 'visibility', heat ? 'none' : 'visible');
    // In heat mode the individual dots fade in only as the glow fades out (zoomed in to street level).
    const dotOpacity: ExpressionSpecification | number = heat
      ? ['interpolate', ['linear'], ['zoom'], 11.5, 0, 13, 1]
      : 1;
    map.setPaintProperty(POINT_LAYER, 'circle-opacity', dotOpacity);
    map.setPaintProperty(POINT_LAYER, 'circle-stroke-opacity', dotOpacity);
  }

  ngAfterViewInit(): void {
    const element = this.mapElement().nativeElement;
    this.zone.runOutsideAngular(() => {
      // No device-location lookup: the viewport is driven by the violations themselves (render()
      // frames them). The timezone centre is only the placeholder before that first fit.
      const map = createIotMap(element, timezoneCenter(), 6);
      this.instance = map;
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(element);
      // style.load also fires after a light/dark theme switch, which replaces the style and its layers.
      map.on('style.load', () => {
        this.addLayers(map);
        this.applyMode(untracked(() => this.mode()));
        this.render(untracked(() => this.violations()), false);
        this.highlighted = null;
        this.select(untracked(() => this.selectedId()), false);
      });
      map.on('click', POINT_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.['id'];
        const record = this.byId.get(String(id));
        if (record) this.zone.run(() => this.violationSelected.emit(record));
      });
      // Donut images are drawn on demand the first time a count combination is needed (and again after
      // a theme switch, which replaces the style and its images).
      map.on('styleimagemissing', (event) => {
        if (!event.id.startsWith(CLUSTER_ICON_PREFIX) || map.hasImage(event.id)) return;
        const counts = event.id.slice(CLUSTER_ICON_PREFIX.length).split('|').map(Number);
        map.addImage(event.id, this.drawCluster(counts), { pixelRatio: CLUSTER_PIXEL_RATIO });
      });
      map.on('click', CLUSTER_LAYER, (event) => {
        const feature = event.features?.[0];
        if (feature) void this.expandCluster(map, feature);
      });
      for (const layer of [POINT_LAYER, CLUSTER_LAYER]) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      }
    });
  }

  protected zoomIn(): void {
    this.instance?.zoomIn();
  }

  protected zoomOut(): void {
    this.instance?.zoomOut();
  }

  // Button behaviour mirrors the shared fleet map so every map in the app
  // responds to the overlay identically.
  protected onToggle3D(): void {
    if (!this.instance) return;
    this.instance.easeTo({ pitch: this.instance.getPitch() > 0 ? 0 : 60, duration: 500 });
  }

  protected onResetNorth(): void {
    this.instance?.easeTo({ bearing: 0, duration: 500 });
  }

  protected onRotate(): void {
    if (!this.instance) return;
    this.instance.easeTo({ bearing: this.instance.getBearing() + 90, duration: 500 });
  }

  protected onFullscreenToggle(): void {
    this.isFullscreen.update((value) => !value);
    // The host changes size, so MapLibre must re-measure after layout.
    requestAnimationFrame(() => requestAnimationFrame(() => this.instance?.resize()));
  }

  private addLayers(map: MapLibreMap): void {
    if (map.getSource(SOURCE_ID)) return;
    this.colors = undefined; // theme may have changed: re-read the palette
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id',
      // Thousands of points stay readable: nearby violations merge into counted bubbles until zoomed in.
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      // Per-category counts summed inside each cluster, for the donut ring.
      clusterProperties: Object.fromEntries(
        CLUSTER_CATEGORIES.map(([key, category]) => [
          key,
          ['+', ['case', ['==', ['get', 'cat'], category], 1, 0]],
        ]),
      ),
    });
    // Heat: same ramp as the clusters, weighted by severity; it fades out as dots fade in close up.
    map.addSource(HEAT_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: HEAT_LAYER,
      type: 'heatmap',
      source: HEAT_SOURCE_ID,
      layout: { visibility: 'none' },
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-intensity': this.heatIntensity(0),
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 9, 10, 12, 18, 14, 24],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0.8, 13.5, 0],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0, 0, 0, 0)',
          0.1, this.withAlpha(this.categoryColor('brandLight'), 0.4),
          0.3, this.withAlpha(this.categoryColor('Compliance'), 0.65),
          0.55, this.withAlpha(this.categoryColor('Behaviour'), 0.85),
          0.88, this.categoryColor('Behaviour'),
          0.97, this.categoryColor('Speeding'),
        ],
      },
    });
    // Donut clusters: the image id encodes the per-category counts; styleimagemissing draws each
    // distinct donut once (see drawCluster) and the GPU reuses it for every bubble with those counts.
    const iconId: ExpressionSpecification = [
      'concat',
      CLUSTER_ICON_PREFIX,
      ...CLUSTER_CATEGORIES.flatMap(([key], index): unknown[] =>
        index ? ['|', ['to-string', ['get', key]]] : [['to-string', ['get', key]]],
      ),
    ] as unknown as ExpressionSpecification;
    map.addLayer({
      id: CLUSTER_LAYER,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': iconId,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['step', ['get', 'point_count'], 11, 100, 12, 250, 13],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': this.isDark() ? '#ffffff' : this.categoryColor('ink') },
    });
    // Soft ring behind the selected violation.
    map.addLayer({
      id: HALO_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.28,
        'circle-radius': ['case', SELECTED, 15, 0],
        'circle-radius-transition': { duration: 200 },
      },
    });
    map.addLayer({
      id: POINT_LAYER,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['case', SELECTED, 9, 7],
        'circle-radius-transition': { duration: 200 },
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    });
  }

  private render(records: ViolationDisplay[], frame = true): void {
    const map = this.instance;
    const source = map?.getSource<GeoJSONSource>(SOURCE_ID);
    if (!map || !source) return;
    const plottable = records.filter((record) => this.isPlottable(record));
    this.byId = new Map(plottable.map((record) => [record.id, record]));
    const data: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features: plottable.map((record) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(record.longitude), Number(record.latitude)] },
        properties: {
          id: record.id,
          cat: record.category,
          color: this.categoryColor(record.category),
          weight: SEVERITY_WEIGHT[record.severity] ?? 0.5,
        },
      })),
    };
    source.setData(data);
    const heat = map.getSource<GeoJSONSource>(HEAT_SOURCE_ID);
    heat?.setData(data);
    if (heat) map.setPaintProperty(HEAT_LAYER, 'heatmap-intensity', this.heatIntensity(plottable.length));
    // Frame each new data set, but not every time batches stream into it: a set that shares no
    // violation with the previous render is new (filters changed). Within a set, frame once more when
    // the first big batch lands, then leave the camera to the user. Never while something is selected.
    const ids = new Set(this.byId.keys());
    const isNewSet = ![...ids].some((id) => this.renderedIds.has(id));
    if (isNewSet) this.framesForSet = 0;
    this.renderedIds = ids;
    const selection = untracked(() => this.selectedId());
    if (frame && plottable.length && this.framesForSet < 2 && !(selection && this.byId.has(selection))) {
      this.framesForSet++;
      fitLatLngs(map, plottable.map((r) => [Number(r.latitude), Number(r.longitude)]), 28, 8);
    }
  }

  /** A cluster click zooms in just far enough for it to split. */
  private async expandCluster(map: MapLibreMap, feature: maplibregl.MapGeoJSONFeature): Promise<void> {
    const source = map.getSource<GeoJSONSource>(SOURCE_ID);
    const clusterId = feature.properties?.['cluster_id'];
    if (!source || clusterId == null || feature.geometry.type !== 'Point') return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 450 });
  }

  /** Feature-state flip for the highlight, one shared popup, and fly to the violation. */
  private select(id: string | null, fly = true): void {
    const map = this.instance;
    if (!map?.getSource(SOURCE_ID)) return;
    if (this.highlighted) map.setFeatureState({ source: SOURCE_ID, id: this.highlighted }, { selected: false });
    this.highlighted = null;
    this.popup?.remove();
    const record = id ? this.byId.get(id) : undefined;
    if (!record) return;
    this.highlighted = record.id;
    map.setFeatureState({ source: SOURCE_ID, id: record.id }, { selected: true });
    const lngLat: [number, number] = [Number(record.longitude), Number(record.latitude)];
    this.popup = popupHtml(this.violationPopupHtml(record)).setOffset(14).setLngLat(lngLat).addTo(map);
    // Selecting a row must always pull the violation closer, never zoom back out.
    // Past the cluster zoom, so the selected dot is drawn on its own rather than inside a bubble.
    if (fly) map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1), duration: 700 });
  }

  // A record is only mappable when its coordinates are real numbers within
  // latitude/longitude bounds — the API returns '' or null for missing fixes.
  private isPlottable(record: ViolationDisplay | null | undefined): record is ViolationDisplay {
    const latitude = Number(record?.latitude);
    const longitude = Number(record?.longitude);
    return (
      !!record &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    );
  }

  private violationPopupHtml(record: ViolationDisplay): string {
    const speedLine = record.thresholdKph > 0
      ? `<span class="vio-popup-row"><span class="vio-popup-icon vio-popup-icon--speed">⚡</span><span class="vio-popup-text"><strong>${record.speedKph} km/h</strong> <small>(limit: ${record.thresholdKph} km/h)</small></span></span>`
      : '';
    const fineLine = (record.fine ?? 0) > 0
      ? `<span class="vio-popup-row"><span class="vio-popup-icon vio-popup-icon--fine">🔥</span><span class="vio-popup-text vio-popup-text--fine">Fine: ${escapeHtml(record.fineDisplay || '£' + record.fine)}</span></span>`
      : '';
    return `
      <div class="vio-popup">
        <strong class="vio-popup-title">${escapeHtml(record.type)}</strong>
        <span class="vio-popup-row"><span class="vio-popup-icon">🚗</span><span class="vio-popup-text">${escapeHtml(record.vehicle)} · ${escapeHtml(record.driver)}</span></span>
        <span class="vio-popup-row"><span class="vio-popup-icon">🕐</span><span class="vio-popup-text">${escapeHtml(record.timestamp)}</span></span>
        <span class="vio-popup-row"><span class="vio-popup-icon">📍</span><span class="vio-popup-text vio-popup-text--location">${escapeHtml(record.location)}</span></span>
        ${speedLine}
        ${fineLine}
      </div>
    `;
  }

  /**
   * Heat intensity scaled to how many points are loaded, so the ramp keeps its range whether 200 or
   * 5,000 violations pile up on the same roads: without it dense fleets saturate to solid red.
   */
  private heatIntensity(count: number): ExpressionSpecification {
    const scale = Math.min(1, Math.max(0.1, 15 / Math.sqrt(Math.max(count, 1))));
    return ['interpolate', ['linear'], ['zoom'], 0, 0.5 * scale, 9, 0.9 * scale, 13, 1.6 * scale];
  }

  /**
   * One donut cluster: soft halo tinted by how hot the cluster is, a floating core (white, or dark
   * surface in dark mode), and a ring split by category share. Diameter steps up with the count.
   */
  private drawCluster(counts: number[]): ImageData {
    const total = counts.reduce((sum, count) => sum + count, 0) || 1;
    const diameter = total < 25 ? 36 : total < 100 ? 44 : total < 250 ? 52 : 60;
    const halo = 7;
    const size = diameter + halo * 2;
    const ratio = CLUSTER_PIXEL_RATIO;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * ratio;
    const context = canvas.getContext('2d')!;
    context.scale(ratio, ratio);
    const center = size / 2;
    const radius = diameter / 2;
    const full = Math.PI * 2;

    // Halo: hotness at a glance (light purple → purple → amber → red), like the heat ramp.
    const hot = total < 25 ? 'brandLight' : total < 100 ? 'Compliance' : total < 250 ? 'Behaviour' : 'Speeding';
    context.fillStyle = this.withAlpha(this.categoryColor(hot), 0.22);
    context.beginPath();
    context.arc(center, center, radius + halo - 1, 0, full);
    context.fill();

    // Floating core.
    context.save();
    context.shadowColor = 'rgba(15, 23, 42, 0.28)';
    context.shadowBlur = 6;
    context.shadowOffsetY = 1.5;
    context.fillStyle = this.isDark() ? this.categoryColor('coreDark') : '#ffffff';
    context.beginPath();
    context.arc(center, center, radius, 0, full);
    context.fill();
    context.restore();

    // Category ring, clockwise from 12 o'clock, with hairline gaps between segments.
    const ringWidth = diameter >= 52 ? 5.5 : 4.5;
    const segments = CLUSTER_CATEGORIES.map(([, category], index) => ({ category, count: counts[index] || 0 }))
      .filter((segment) => segment.count > 0);
    const gap = segments.length > 1 ? 0.06 : 0;
    let angle = -Math.PI / 2;
    context.lineWidth = ringWidth;
    context.lineCap = 'butt';
    for (const segment of segments) {
      const sweep = (segment.count / total) * full;
      context.strokeStyle = this.categoryColor(segment.category);
      context.beginPath();
      context.arc(center, center, radius - ringWidth / 2, angle + gap / 2, angle + Math.max(sweep - gap / 2, gap / 2));
      context.stroke();
      angle += sweep;
    }
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  private isDark(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  /** rgb(r, g, b) from the palette → rgba(r, g, b, a). */
  private withAlpha(color: string, alpha: number): string {
    return color.startsWith('rgb(') ? color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`) : color;
  }

  /** Palette read once (getComputedStyle per point forced a style recalc for every violation). */
  private categoryColor(category: string): string {
    if (!this.colors) {
      const styles = getComputedStyle(document.documentElement);
      // Theme tokens can be oklch() (Tailwind 4), which MapLibre can't parse: an invalid colour makes
      // addLayer throw and nothing renders. Painting one pixel and reading it back gives plain rgb().
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const css = (name: string, fallback: string) => {
        const value = styles.getPropertyValue(name).trim() || fallback;
        if (!context) return fallback;
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = fallback;
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return `rgb(${r}, ${g}, ${b})`;
      };
      this.colors = {
        Speeding: css('--color-danger', '#ef4444'),
        Behaviour: css('--color-warning', '#f59e0b'),
        Safety: '#ef6c36',
        Compliance: css('--color-brand-500', '#8b5cf6'),
        brandLight: css('--color-brand-400', '#c084fc'),
        ink: css('--color-ink', '#1e1b4b'),
        coreDark: css('--color-dark-surface', '#17131f'),
        Geozone: css('--color-info', '#3b82f6'),
        default: css('--color-muted', '#64748b'),
      };
    }
    return this.colors[category] ?? this.colors['default'];
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.popup?.remove();
    this.instance?.remove();
  }
}
