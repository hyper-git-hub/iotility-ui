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
const SELECTED: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];

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
    </div>
  `,
  styles: `
    :host,.map{display:block;width:100%;height:100%;min-height:0}
    :host{position:relative}
    :host(.is-fullscreen){position:fixed;inset:0;z-index:1200}
    .map{background:var(--color-brand-50)}
    .map-overlays{pointer-events:none;position:absolute;inset:0;z-index:500}
    .overlay-controls{pointer-events:auto;position:absolute;right:1rem;top:1rem}
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

  private readonly zone = inject(NgZone);
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private instance?: MapLibreMap;
  private resizeObserver?: ResizeObserver;
  private byId = new Map<string, ViolationDisplay>();
  private highlighted: string | null = null;
  private popup?: maplibregl.Popup;
  private colors?: Record<string, string>;

  constructor() {
    effect(() => {
      const records = this.violations();
      untracked(() => this.zone.runOutsideAngular(() => this.render(records)));
    });
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.zone.runOutsideAngular(() => this.select(id)));
    });
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
        this.render(untracked(() => this.violations()), false);
        this.highlighted = null;
        this.select(untracked(() => this.selectedId()), false);
      });
      map.on('click', POINT_LAYER, (event) => {
        const id = event.features?.[0]?.properties?.['id'];
        const record = this.byId.get(String(id));
        if (record) this.zone.run(() => this.violationSelected.emit(record));
      });
      map.on('mouseenter', POINT_LAYER, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', POINT_LAYER, () => (map.getCanvas().style.cursor = ''));
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
    });
    // Soft ring behind the selected violation.
    map.addLayer({
      id: HALO_LAYER,
      type: 'circle',
      source: SOURCE_ID,
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
    source.setData({
      type: 'FeatureCollection',
      features: plottable.map((record) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(record.longitude), Number(record.latitude)] },
        properties: { id: record.id, color: this.categoryColor(record.category) },
      })),
    });
    // Frame the whole set only while nothing is selected: appending the next page of the list
    // (scroll-to-bottom) re-runs this, and re-framing would drag the camera off the selection.
    const selection = untracked(() => this.selectedId());
    if (frame && plottable.length && !(selection && this.byId.has(selection)))
      fitLatLngs(map, plottable.map((r) => [Number(r.latitude), Number(r.longitude)]), 28, 8);
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
    if (fly) map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 12), duration: 700 });
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
    const fineLine = record.fine > 0
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

  /** Palette read once (getComputedStyle per point forced a style recalc for every violation). */
  private categoryColor(category: string): string {
    if (!this.colors) {
      const styles = getComputedStyle(document.documentElement);
      const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      this.colors = {
        Speeding: css('--color-danger', '#ef4444'),
        Behaviour: css('--color-warning', '#f59e0b'),
        Safety: '#ef6c36',
        Compliance: css('--color-brand-500', '#8b5cf6'),
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
