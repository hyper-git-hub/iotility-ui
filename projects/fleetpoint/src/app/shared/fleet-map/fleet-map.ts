import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, circlePolygon, createIotMap, fitLatLngs, lineFeature, markerElement,
  polygonFeature, popupHtml, removeGeoJson, timezoneCountryCenter, upsertGeoJson,
} from '../maps/maplibre';
import { MapControls } from '../map-overlays/map-controls';
import { FullscreenUiService } from '../services/fullscreen-ui.service';

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
  imports: [MapControls],
})
export class FleetMap implements AfterViewInit, OnDestroy {
  readonly vehicles = input.required<TrackedVehicle[]>();
  readonly zones = input<MapZoneOverlay[]>([]);
  readonly showMarkers = input(true);
  readonly clusterMarkers = input(true);
  readonly fitZoomOffset = input(0);
  readonly selectedVehicleId = input<string | null>(null);
  readonly showOverlays = input(true);
  readonly isFullscreen = input(false);
  readonly detailsPanelOpen = input(false);
  readonly vehicleSelected = output<TrackedVehicle>();
  readonly fullscreenVehicleClick = output<TrackedVehicle>();
  readonly fullscreenChanged = output<boolean>();
  readonly ready = output<void>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly fullscreenUi = inject(FullscreenUiService);
  private map?: MapLibreMap;
  private readonly markers = new Map<string, maplibregl.Marker>();
  private clusterEnabled = false;
  private readonly clusterBadges = new Map<string, maplibregl.Marker>();
  private readonly clusterBadgeDivs = new Map<string, HTMLElement>();
  private clusterMoveBound = false;
  private clusterSyncFrame?: number;
  private readonly onClusterMove = () => this.queueClusterRerender();
  private fittedVehicleSet = '';
  private initialFitPending = true;
  private resizeObserver?: ResizeObserver;
  private readyFallback?: ReturnType<typeof setTimeout>;
  private readyEmitted = false;

