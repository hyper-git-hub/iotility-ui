import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild,
} from '@angular/core';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
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
  readonly clusterMarkers = input(false);
  readonly fitZoomOffset = input(0);
  readonly selectedVehicleId = input<string | null>(null);
  readonly vehicleSelected = output<TrackedVehicle>();
  readonly ready = output<void>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: MapLibreMap;
  private readonly markers = new Map<string, maplibregl.Marker>();
  private fittedVehicleSet = '';
  private readyFallback?: ReturnType<typeof setTimeout>;
  private readyEmitted = false;

  constructor() {
    effect(() => {
      const vehicles = this.vehicles(), showMarkers = this.showMarkers(), clusterMarkers = this.clusterMarkers();
      if (this.map) {
        const vehicleSet = this.vehicleSetKey(vehicles);
        this.renderMarkers(vehicles, vehicleSet !== this.fittedVehicleSet, showMarkers, clusterMarkers);
      }
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
    this.map.on('style.load', () => {
      this.renderMarkers(this.vehicles(), false, this.showMarkers(), this.clusterMarkers());
      this.renderZones(this.zones());
    });
    this.map.once('load', () => {
      this.renderMarkers(this.vehicles(), true, this.showMarkers(), this.clusterMarkers());
      this.renderZones(this.zones());
      const selected = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
      if (selected) this.focusVehicle(selected);
      this.map?.once('idle', () => this.emitReady());
      this.readyFallback = setTimeout(() => this.emitReady(), 1200);
    });
  }

  private emitReady(): void {
    if (this.readyEmitted) return;
    this.readyEmitted = true;
    clearTimeout(this.readyFallback);
    this.ready.emit();
  }

  private renderMarkers(
    vehicles: TrackedVehicle[],
    fit = false,
    show = true,
    cluster = false,
  ): void {
    if (!this.map) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    if (cluster) this.renderClusteredMarkers(show ? vehicles : []);
    else for (const vehicle of show ? vehicles : []) {
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
      this.fittedVehicleSet = this.vehicleSetKey(vehicles);
    }
  }

  private renderClusteredMarkers(vehicles: TrackedVehicle[]): void {
    if (!this.map?.isStyleLoaded()) return;
    const sourceId = 'fleet-vehicles';
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: vehicles.map((vehicle) => ({
        type: 'Feature',
        properties: { id: vehicle.id, label: vehicle.id.slice(-2), status: vehicle.status },
        geometry: { type: 'Point', coordinates: [vehicle.lng, vehicle.lat] },
      })),
    };
    const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    this.map.addSource(sourceId, { type: 'geojson', data, cluster: true, clusterMaxZoom: 14, clusterRadius: 52 });
    this.map.addLayer({
      id: 'vehicle-cluster-shadows', type: 'circle', source: sourceId, filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#000000',
        'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 50, 31],
        'circle-opacity': .28, 'circle-blur': .65, 'circle-translate': [0, 5],
      },
    });
    this.map.addLayer({
      id: 'vehicle-clusters', type: 'circle', source: sourceId, filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#8347f5', 'circle-radius': ['step', ['get', 'point_count'], 20, 10, 25, 50, 31],
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3,
      },
    });
    this.map.addLayer({
      id: 'vehicle-cluster-count', type: 'symbol', source: sourceId, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
      paint: { 'text-color': '#ffffff' },
    });
    this.map.addLayer({
      id: 'vehicle-point-shadows', type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#000000', 'circle-radius': 17, 'circle-opacity': .28,
        'circle-blur': .65, 'circle-translate': [0, 5],
      },
    });
    this.map.addLayer({
      id: 'vehicle-points', type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['match', ['get', 'status'], 'Moving', '#10b981', 'Idling', '#f59e0b', 'Alert', '#ef4444', '#64748b'],
        'circle-radius': 17, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3,
      },
    });
    this.map.addLayer({
      id: 'vehicle-point-label', type: 'symbol', source: sourceId, filter: ['!', ['has', 'point_count']],
      layout: { 'text-field': ['get', 'label'], 'text-size': 10 },
      paint: { 'text-color': '#ffffff' },
    });
    this.map.on('click', 'vehicle-clusters', (event) => {
      const feature = this.map?.queryRenderedFeatures(event.point, { layers: ['vehicle-clusters'] })[0];
      const clusterId = Number(feature?.properties?.['cluster_id']);
      if (!this.map || !feature || !Number.isFinite(clusterId) || feature.geometry.type !== 'Point') return;
      const clusterSource = this.map.getSource(sourceId) as GeoJSONSource;
      clusterSource.getClusterExpansionZoom(clusterId).then((zoom) => {
        if (feature.geometry.type === 'Point') this.map?.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 500 });
      });
    });
    this.map.on('click', 'vehicle-points', (event) => {
      const id = String(event.features?.[0]?.properties?.['id'] ?? '');
      const vehicle = this.vehicles().find((item) => item.id === id);
      if (vehicle) {
        this.focusVehicle(vehicle);
        this.vehicleSelected.emit(vehicle);
      }
    });
    for (const layer of ['vehicle-clusters', 'vehicle-points']) {
      this.map.on('mouseenter', layer, () => { if (this.map) this.map.getCanvas().style.cursor = 'pointer'; });
      this.map.on('mouseleave', layer, () => { if (this.map) this.map.getCanvas().style.cursor = ''; });
    }
  }

  private vehicleSetKey(vehicles: TrackedVehicle[]): string {
    return vehicles.map(({ id }) => id).sort().join('|');
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
    this.map?.easeTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 16,
      pitch: 55,
      bearing: -18,
      duration: 650,
      easing: (progress) => 1 - Math.pow(1 - progress, 3),
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
    clearTimeout(this.readyFallback);
    this.map?.remove();
  }
}
