import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { createIotMap, fitLatLngs, markerElement, popupHtml, timezoneCenter } from '../../../shared/maps/maplibre';
import { MapControls } from '../../../shared/map-overlays/map-controls';
import { ViolationDisplay } from '../all-violations/all-violations';

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
export class ViolationMap implements AfterViewInit, OnDestroy {
  readonly violations = input.required<ViolationDisplay[]>();
  readonly selectedId = input<string | null>(null);
  readonly violationSelected = output<ViolationDisplay>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private instance?: MapLibreMap;
  private readonly markers = new Map<string, maplibregl.Marker>();
  private resizeObserver?: ResizeObserver;

  constructor() {
    effect(() => {
      const records = this.violations();
      if (this.instance) this.render(records);
    });
    effect(() => {
      const id = this.selectedId();
      // Update marker selection visuals
      this.markers.forEach((marker, markerId) => {
        const element = marker.getElement();
        const span = element.querySelector('span');
        if (span) {
          const isSelected = markerId === id;
          span.style.transform = isSelected ? 'scale(1.3)' : 'scale(1)';
          span.style.boxShadow = isSelected
            ? `0 0 0 3px ${this.categoryColor(this.violations().find((v) => v.id === markerId)?.category ?? '')}66, 0 2px 8px rgb(0 0 0 / 35%)`
            : '0 2px 8px rgb(0 0 0 / 35%)';
        }
        // Close popup for non-selected markers
        if (markerId !== id && marker.getPopup()?.isOpen()) marker.togglePopup();
      });
      // Fly to and open popup for selected violation
      const record = this.violations().find((item) => item.id === id);
      if (record && this.instance) {
        this.instance.flyTo({
          center: [record.longitude, record.latitude],
          zoom: 10,
          duration: 700,
        });
        const marker = this.markers.get(id!);
        if (marker && !marker.getPopup()?.isOpen()) marker.togglePopup();
      }
    });
  }

  ngAfterViewInit(): void {
    const element = this.mapElement().nativeElement;
    // No device-location lookup: the viewport is driven only by the violations
    // themselves, which render() frames with fitLatLngs below. This timezone
    // centre is just the placeholder for the instant before that first fit
    // (and the resting view when there are no plottable violations).
    this.instance = createIotMap(element, timezoneCenter(), 6);
    this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
    this.resizeObserver.observe(element);
    this.instance.once('load', () => this.render(this.violations()));
  }

  protected readonly isFullscreen = signal(false);

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

  private render(records: ViolationDisplay[]): void {
    if (!this.instance) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    const validRecords = records.filter(
      (r) =>
        Number.isFinite(Number(r.latitude)) &&
        Number.isFinite(Number(r.longitude)) &&
        Math.abs(Number(r.latitude)) <= 90 &&
        Math.abs(Number(r.longitude)) <= 180,
    );
    validRecords.forEach((record) => {
      const color = this.categoryColor(record.category);
      const latitude = Number(record.latitude);
      const longitude = Number(record.longitude);
      const element = markerElement(
        `<span style="display:block;width:14px;height:14px;border:1.5px solid white;border-radius:50%;background:${color};box-shadow:0 1px 4px rgb(0 0 0 / 30%)"></span>`,
      );
      element.addEventListener('click', () => this.violationSelected.emit(record));
      const item = new maplibregl.Marker({ element })
        .setLngLat([longitude, latitude])
        .setPopup(popupHtml(this.violationPopupHtml(record)))
        .addTo(this.instance!);
      this.markers.set(record.id, item);
    });
    if (validRecords.length)
      fitLatLngs(
        this.instance,
        validRecords.map((r) => [Number(r.latitude), Number(r.longitude)]),
        28,
        8,
      );
    requestAnimationFrame(() => this.instance?.resize());
  }

  private violationPopupHtml(record: ViolationDisplay): string {
    const speedLine = record.thresholdKph > 0
      ? `<span class="vio-popup-row"><span class="vio-popup-icon vio-popup-icon--speed">⚡</span><span class="vio-popup-text"><strong>${record.speedKph} km/h</strong> <small>(limit: ${record.thresholdKph} km/h)</small></span></span>`
      : '';
    const fineLine = record.fine > 0
      ? `<span class="vio-popup-row"><span class="vio-popup-icon vio-popup-icon--fine">🔥</span><span class="vio-popup-text vio-popup-text--fine">Fine: ${record.fineDisplay || '£' + record.fine}</span></span>`
      : '';
    return `
      <div class="vio-popup">
        <strong class="vio-popup-title">${record.type}</strong>
        <span class="vio-popup-row"><span class="vio-popup-icon">🚗</span><span class="vio-popup-text">${record.vehicle} · ${record.driver}</span></span>
        <span class="vio-popup-row"><span class="vio-popup-icon">🕐</span><span class="vio-popup-text">${record.timestamp}</span></span>
        <span class="vio-popup-row"><span class="vio-popup-icon">📍</span><span class="vio-popup-text vio-popup-text--location">${record.location}</span></span>
        ${speedLine}
        ${fineLine}
      </div>
    `;
  }

  private categoryColor(category: string): string {
    const styles = getComputedStyle(document.documentElement);
    const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const colors: Record<string, string> = {
      Speeding: css('--color-danger', '#ef4444'),
      Behaviour: css('--color-warning', '#f59e0b'),
      Safety: '#ef6c36',
      Compliance: css('--color-brand-500', '#8b5cf6'),
      Geozone: css('--color-info', '#3b82f6'),
    };
    return colors[category] ?? css('--color-muted', '#64748b');
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.instance?.remove();
  }
}
