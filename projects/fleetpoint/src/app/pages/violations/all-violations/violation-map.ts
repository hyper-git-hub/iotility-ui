import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';
import { Map as LeafletMap, Marker, divIcon, latLngBounds, map, marker, tileLayer } from 'leaflet';
import { ViolationRecord } from '../violations.data';

const LOCATIONS: Array<[number, number]> = [
  [52.052, -0.72],
  [53.47, -2.31],
  [51.52, -0.26],
  [51.49, -0.12],
  [52.48, -1.89],
  [53.49, -2.29],
  [52.19, -1.71],
  [52.5, -1.87],
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
  private instance?: LeafletMap;
  private readonly markers = new Map<string, Marker>();

  constructor() {
    effect(() => {
      const records = this.violations();
      if (this.instance) this.render(records);
    });
    effect(() => {
      const id = this.selectedId();
      const index = this.violations().findIndex((item) => item.id === id);
      if (index >= 0 && this.instance) {
        this.instance.flyTo(LOCATIONS[index % LOCATIONS.length], 10, { animate: true });
        this.markers.get(id!)?.openTooltip();
      }
    });
  }

  ngAfterViewInit(): void {
    this.instance = map(this.mapElement().nativeElement).setView([52.45, -1.6], 6);
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.instance);
    this.render(this.violations());
    setTimeout(() => this.instance?.invalidateSize());
  }

  private render(records: ViolationRecord[]): void {
    if (!this.instance) return;
    this.markers.forEach((item) => item.removeFrom(this.instance!));
    this.markers.clear();
    records.forEach((record, index) => {
      const color = this.categoryColor(record.category);
      const icon = divIcon({
        className: '',
        html: `<span style="display:block;width:18px;height:18px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 8px rgb(0 0 0 / 35%)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const item = marker(LOCATIONS[index % LOCATIONS.length], { icon }).addTo(this.instance!);
      item.bindTooltip(`${record.type} · ${record.location}`, { direction: 'top' });
      item.on('click', () => this.violationSelected.emit(record));
      this.markers.set(record.id, item);
    });
    if (records.length) {
      this.instance.fitBounds(latLngBounds(records.map((_, index) => LOCATIONS[index % LOCATIONS.length])), {
        padding: [28, 28],
        maxZoom: 8,
      });
    }
  }

  private categoryColor(category: string): string {
    const colors: Record<string, string> = {
      Speeding: 'var(--color-danger)',
      Behaviour: 'var(--color-warning)',
      Safety: '#ef6c36',
      Compliance: 'var(--color-brand-500)',
      Geozone: 'var(--color-info)',
    };
    return colors[category] ?? 'var(--color-muted)';
  }

  ngOnDestroy(): void {
    this.instance?.remove();
  }
}
