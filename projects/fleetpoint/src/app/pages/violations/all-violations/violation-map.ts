import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { createIotMap, fitLatLngs, markerElement, popup } from '../../../shared/maps/maplibre';
import { ViolationRecord } from '../violations.data';

const LOCATIONS: Array<[number, number]> = [
  [52.052, -0.72], [53.47, -2.31], [51.52, -0.26], [51.49, -0.12],
  [52.48, -1.89], [53.49, -2.29], [52.19, -1.71], [52.5, -1.87],
];

@Component({
  selector: 'app-violation-map',
  template: '<div #map class="map" aria-label="Violation locations"></div>',
  styles: ':host,.map{display:block;width:100%;height:100%;min-height:0}.map{background:var(--color-brand-50)}',
})
export class ViolationMap implements AfterViewInit, OnDestroy {
  readonly violations = input.required<ViolationRecord[]>();
  readonly selectedId = input<string | null>(null);
  readonly violationSelected = output<ViolationRecord>();
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
      const index = this.violations().findIndex((item) => item.id === id);
      if (index >= 0 && this.instance) {
        const [lat, lng] = LOCATIONS[index % LOCATIONS.length];
        this.instance.flyTo({ center: [lng, lat], zoom: 10, duration: 700 });
        this.markers.get(id!)?.togglePopup();
      }
    });
  }

  ngAfterViewInit(): void {
    this.instance = createIotMap(this.mapElement().nativeElement, [52.45, -1.6], 6);
    this.instance.once('load', () => this.render(this.violations()));
  }

  private render(records: ViolationRecord[]): void {
    if (!this.instance) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    records.forEach((record, index) => {
      const color = this.categoryColor(record.category);
      const element = markerElement(`<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px rgb(0 0 0 / 35%)"></span>`);
      element.addEventListener('click', () => this.violationSelected.emit(record));
      const [lat, lng] = LOCATIONS[index % LOCATIONS.length];
      const item = new maplibregl.Marker({ element })
        .setLngLat([lng, lat])
        .setPopup(popup(`${record.type} · ${record.location}`))
        .addTo(this.instance!);
      this.markers.set(record.id, item);
    });
    if (records.length)
      fitLatLngs(this.instance, records.map((_, index) => LOCATIONS[index % LOCATIONS.length]), 28, 8);
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
    this.instance?.remove();
  }
}
