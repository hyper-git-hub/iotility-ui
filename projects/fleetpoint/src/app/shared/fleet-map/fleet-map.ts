import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, output, signal, untracked,
  viewChild,
} from '@angular/core';
import maplibregl, { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, circlePolygon, createIotMap, fitLatLngs, lineFeature, markerElement,
  overlaySafePadding, polygonFeature, popupHtml, removeGeoJson, timezoneCountryCenter, upsertGeoJson,
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
  /**
   * Filter signature (fleet / status / search). Changing it re-frames the
   * camera on the currently visible markers instead of leaving the map parked
   * at the zoom of the vehicle that was focused before the filter changed.
   * Realtime ticks and polls reuse the same key, so they never move the camera.
   */
  readonly fitKey = input('');
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
  private readonly markerVehicles = new Map<string, TrackedVehicle>();
  private readonly markerPopupContent = new Map<string, string>();
  private clusterEnabled = false;
  private readonly clusterBadges = new Map<string, maplibregl.Marker>();
  private readonly clusterBadgeDivs = new Map<string, HTMLElement>();
  private clusteredPairs = new Set<string>();
  private clusterMoveBound = false;
  private clusterSyncFrame?: number;
  private readonly onClusterMove = () => this.queueClusterRerender();
  private initialFitPending = true;
  private lastFitKey = '';
  private lastCenterKey = '';
  // Camera-follow bookkeeping for the selected vehicle: which selection the
  // camera follows, the last filter key observed, and whether a filter edit
  // suspended the follow (only the next selection change resumes it).
  private followedSelectionId: string | null = null;
  private observedFitKey = '';
  private followSuspended = false;
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
    // A filter edit (fleet / status / search) reshapes the visible marker set,
    // so re-frame the camera on it — otherwise the map stays parked at the zoom
    // of the vehicle that was focused before the filter changed. Only `fitKey`
    // edits re-fit: realtime ticks and 30s polls reuse the same key, so they
    // never reset a manual pan/zoom or collapse every marker into one cluster.
    effect(() => {
      const fitKey = this.fitKey();
      const vehicles = this.vehicles();
      if (!this.map || !vehicles.length || fitKey === this.lastFitKey) return;
      // `fitVehicles` records the key it framed, so this only runs when a
      // filter edit lands without a concurrent size/load fit.
      this.fitVehicles(vehicles);
    });
    effect(() => {
      const zones = this.zones();
      if (this.map?.isStyleLoaded()) this.renderZones(zones);
    });
    // Keeps the selected marker clear of the details panel. Driven by the
    // selection and the panel width only: realtime ticks reshape the vehicle
    // array every few seconds and must not re-aim the camera, or they would undo
    // a filter-driven re-fit moments after it lands.
    effect(() => {
      const selectedId = this.selectedVehicleId();
      const padding = this.panelPadding();
      const key = `${selectedId}|${padding}`;
      // Claim the key only once the camera is actually available. Recording it
      // before this guard let a selection made during startup consume the key
      // while the map was still null, so that centre-on-select never ran.
      if (!this.map || key === this.lastCenterKey) return;
      this.lastCenterKey = key;
      const selected = untracked(() => this.vehicles()).find(({ id }) => id === selectedId);
      this.map.easeTo({
        ...(selected ? { center: [selected.lng, selected.lat] as [number, number] } : {}),
        padding,
        duration: 400,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    });
    // Locks the camera onto the selected vehicle (zoom 14, panel-padded) and
    // follows it as its position updates — but only for a selection made after
    // the last filter edit. A fleet / status / search change re-frames the whole
    // visible marker set (see the `fitKey` effect above), so the follow is
    // suspended instead of snapping back to the vehicle that was zoomed in
    // before the filter changed; selecting a vehicle resumes it.
    effect(() => {
      const selectedId = this.selectedVehicleId();
      const fitKey = this.fitKey();
      const vehicle = this.vehicles().find(({ id }) => id === selectedId);
      if (!this.map) return;
      if (fitKey !== this.observedFitKey) {
        this.observedFitKey = fitKey;
        this.followSuspended = true;
      }
      if (this.followedSelectionId !== selectedId) {
        this.followedSelectionId = selectedId;
        this.followSuspended = false;
        if (selectedId && vehicle) this.focusVehicle(vehicle);
        return;
      }
      if (!selectedId || this.followSuspended || !vehicle) return;
      this.focusVehicle(vehicle);
    });
    effect(() => {
      const selectedId = this.selectedVehicleId();
      if (this.map) this.updateMarkerSelection(selectedId);
    });
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, timezoneCountryCenter(), 4, {
      maxZoom: 24,
    });
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
    this.clusterEnabled = cluster;
    if (!cluster) {
      this.clearClusterBadges();
      this.clusteredPairs.clear();
      this.unbindClusterMove();
    }
    const visibleVehicles = show ? vehicles : [];
    const visibleIds = new Set(visibleVehicles.map(({ id }) => id));
    this.markers.forEach((marker, id) => {
      if (visibleIds.has(id)) return;
      marker.remove();
      this.markers.delete(id);
      this.markerVehicles.delete(id);
      this.markerPopupContent.delete(id);
    });

    for (const vehicle of visibleVehicles) {
      this.markerVehicles.set(vehicle.id, vehicle);
      let item = this.markers.get(vehicle.id);
      if (!item) {
        const element = this.createVehicleMarker(vehicle, selectedId);
        element.addEventListener('click', () => {
          const current = this.markerVehicles.get(vehicle.id);
          if (!current) return;
          this.focusVehicle(current);
          if (this.isFullscreen()) {
            this.fullscreenVehicleClick.emit(current);
          } else {
            this.vehicleSelected.emit(current);
          }
        });
        item = new maplibregl.Marker({ element })
          .setLngLat([vehicle.lng, vehicle.lat])
          .setPopup(popupHtml(this.vehiclePopupHtml(vehicle)))
          .addTo(this.map);
        element.addEventListener('mouseenter', () => {
          if (item?.getPopup() && !item.getPopup()?.isOpen()) item.togglePopup();
        });
        element.addEventListener('mouseleave', () => {
          if (item?.getPopup()?.isOpen()) item.togglePopup();
        });
        this.markers.set(vehicle.id, item);
        this.markerPopupContent.set(vehicle.id, this.vehiclePopupHtml(vehicle));
      } else {
        const position = item.getLngLat();
        if (position.lng !== vehicle.lng || position.lat !== vehicle.lat) {
          item.setLngLat([vehicle.lng, vehicle.lat]);
        }
        const popupContent = this.vehiclePopupHtml(vehicle);
        if (this.markerPopupContent.get(vehicle.id) !== popupContent) {
          item.setPopup(popupHtml(popupContent));
          this.markerPopupContent.set(vehicle.id, popupContent);
        }
        this.updateVehicleMarker(item, vehicle, selectedId);
      }
    }
    if (cluster) {
      this.bindClusterMove();
      this.queueClusterRerender();
    }
    const selected = vehicles.find(({ id }) => id === selectedId);
    if (selected && this.markers.has(selected.id)) this.updateMarkerSelection(selected.id);
    if (fit) this.fitVehicles(vehicles);
  }

  // Frames the given markers, reserving room for the details panel so a re-fit
  // never parks markers underneath it. Shared by the initial load/resize fit and
  // the filter-driven re-fit in the constructor effect.
  private fitVehicles(vehicles: TrackedVehicle[]): void {
    if (!this.map || !vehicles.length) return;
    const container = this.map.getContainer();
    if (container.clientWidth <= 0 || container.clientHeight <= 0) return;
    const panelPadding = this.panelPadding();
    // Fullscreen shows the search overlay along the top-left edge of the map, so
    // that side needs the extra room the drawer takes on the right.
    const searchPadding = this.isFullscreen() ? 400 : 0;
    const padding = { top: 48, bottom: 48, left: 48 + searchPadding, right: 48 + panelPadding };
    fitLatLngs(
      this.map,
      vehicles.map(({ lat, lng }) => [lat, lng]),
      padding,
      15 + this.fitZoomOffset(),
    );
    // Every fit consumes the filter key it framed, so the `fitKey` effect above
    // only re-fits on the next filter edit (never on a realtime tick or poll).
    this.lastFitKey = this.fitKey();
    this.initialFitPending = false;
  }

  private updateMarkerSelection(selectedId: string | null): void {
    this.markers.forEach((item, id) => {
      const vehicle = this.markerVehicles.get(id);
      if (!vehicle) return;
      this.updateVehicleMarker(item, vehicle, selectedId);
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

  private updateVehicleMarker(
    marker: maplibregl.Marker,
    vehicle: TrackedVehicle,
    selectedId: string | null,
  ): void {
    const element = marker.getElement().querySelector<HTMLElement>('.vehicle-marker');
    if (!element) return;
    const selected = vehicle.id === selectedId;
    const size = selected ? 44 : 34;
    const width = `${size}px`;
    const color = this.statusColor(vehicle.status);
    element.className = `vehicle-marker${selected ? ' selected' : ''}`;
    if (element.style.width !== width) element.style.width = width;
    if (element.style.height !== width) element.style.height = width;
    if (element.style.borderColor !== color) element.style.borderColor = color;
    const shadow = `0 2px 8px rgb(0 0 0 / .25)${selected ? `, 0 0 0 4px ${color}44` : ''}`;
    if (element.style.boxShadow !== shadow) element.style.boxShadow = shadow;
    const image = element.querySelector('img');
    const imageUrl = this.vehicleImageUrl(vehicle.image);
    if (image && image.getAttribute('src') !== imageUrl) image.src = imageUrl;
    if (image && image.alt !== vehicle.id) image.alt = vehicle.id;
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
  private static readonly CLUSTER_EXIT_PIXEL_RADIUS = 68;

  private bindClusterMove(): void {
    if (!this.map || this.clusterMoveBound) return;
    this.clusterMoveBound = true;
    this.map.on('zoom', this.onClusterMove);
    this.map.on('move', this.onClusterMove);
    this.map.on('zoomend', this.onClusterMove);
    this.map.on('moveend', this.onClusterMove);
  }

  private unbindClusterMove(): void {
    if (!this.map || !this.clusterMoveBound) return;
    this.clusterMoveBound = false;
    this.map.off('zoom', this.onClusterMove);
    this.map.off('move', this.onClusterMove);
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
      const element = marker.getElement();
      if (element.style.display) element.style.display = '';
    });
  }

  private recomputeClusters(): void {
    if (!this.map?.isStyleLoaded() || !this.clusterEnabled) return;
    if (this.map.getZoom() >= this.map.getMaxZoom() - 0.01) {
      this.clusteredPairs.clear();
      this.clearClusterBadges();
      return;
    }

    interface ClusterGroup { lng: number; lat: number; ids: string[]; key: string; color: string; }
    const visibleVehicles = this.vehicles()
      .filter(({ id }) => this.markers.has(id));
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
    const cellSize = FleetMap.CLUSTER_PIXEL_RADIUS / Math.SQRT2;
    const neighborCellRadius = Math.ceil(FleetMap.CLUSTER_EXIT_PIXEL_RADIUS / cellSize);
    const cellBuckets = new Map<string, number[]>();
    const nextClusteredPairs = new Set<string>();
    const enterRadiusSquared = FleetMap.CLUSTER_PIXEL_RADIUS ** 2;
    const exitRadiusSquared = FleetMap.CLUSTER_EXIT_PIXEL_RADIUS ** 2;
    const pairKey = (first: string, second: string) =>
      first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`;

    for (let index = 0; index < projected.length; index += 1) {
      const point = projected[index];
      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);
      for (let offsetX = -neighborCellRadius; offsetX <= neighborCellRadius; offsetX += 1) {
        for (let offsetY = -neighborCellRadius; offsetY <= neighborCellRadius; offsetY += 1) {
          const neighbors = cellBuckets.get(`${cellX + offsetX}:${cellY + offsetY}`);
          if (!neighbors) continue;
          if (offsetX === 0 && offsetY === 0) {
            const representative = neighbors[0];
            const key = pairKey(visibleVehicles[index].id, visibleVehicles[representative].id);
            join(index, representative);
            nextClusteredPairs.add(key);
            continue;
          }
          if (find(index) === find(neighbors[0])) continue;
          for (const neighborIndex of neighbors) {
            if (find(index) === find(neighborIndex)) continue;
            const dx = point.x - projected[neighborIndex].x;
            const dy = point.y - projected[neighborIndex].y;
            const key = pairKey(visibleVehicles[index].id, visibleVehicles[neighborIndex].id);
            const limit = this.clusteredPairs.has(key) ? exitRadiusSquared : enterRadiusSquared;
            if (dx * dx + dy * dy > limit) continue;
            join(index, neighborIndex);
            nextClusteredPairs.add(key);
            break;
          }
        }
      }
      const cellKey = `${cellX}:${cellY}`;
      const bucket = cellBuckets.get(cellKey) ?? [];
      bucket.push(index);
      cellBuckets.set(cellKey, bucket);
    }
    this.clusteredPairs = nextClusteredPairs;
    const membersByRoot = new Map<number, TrackedVehicle[]>();
    visibleVehicles.forEach((vehicle, index) => {
      const root = find(index);
      const members = membersByRoot.get(root) ?? [];
      members.push(vehicle);
      membersByRoot.set(root, members);
    });
    const statusById = new Map(visibleVehicles.map(({ id, status }) => [id, status]));
    const groups: ClusterGroup[] = [...membersByRoot.values()].map((members) => {
      const ids = members.map(({ id }) => id).sort();
      const lng = members.reduce((sum, vehicle) => sum + vehicle.lng, 0) / members.length;
      const lat = members.reduce((sum, vehicle) => sum + vehicle.lat, 0) / members.length;
      return { lng, lat, ids, key: ids.join('|'), color: this.badgeColor(ids, statusById) };
    });

    // 1) Hide grouped vehicle markers and reveal ungrouped ones instantly.
    const groupedAtLeastTwo = new Set<string>();
    for (const group of groups) {
      if (group.ids.length > 1) group.ids.forEach((id) => groupedAtLeastTwo.add(id));
    }
    this.markers.forEach((marker, id) => {
      const display = groupedAtLeastTwo.has(id) ? 'none' : '';
      if (marker.getElement().style.display !== display) marker.getElement().style.display = display;
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
    const clusterBrand = this.brandColor();
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
        const expand = (event?: Event) => {
          event?.preventDefault();
          event?.stopPropagation();
          const lng = Number(div.dataset['lng']);
          const lat = Number(div.dataset['lat']);
          const ids = JSON.parse(div.dataset['ids'] ?? '[]') as string[];
          if (Number.isFinite(lng) && Number.isFinite(lat) && ids.length > 1) {
            this.expandCluster([lng, lat], ids);
          }
        };
        div.addEventListener('pointerdown', (event) => {
          if (event.button === 0) expand(event);
        }, { capture: true });
        div.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        }, { capture: true });
        div.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
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
      const width = `${size}px`;
      const fontSize = `${Math.round(size * 0.35)}px`;
      if (div.style.width !== width) div.style.width = width;
      if (div.style.height !== width) div.style.height = width;
      if (div.style.getPropertyValue('--cluster-font-size') !== fontSize)
        div.style.setProperty('--cluster-font-size', fontSize);
      if (div.style.getPropertyValue('--cluster-brand') !== clusterBrand)
        div.style.setProperty('--cluster-brand', clusterBrand);
      if (div.style.getPropertyValue('--cluster-status') !== group.color)
        div.style.setProperty('--cluster-status', group.color);
      const positionKey = `${group.lng},${group.lat}`;
      if (div.dataset['position'] !== positionKey) {
        marker.setLngLat([group.lng, group.lat]);
        div.dataset['position'] = positionKey;
        // The expand handler reads the cluster centre back off the dataset.
        // Without these the click resolves lng/lat to NaN and does nothing.
        div.dataset['lng'] = String(group.lng);
        div.dataset['lat'] = String(group.lat);
      }
      if (div.dataset['count'] !== String(count)) div.dataset['count'] = String(count);
      const ids = JSON.stringify(group.ids);
      if (div.dataset['ids'] !== ids) div.dataset['ids'] = ids;
      const countLabel = div.querySelector<HTMLElement>('.vehicle-cluster__count');
      if (countLabel && countLabel.textContent !== label) countLabel.textContent = label;
      const ariaLabel = `${count} vehicles`;
      if (div.getAttribute('aria-label') !== ariaLabel) div.setAttribute('aria-label', ariaLabel);
    }
  }

  // Highest-severity status among the grouped vehicles → badge ring color:
  // Alert > Moving (online) > Idling > Offline.
  private badgeColor(ids: string[], statusById: ReadonlyMap<string, VehicleStatus>): string {
    const rank: Record<string, number> = { Alert: 3, Moving: 2, Idling: 1, Offline: 0 };
    let best = 'Offline';
    for (const id of ids) {
      const status = statusById.get(id) ?? 'Offline';
      if ((rank[status] ?? 0) > (rank[best] ?? 0)) best = status;
    }
    return this.statusColor(best as VehicleStatus);
  }

  private expandCluster(center: [number, number], ids: string[]): void {
    if (!this.map) return;
    const vehicles = ids
      .map((id) => this.markerVehicles.get(id))
      .filter((vehicle): vehicle is TrackedVehicle => vehicle !== undefined);
    if (!vehicles.length) return;
    const bounds = new LngLatBounds();
    for (const vehicle of vehicles) bounds.extend([vehicle.lng, vehicle.lat]);
    this.map.stop();
    // Cap how far one click may travel. A tight group fits at a very high zoom,
    // so honouring the fit exactly (or the old +8 jump) rockets the camera past
    // the members and leaves the viewport empty. Members sit at the group
    // centre, so a bounded step keeps them framed.
    const ceiling = Math.min(this.map.getMaxZoom(), this.map.getZoom() + 4);
    if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
      this.map.easeTo({ center, zoom: ceiling, duration: 450 });
      this.recomputeClusters();
      return;
    }
    // Two zoom levels quadruple the on-screen separation, which clears the
    // 68px exit radius and actually splits the group; union-find can otherwise
    // chain markers into a wide box that still clusters at the fit zoom.
    const camera = this.map.cameraForBounds(bounds, {
      padding: overlaySafePadding(96),
    });
    const zoom = Math.min(ceiling, Math.max(camera?.zoom ?? 0, this.map.getZoom() + 2));
    this.map.easeTo({ center: camera?.center ?? center, zoom, duration: 450 });
  }

  private brandColor(): string {
    const styles = getComputedStyle(document.documentElement);
    const value = styles.getPropertyValue('--color-brand-600').trim();
    return value || '#7c3aed';
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

  // Width the details panel steals from the map on desktop, so camera framing
  // can keep markers clear of it (0 when the panel is closed, mobile or fullscreen).
  private panelPadding(): number {
    const desktopPanelOpen =
      this.detailsPanelOpen() && !this.isFullscreen() && !matchMedia('(max-width: 900px)').matches;
    return desktopPanelOpen ? 320 : 0;
  }

  private focusVehicle(vehicle: TrackedVehicle): void {
    if (!this.map) return;
    this.map.flyTo({
      center: [vehicle.lng, vehicle.lat],
      zoom: 14,
      duration: 1200,
      essential: true,
      padding: { top: 0, bottom: 0, left: 0, right: this.panelPadding() },
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
