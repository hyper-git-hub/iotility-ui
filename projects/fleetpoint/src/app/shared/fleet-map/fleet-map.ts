import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild,
} from '@angular/core';
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, circlePolygon, createIotMap, fitLatLngs, lineFeature, markerElement,
  polygonFeature, popupHtml, removeGeoJson, upsertGeoJson,
} from '../maps/maplibre';
import { MapControls } from '../map-overlays/map-controls';
import { LocationSearch, LocationSelect } from '../map-overlays/location-search';

export type VehicleStatus = 'Moving' | 'Idling' | 'Alert' | 'Offline';
export interface TrackedVehicle {
  id: string; model: string; driver: string; status: VehicleStatus; speed: number;
  fuel: number; location: string; updated: string; lat: number; lng: number;
  image?: string | null;
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
  imports: [MapControls, LocationSearch],
})
export class FleetMap implements AfterViewInit, OnDestroy {
  readonly vehicles = input.required<TrackedVehicle[]>();
  readonly zones = input<MapZoneOverlay[]>([]);
  readonly showMarkers = input(true);
  readonly clusterMarkers = input(false);
  readonly fitZoomOffset = input(0);
  readonly selectedVehicleId = input<string | null>(null);
  readonly showOverlays = input(true);
  readonly hasLeftOverlays = input(false);
  readonly isFullscreen = input(false);
  readonly detailsPanelOpen = input(false);
  readonly vehicleSelected = output<TrackedVehicle>();
  readonly fullscreenVehicleClick = output<TrackedVehicle>();
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
    effect(() => {
      const panelOpen = this.detailsPanelOpen();
      const vehicle = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
      if (vehicle && this.map) this.focusVehicle(vehicle);
    });
    effect(() => {
      const selectedId = this.selectedVehicleId();
      if (this.map) this.updateMarkerSelection(selectedId);
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

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  onToggle3D(): void {
    if (!this.map) return;
    const pitch = this.map.getPitch();
    this.map.easeTo({ pitch: pitch > 0 ? 0 : 60, duration: 500 });
  }

  onResetNorth(): void {
    this.map?.easeTo({ bearing: 0, duration: 500 });
  }

  onRotate(): void {
    if (!this.map) return;
    const bearing = this.map.getBearing();
    this.map.easeTo({ bearing: bearing + 90, duration: 500 });
  }

  onGeolocate(): void {
    if (!this.map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.map?.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 700 });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  onFullscreenToggle(): void {
    if (!this.mapElement) return;
    const container = this.mapElement().nativeElement.closest('.map-area') ?? this.mapElement().nativeElement.parentElement;
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }

  onLocationSelect(location: LocationSelect): void {
    this.map?.easeTo({ center: [location.lng, location.lat], zoom: 14, duration: 700 });
  }

  get mapInstance(): MapLibreMap | undefined {
    return this.map;
  }

  private renderMarkers(
    vehicles: TrackedVehicle[],
    fit = false,
    show = true,
    cluster = false,
    selectedId: string | null = this.selectedVehicleId(),
  ): void {
    if (!this.map) return;
    this.markers.forEach((item) => item.remove());
    this.markers.clear();
    if (cluster) this.renderClusteredMarkers(show ? vehicles : []);
    else for (const vehicle of show ? vehicles : []) {
      const element = this.createVehicleMarker(vehicle, selectedId);
      element.addEventListener('click', () => {
        this.focusVehicle(vehicle);
        if (this.isFullscreen()) {
          this.fullscreenVehicleClick.emit(vehicle);
        } else {
          this.vehicleSelected.emit(vehicle);
        }
      });
      const item = new maplibregl.Marker({ element })
        .setLngLat([vehicle.lng, vehicle.lat])
        .setPopup(popupHtml(this.vehiclePopupHtml(vehicle)))
        .addTo(this.map);
      element.addEventListener('mouseenter', () => {
        if (item.getPopup() && !item.getPopup()?.isOpen()) item.togglePopup();
      });
      element.addEventListener('mouseleave', () => {
        if (item.getPopup()?.isOpen()) item.togglePopup();
      });
      this.markers.set(vehicle.id, item);
    }
    if (fit && vehicles.length) {
      fitLatLngs(this.map, vehicles.map(({ lat, lng }) => [lat, lng]), 48, 15 + this.fitZoomOffset());
      this.fittedVehicleSet = this.vehicleSetKey(vehicles);
    }
  }

  private updateMarkerSelection(selectedId: string | null): void {
    this.markers.forEach((item, id) => {
      const vehicle = this.vehicles().find((v) => v.id === id);
      if (!vehicle) return;
      const selected = id === selectedId;
      const size = selected ? 44 : 34;
      const color = this.statusColor(vehicle.status);
      const element = item.getElement();
      if (!element) return;
      const markerDiv = element.querySelector('.vehicle-marker') as HTMLElement | null;
      if (!markerDiv) return;
      markerDiv.className = `vehicle-marker${selected ? ' selected' : ''}`;
      markerDiv.style.width = `${size}px`;
      markerDiv.style.height = `${size}px`;
      markerDiv.style.borderColor = color;
      markerDiv.style.boxShadow = `0 2px 8px rgb(0 0 0 / .25)${selected ? `, 0 0 0 4px ${color}44` : ''}`;
    });
  }

  private createVehicleMarker(vehicle: TrackedVehicle, selectedId: string | null): HTMLElement {
    const selected = vehicle.id === selectedId;
    const size = selected ? 44 : 34;
    const color = this.statusColor(vehicle.status);
    const image = this.vehicleImageUrl(vehicle.image);
    return markerElement(`
      <div class="vehicle-marker${selected ? ' selected' : ''}"
        style="width:${size}px;height:${size}px;border-color:${color};
          box-shadow:0 2px 8px rgb(0 0 0 / .25)${selected ? `, 0 0 0 4px ${color}44` : ''}">
        <img src="${image}" alt="${vehicle.id}">
      </div>
    `);
  }

  private vehiclePopupHtml(vehicle: TrackedVehicle): string {
    const statusColor = this.statusColor(vehicle.status);
    const speed = vehicle.speed > 0 ? `<span class="vp-detail">${Math.round(vehicle.speed)} km/h</span>` : '';
    const fuel = vehicle.fuel > 0 ? `<span class="vp-detail">Fuel ${Math.round(vehicle.fuel)}%</span>` : '';
    const footerText = this.isFullscreen() ? 'Click to enable live tracking' : 'Click for full details';
    return `
      <div class="vehicle-popup">
        <div class="vp-head">
          <img class="vp-thumb" src="${this.vehicleImageUrl(vehicle.image)}" alt="" />
          <div class="vp-title">
            <strong>${vehicle.id}</strong>
            <small>${vehicle.model}</small>
          </div>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="vp-text">${vehicle.driver}</span>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="vp-text"><span class="vp-status" style="color:${statusColor}">${vehicle.status}</span> ${speed}${fuel}</span>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="vp-text vp-location">${vehicle.location}</span>
        </div>
        <div class="vp-foot">${footerText}</div>
      </div>`;
  }

  private vehicleImageUrl(image: string | null | undefined): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/def-car.svg';
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
        if (this.isFullscreen()) {
          this.fullscreenVehicleClick.emit(vehicle);
        } else {
          this.vehicleSelected.emit(vehicle);
        }
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
    if (!this.map) return;
    this.map.flyTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 16,
      pitch: 55,
      bearing: -18,
      duration: 900,
      essential: true,
    });
    const marker = this.markers.get(vehicle.id);
    if (marker && marker.getPopup() && !marker.getPopup()?.isOpen()) marker.togglePopup();
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
