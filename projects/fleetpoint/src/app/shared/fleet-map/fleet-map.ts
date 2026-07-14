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
import {
  Map as LeafletMap,
  Marker,
  divIcon,
  latLngBounds,
  map as createMap,
  marker as createMarker,
  tileLayer,
} from 'leaflet';

export type VehicleStatus = 'Moving' | 'Idling' | 'Alert' | 'Offline';

export interface TrackedVehicle {
  id: string;
  model: string;
  driver: string;
  status: VehicleStatus;
  speed: number;
  fuel: number;
  location: string;
  updated: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-fleet-map',
  templateUrl: './fleet-map.html',
  styleUrl: './fleet-map.css',
})
export class FleetMap implements AfterViewInit, OnDestroy {
  readonly vehicles = input.required<TrackedVehicle[]>();
  readonly selectedVehicleId = input<string | null>(null);
  readonly vehicleSelected = output<TrackedVehicle>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: LeafletMap;
  private readonly markers = new Map<string, Marker>();

  constructor() {
    effect(() => {
      const vehicles = this.vehicles();
      if (this.map) this.renderMarkers(vehicles, true);
    });
    effect(() => {
      const id = this.selectedVehicleId();
      const vehicle = this.vehicles().find((item) => item.id === id);
      if (vehicle && this.map) this.focusVehicle(vehicle);
    });
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapElement().nativeElement, { zoomControl: true }).setView(
      [53.4, -1.9],
      6,
    );
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.renderMarkers(this.vehicles(), true);
    const selectedVehicle = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
    if (selectedVehicle) this.focusVehicle(selectedVehicle);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private renderMarkers(vehicles: TrackedVehicle[], fitToVehicles = false): void {
    if (!this.map) return;
    for (const marker of this.markers.values()) marker.removeFrom(this.map);
    this.markers.clear();

    for (const vehicle of vehicles) {
      const color = this.statusColor(vehicle.status);
      const icon = divIcon({
        className: '',
        html: `<div style="width:34px;height:34px;border:3px solid white;border-radius:50%;display:grid;place-items:center;background:${color};color:white;font:700 10px Inter,sans-serif;box-shadow:0 5px 16px rgb(0 0 0 / 28%)">${vehicle.id.slice(-2)}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = createMarker([vehicle.lat, vehicle.lng], { icon }).addTo(this.map);
      marker.bindTooltip(`${vehicle.id} · ${vehicle.status}`, {
        direction: 'top',
        offset: [0, -16],
      });
      marker.on('click', () => {
        this.focusVehicle(vehicle);
        this.vehicleSelected.emit(vehicle);
      });
      this.markers.set(vehicle.id, marker);
    }

    if (fitToVehicles && vehicles.length) {
      if (vehicles.length === 1) {
        this.map.flyTo([vehicles[0].lat, vehicles[0].lng], 10, { animate: true, duration: 1.1 });
      } else {
        this.map.flyToBounds(latLngBounds(vehicles.map(({ lat, lng }) => [lat, lng])), {
          animate: true,
          duration: 1.1,
          maxZoom: 9,
          padding: [48, 48],
        });
      }
    }
  }

  private focusVehicle(vehicle: TrackedVehicle): void {
    this.map?.flyTo([vehicle.lat, vehicle.lng], 13, { animate: true, duration: 1.25 });
    this.markers.get(vehicle.id)?.openTooltip();
  }

  private statusColor(status: VehicleStatus): string {
    return status === 'Moving'
      ? 'var(--color-success)'
      : status === 'Idling'
        ? 'var(--color-warning)'
        : status === 'Alert'
          ? 'var(--color-danger)'
          : 'var(--color-muted)';
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
