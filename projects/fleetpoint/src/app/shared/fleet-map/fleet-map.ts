import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, circlePolygon, createIotMap, fitLatLngs, lineFeature, markerElement,
  polygonFeature, popup, removeGeoJson, upsertGeoJson,
} from '../maps/maplibre';

export type VehicleStatus = 'Moving' | 'Idling' | 'Alert' | 'Offline';
export interface TrackedVehicle {
  id: string; model: string; driver: string; status: VehicleStatus; speed: number;
  fuel: number; location: string; updated: string; lat: number; lng: number;
}
export interface MapZoneOverlay {
  id: string;
  label: string;
  geometry: 'circle' | 'polygon' | 'corridor';
  color: string;
  center?: LatLng;
  radius?: number;
  points?: LatLng[];
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
  private map?: MapLibreMap;
  private readonly markers = new Map<string, maplibregl.Marker>();

  constructor() {
    effect(() => {
      const vehicles = this.vehicles(), showMarkers = this.showMarkers();
      if (this.map) this.renderMarkers(vehicles, false, showMarkers);
    });
    effect(() => {
      const zones = this.zones();
      if (this.map?.isStyleLoaded()) this.renderZones(zones);
    });
    effect(() => {
      const vehicle = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
      if (vehicle && this.map) this.focusVehicle(vehicle);
    });
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, [25.2854, 51.531], 11);
    this.map.on('style.load', () => this.renderZones(this.zones()));
    this.map.once('load', () => {
      this.renderMarkers(this.vehicles(), true, this.showMarkers());
      this.renderZones(this.zones());
      const selected = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
      if (selected) this.focusVehicle(selected);
    });
  }

  private renderMarkers(vehicles: TrackedVehicle[], fit = false, show = true): void {
    if (!this.map) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    for (const vehicle of show ? vehicles : []) {
      const element = markerElement(
        `<div style="width:34px;height:34px;border:3px solid white;border-radius:50%;display:grid;place-items:center;background:${this.statusColor(vehicle.status)};color:white;font:700 10px Inter,sans-serif;box-shadow:0 5px 16px rgb(0 0 0 / 28%)">${vehicle.id.slice(-2)}</div>`,
      );
      element.addEventListener('click', () => {
        this.focusVehicle(vehicle);
        this.vehicleSelected.emit(vehicle);
      });
      const item = new maplibregl.Marker({ element })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setPopup(popup(`${vehicle.id} · ${vehicle.status}`))
        .addTo(this.map);
      this.markers.set(vehicle.id, item);
    }
    if (fit && vehicles.length) {
      fitLatLngs(this.map, vehicles.map(({ lat, lng }) => [lat, lng]), 48, 15 + this.fitZoomOffset());
    }
  }

  private renderZones(zones: MapZoneOverlay[]): void {
    if (!this.map?.isStyleLoaded()) return;
    if (!zones.length) {
      removeGeoJson(this.map, 'fleet-zones', ['zone-fill', 'zone-outline', 'zone-corridor']);
      return;
    }
    const features = zones.flatMap((zone) => {
      const properties = { id: zone.id, label: zone.label, color: zone.color, geometry: zone.geometry };
      if (zone.geometry === 'circle' && zone.center)
        return [polygonFeature(circlePolygon(zone.center, zone.radius ?? 300), properties)];
      if (zone.geometry === 'polygon' && zone.points?.length)
        return [polygonFeature(zone.points, properties)];
      if (zone.geometry === 'corridor' && zone.points?.length)
        return [lineFeature(zone.points, properties)];
      return [];
    });
    upsertGeoJson(this.map, 'fleet-zones', { type: 'FeatureCollection', features }, [
      {
        id: 'zone-fill', type: 'fill', filter: ['!=', ['get', 'geometry'], 'corridor'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .2 },
      },
      {
        id: 'zone-outline', type: 'line', filter: ['!=', ['get', 'geometry'], 'corridor'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': .9 },
      },
      {
        id: 'zone-corridor', type: 'line', filter: ['==', ['get', 'geometry'], 'corridor'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': .65, 'line-dasharray': [2, 1.5] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
    ]);
    for (const layer of ['zone-fill', 'zone-outline', 'zone-corridor']) {
      this.map.on('click', layer, ({ features }) => {
        const item = this.vehicles().find(({ id }) => id === features?.[0]?.properties?.['id']);
        if (item) this.vehicleSelected.emit(item);
      });
    }
  }

  private focusVehicle(vehicle: TrackedVehicle): void {
    this.map?.flyTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 13,
      pitch: 55,
      bearing: -18,
      duration: 900,
    });
    const marker = this.markers.get(vehicle.id);
    if (marker && !marker.getPopup()?.isOpen()) marker.togglePopup();
  }

  private statusColor(status: VehicleStatus): string {
    const styles = getComputedStyle(document.documentElement);
    const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return status === 'Moving' ? css('--color-success', '#10b981')
      : status === 'Idling' ? css('--color-warning', '#f59e0b')
        : status === 'Alert' ? css('--color-danger', '#ef4444') : css('--color-muted', '#64748b');
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