  constructor() {
    effect(() => {
      const vehicles = this.vehicles(), showMarkers = this.showMarkers(), clusterMarkers = this.clusterMarkers();
      if (this.map) {
        // Data membership updates must NOT re-fit the camera (a re-fit would
        // drop the zoom low enough to collapse everything into one cluster).
        // Initial fit is owned by the load/resize path via `initialFitPending`.
        this.renderMarkers(vehicles, false, showMarkers, clusterMarkers);
      }
    });
    effect(() => {
      const zones = this.zones();
      if (this.map?.isStyleLoaded()) this.renderZones(zones);
    });
    effect(() => {
      const panelOpen = this.detailsPanelOpen();
      const isFullscreen = this.isFullscreen();
      const panelPadding = panelOpen && !isFullscreen && !matchMedia('(max-width: 900px)').matches ? 320 : 0;
      const selected = this.vehicles().find(({ id }) => id === this.selectedVehicleId());
      this.map?.easeTo({
        ...(selected ? { center: [selected.lng, selected.lat] as [number, number] } : {}),
        padding: { top: 0, bottom: 0, left: 0, right: panelPadding },
        duration: 400,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    });
    effect(() => {
      const selectedId = this.selectedVehicleId();
      const vehicle = this.vehicles().find(({ id }) => id === selectedId);
      if (vehicle && this.map) this.focusVehicle(vehicle);
    });
    effect(() => {
      const selectedId = this.selectedVehicleId();
      if (this.map) this.updateMarkerSelection(selectedId);
    });
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, timezoneCountryCenter(), 4);
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
      if (this.initialFitPending && this.vehicles().length)
        this.renderMarkers(this.vehicles(), true, this.showMarkers(), this.clusterMarkers());
    });
    this.resizeObserver.observe(this.mapElement().nativeElement);
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
    const entering = !this.isFullscreen();
    this.fullscreenUi.toggle();
    this.fullscreenChanged.emit(entering);
    requestAnimationFrame(() => requestAnimationFrame(() => this.map?.resize()));
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
    this.clusterEnabled = cluster;
    if (!cluster) {
      this.clearClusterBadges();
      this.unbindClusterMove();
    }
    for (const vehicle of show ? vehicles : []) {
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
    if (cluster) {
      this.bindClusterMove();
      this.recomputeClusters();
    }
    const selected = vehicles.find(({ id }) => id === selectedId);
    if (selected && this.markers.has(selected.id)) this.updateMarkerSelection(selected.id);
    if (fit && vehicles.length) {
      fitLatLngs(this.map, vehicles.map(({ lat, lng }) => [lat, lng]), 48, 15 + this.fitZoomOffset());
      if (this.map.getContainer().clientWidth > 0 && this.map.getContainer().clientHeight > 0) {
        this.fittedVehicleSet = this.vehicleSetKey(vehicles);
        this.initialFitPending = false;
      }
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
        <img src="${image}" alt="${vehicle.id}" onerror="this.onerror=null;this.src='assets/fleetpoint/def-car.svg'">
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
          <img class="vp-thumb" src="${this.vehicleImageUrl(vehicle.image)}" alt="" onerror="this.onerror=null;this.src='assets/fleetpoint/def-car.svg'" />
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

  // ── Custom zoom-aware clustering ─────────────────────────────
  // Keeps the original sedan vehicle markers: nearby markers collapse
  // into a single themed count badge, and zooming in returns them to
  // individual markers. Grouping is driven purely by map zoom level so
  // it is stable (no flicker between group/single while panning).
  // Cluster by a fixed on-screen distance. The previous degree-based radius
  // changed meaning by latitude and zoom level, which made identical camera
  // views occasionally disagree about whether markers should be grouped.
  private static readonly CLUSTER_PIXEL_RADIUS = 56;

  private bindClusterMove(): void {
    if (!this.map || this.clusterMoveBound) return;
    this.clusterMoveBound = true;
    this.map.on('zoom', this.onClusterMove);
    this.map.on('zoomend', this.onClusterMove);
    this.map.on('moveend', this.onClusterMove);
  }

  private unbindClusterMove(): void {
    if (!this.map || !this.clusterMoveBound) return;
    this.clusterMoveBound = false;
    this.map.off('zoom', this.onClusterMove);
    this.map.off('zoomend', this.onClusterMove);
    this.map.off('moveend', this.onClusterMove);
  }

  private queueClusterRerender(): void {
    // Grouping is purely zoom-driven: run once per animation frame and
    // once more when the gesture settles so markers/badges swap instantly
    // without churn or overlap.
    if (this.clusterSyncFrame !== undefined) return;
    this.clusterSyncFrame = requestAnimationFrame(() => {
      this.clusterSyncFrame = undefined;
      this.recomputeClusters();
    });
  }

  private clearClusterBadges(): void {
    this.clusterBadges.forEach((marker) => marker.remove());
    this.clusterBadges.clear();
    this.clusterBadgeDivs.clear();
    this.markers.forEach((marker) => {
      marker.getElement().style.display = '';
    });
  }

  private recomputeClusters(): void {
    if (!this.map?.isStyleLoaded() || !this.clusterEnabled) return;

    interface ClusterGroup { lng: number; lat: number; ids: string[]; key: string; color: string; }
    const visibleVehicles = this.vehicles()
      .filter(({ id }) => this.markers.has(id))
      .sort((a, b) => a.id.localeCompare(b.id));
    const projected = visibleVehicles.map(({ lng, lat }) => this.map!.project([lng, lat]));
    const parents = visibleVehicles.map((_, index) => index);
    const find = (index: number): number => {
      while (parents[index] !== index) {
        parents[index] = parents[parents[index]];
        index = parents[index];
      }
      return index;
    };
    const join = (left: number, right: number): void => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
    };
    for (let left = 0; left < projected.length; left += 1) {
      for (let right = left + 1; right < projected.length; right += 1) {
        const dx = projected[left].x - projected[right].x;
        const dy = projected[left].y - projected[right].y;
        if (Math.hypot(dx, dy) <= FleetMap.CLUSTER_PIXEL_RADIUS) join(left, right);
      }
    }
    const membersByRoot = new Map<number, TrackedVehicle[]>();
    visibleVehicles.forEach((vehicle, index) => {
      const root = find(index);
      const members = membersByRoot.get(root) ?? [];
      members.push(vehicle);
      membersByRoot.set(root, members);
    });
    const groups: ClusterGroup[] = [...membersByRoot.values()].map((members) => {
      const ids = members.map(({ id }) => id).sort();
      const lng = members.reduce((sum, vehicle) => sum + vehicle.lng, 0) / members.length;
      const lat = members.reduce((sum, vehicle) => sum + vehicle.lat, 0) / members.length;
      return { lng, lat, ids, key: ids.join('|'), color: this.badgeColor(ids) };
    });

    // 1) Hide grouped vehicle markers and reveal ungrouped ones instantly.
    const groupedAtLeastTwo = new Set<string>();
    for (const group of groups) {
      if (group.ids.length > 1) group.ids.forEach((id) => groupedAtLeastTwo.add(id));
    }
    this.markers.forEach((marker, id) => {
      marker.getElement().style.display = groupedAtLeastTwo.has(id) ? 'none' : '';
    });

    // 2) Remove stale cluster badges first (immediate, no overlap).
    const activeKeys = new Set<string>();
    for (const group of groups) {
      if (group.ids.length > 1) activeKeys.add(group.key);
    }
    for (const key of this.clusterBadges.keys()) {
      if (activeKeys.has(key)) continue;
      this.clusterBadges.get(key)?.remove();
      this.clusterBadges.delete(key);
      this.clusterBadgeDivs.delete(key);
    }

    // 3) Reuse existing badges (update position/count/ring) or create new ones.
    for (const group of groups) {
      if (group.ids.length < 2) continue;
      let marker = this.clusterBadges.get(group.key);
      if (!marker) {
        const div = document.createElement('div');
        div.className = 'vehicle-cluster';
        div.setAttribute('role', 'button');
        div.setAttribute('tabindex', '0');
        const countLabel = document.createElement('span');
        countLabel.className = 'vehicle-cluster__count';
        div.append(countLabel);
        const expand = () => {
          const lng = Number(div.dataset['lng']);
          const lat = Number(div.dataset['lat']);
          const clusterCount = Number(div.dataset['count']);
          if (Number.isFinite(lng) && Number.isFinite(lat) && Number.isFinite(clusterCount)) {
            this.expandCluster([lng, lat], clusterCount);
          }
        };
        div.addEventListener('click', expand);
        div.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          expand();
        });
        marker = new maplibregl.Marker({ element: div, anchor: 'center' }).setLngLat([group.lng, group.lat]).addTo(this.map!);
        this.clusterBadges.set(group.key, marker);
        this.clusterBadgeDivs.set(group.key, div);
      }
      const div = this.clusterBadgeDivs.get(group.key)!;
      const count = group.ids.length;
      const size = count >= 100 ? 44 : count >= 50 ? 41 : count >= 10 ? 38 : 34;
      const label = count >= 100 ? '99+' : String(count);
      div.style.width = `${size}px`;
      div.style.height = `${size}px`;
      div.style.setProperty('--cluster-font-size', `${Math.round(size * 0.35)}px`);
      div.style.setProperty('--cluster-brand', this.brandColor());
      div.style.setProperty('--cluster-status', group.color);
      div.dataset['lng'] = String(group.lng);
      div.dataset['lat'] = String(group.lat);
      div.dataset['count'] = String(count);
      const countLabel = div.querySelector<HTMLElement>('.vehicle-cluster__count');
      if (countLabel) countLabel.textContent = label;
      div.setAttribute('aria-label', `${count} vehicles`);
      marker.setLngLat([group.lng, group.lat]);
    }
  }

  // Highest-severity status among the grouped vehicles → badge ring color:
  // Alert > Moving (online) > Idling > Offline.
  private badgeColor(ids: string[]): string {
    const rank: Record<string, number> = { Alert: 3, Moving: 2, Idling: 1, Offline: 0 };
    let best = 'Offline';
    for (const id of ids) {
      const vehicle = this.vehicles().find((item) => item.id === id);
      const status = vehicle?.status ?? 'Offline';
      if ((rank[status] ?? 0) > (rank[best] ?? 0)) best = status;
    }
    return this.statusColor(best as VehicleStatus);
  }

  private expandCluster(center: [number, number], count: number): void {
    if (!this.map) return;
    this.map.easeTo({
      center,
      zoom: Math.min(this.map.getZoom() + 3, count >= 50 ? 18 : 21),
      duration: 500,
    });
  }

  private brandColor(): string {
    const styles = getComputedStyle(document.documentElement);
    const value = styles.getPropertyValue('--color-brand-600').trim();
    return value || '#7c3aed';
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
    const panelPadding = this.detailsPanelOpen() && !this.isFullscreen() &&
      !matchMedia('(max-width: 900px)').matches ? 320 : 0;
    this.map.flyTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 16,
      pitch: 55,
      bearing: -18,
      duration: 1200,
      essential: true,
      padding: { top: 0, bottom: 0, left: 0, right: panelPadding },
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
    if (this.clusterSyncFrame !== undefined) cancelAnimationFrame(this.clusterSyncFrame);
    clearTimeout(this.readyFallback);
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
