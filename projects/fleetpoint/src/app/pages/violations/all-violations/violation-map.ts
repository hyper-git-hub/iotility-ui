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
    this.instance = createIotMap(this.mapElement().nativeElement, [52.45, -1.6], 6);
    this.instance.once('load', () => this.render(this.violations()));
  }

  private render(records: ViolationDisplay[]): void {
    if (!this.instance) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    const validRecords = records.filter(
      (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude),
    );
    validRecords.forEach((record) => {
      const color = this.categoryColor(record.category);
      const icon = this.categoryIcon(record.category);
      const element = markerElement(
        `<span style="display:grid;place-items:center;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px rgb(0 0 0 / 35%)"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px">${icon}</svg></span>`,
      );
      element.addEventListener('click', () => this.violationSelected.emit(record));
      const item = new maplibregl.Marker({ element })
        .setLngLat([record.longitude, record.latitude])
        .setPopup(popup(`${record.type} · ${record.location}`))
        .addTo(this.instance!);
      this.markers.set(record.id, item);
    });
    if (validRecords.length)
      fitLatLngs(
        this.instance,
        validRecords.map((r) => [r.latitude, r.longitude]),
        28,
        8,
      );
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

  private categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      Speeding: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
      Behaviour: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
      Safety: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
      Compliance: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
      Geozone: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    };
    return icons[category] ?? '';
  }

  ngOnDestroy(): void {
    this.instance?.remove();
  }
}
