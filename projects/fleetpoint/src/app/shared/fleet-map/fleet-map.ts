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
  Layer,
  LatLngExpression,
  Map as LeafletMap,
  Marker,
  PathOptions,
  circle as createCircle,
  divIcon,
  latLngBounds,
  map as createMap,
  marker as createMarker,
  point as createPoint,
  polygon as createPolygon,
  polyline as createPolyline,
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

export interface MapZoneOverlay {
  id: string;
  label: string;
  geometry: 'circle' | 'polygon' | 'corridor';
  color: string;
  center?: LatLngExpression;
  radius?: number;
  points?: LatLngExpression[];
}

@Component({
  selector: 'app-fleet-map',
  templateUrl: './fleet-map.html',
  styleUrl: './fleet-map.css',
})
export class FleetMap implements AfterViewInit, OnDestroy {
  readonly vehicles = input.required<TrackedVehicle[]>();
  readonly zones = input<MapZoneOverlay[]>([]);
  readonly showMarkers = input(true);
  readonly fitZoomOffset = input(0);
  readonly selectedVehicleId = input<string | null>(null);
  readonly vehicleSelected = output<TrackedVehicle>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: LeafletMap;
  private readonly markers = new Map<string, Marker>();
  private zoneLayers: Layer[] = [];

  constructor() {
    effect(() => {
      const vehicles = this.vehicles();
      const showMarkers = this.showMarkers();
      if (this.map) this.renderMarkers(vehicles, false, showMarkers);
    });
    effect(() => {
      const zones = this.zones();
      if (this.map) this.renderZones(zones);
    });
    effect(() => {
      const id = this.selectedVehicleId();
      const vehicle = this.vehicles().find((item) => item.id === id);
      if (vehicle && this.map) this.focusVehicle(vehicle);
    });
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapElement().nativeElement, { zoomControl: true }).setView(
      [25.2854, 51.531],
      11,
    );
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.renderMarkers(this.vehicles(), true, this.showMarkers());
    this.renderZones(this.zones());
    const selectedVehicle = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
    if (selectedVehicle) this.focusVehicle(selectedVehicle);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private renderMarkers(vehicles: TrackedVehicle[], fitToVehicles = false, showMarkers = true): void {
    if (!this.map) return;
    for (const marker of this.markers.values()) marker.removeFrom(this.map);
    this.markers.clear();

    for (const vehicle of showMarkers ? vehicles : []) {
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
        const bounds = latLngBounds(vehicles.map(({ lat, lng }) => [lat, lng]));
        const zoom = Math.min(
          19,
          this.map.getBoundsZoom(bounds, false, createPoint(48, 48)) + this.fitZoomOffset(),
        );
        this.map.flyTo(bounds.getCenter(), zoom, {
          animate: true,
          duration: 1.1,
        });
      }
    }
  }

  private renderZones(zones: MapZoneOverlay[]): void {
    if (!this.map) return;
    for (const layer of this.zoneLayers) layer.removeFrom(this.map);
    this.zoneLayers = [];

    const orderedZones = [...zones].sort((a, b) => (b.radius ?? 0) - (a.radius ?? 0));
    for (const zone of orderedZones) {
      const style: PathOptions = {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: zone.geometry === 'corridor' ? 0.16 : 0.2,
        opacity: zone.geometry === 'corridor' ? 0.65 : 0.9,
        weight: zone.geometry === 'corridor' ? 5 : 2,
        dashArray: zone.geometry === 'corridor' ? '9 7' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      };
      let layer: Layer | null = null;
      if (zone.geometry === 'circle' && zone.center) {
        layer = createCircle(zone.center, { ...style, radius: zone.radius ?? 300 });
      } else if (zone.geometry === 'polygon' && zone.points?.length) {
        layer = createPolygon(zone.points, style);
      } else if (zone.geometry === 'corridor' && zone.points?.length) {
        layer = createPolyline(zone.points, style);
      }
      if (!layer) continue;

      layer.addTo(this.map);
      layer.bindTooltip(zone.label, { sticky: true });
      layer.on('click', () => {
        const item = this.vehicles().find((vehicle) => vehicle.id === zone.id);
        if (item) this.vehicleSelected.emit(item);
      });
      this.zoneLayers.push(layer);
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
    this.zoneLayers = [];
    this.map?.remove();
  }
}
