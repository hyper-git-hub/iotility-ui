import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { createIotMap, fitLatLngs, markerElement, popup } from '../../../shared/maps/maplibre';
import { ViolationDisplay } from '../all-violations/all-violations';

@Component({
  selector: 'app-violation-map',
  template: '<div #map class="map" aria-label="Violation locations"></div>',
  styles: ':host,.map{display:block;width:100%;height:100%;min-height:0}.map{background:var(--color-brand-50)}',
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
    // Default map center to Pakistan; will override if geolocation succeeds
    this.instance = createIotMap(element, [30.3753, 69.3451], 6);
    this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
    this.resizeObserver.observe(element);
    // Attempt live geolocation, overriding the default on success
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.instance!.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 10, duration: 700 });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
    this.instance.once('load', () => this.render(this.violations()));
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
        .setPopup(popup(`${record.type} · ${record.location}`))
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
