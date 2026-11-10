import {
  AfterViewInit, Component, ElementRef, Injector, NgZone, OnDestroy, afterNextRender, effect, inject,
  input, output, signal, untracked, viewChild,
} from '@angular/core';
import maplibregl, { LngLatBounds, Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, LayerWithoutSource, circlePolygon, createIotMap, escapeHtml, fitLatLngs, flightEase,
  glideEase, lineFeature, markerElement, overlaySafePadding, polygonFeature, popupHtml, removeGeoJson,
  routeCasingColor, timezoneCountryCenter, upsertGeoJson,
} from '../maps/maplibre';
import { MapControls } from '../map-overlays/map-controls';
import { FullscreenUiService } from '../services/fullscreen-ui.service';
import { SmoothTrack, TrackPoint, bearingBetween, metresBetween } from '../maps/smooth-track';
import { environment } from '../../../environments/environment';

/** Road-snapped trail: a crisp core line on an edge that lifts it off the road. */
const TRAIL_LAYER_IDS = ['fleet-trail-casing', 'fleet-trail-core'];
function TRAIL_LAYERS(color: string): LayerWithoutSource[] {
  return [
    {
      id: 'fleet-trail-casing',
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': routeCasingColor(), 'line-width': 6.5, 'line-opacity': 0.9 },
    },
    {
      id: 'fleet-trail-core',
      type: 'line',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': 3.5, 'line-opacity': 0.95 },
    },
  ];
}

export type VehicleStatus = 'Moving' | 'Idling' | 'Stopped' | 'Alert' | 'Offline';
/** Ring order for cluster donuts (matches the map legend). */
const CLUSTER_STATUSES: VehicleStatus[] = ['Moving', 'Idling', 'Stopped', 'Alert', 'Offline'];
/**
 * Marker shape.
 * - `chip` (default): circular status-coloured chip with an image inside, for
 *   places and events (POIs, fill-ups, violations).
 * - `arrow`: plain directional glyph shown at full size, for navigation-style
 *   cursors that must not be clipped by the chip's circular mask.
 * - `vehicle`: a live vehicle. The status is the fill colour and the glyph says
 *   what it is doing: an arrow pointing the way it drives, a pause mark while
 *   idling, "!" on an alert. The plate shows underneath at street zoom. The
 *   photo lives in the popup, where it is big enough to recognise.
 */
export type VehicleMarkerVariant = 'chip' | 'arrow' | 'vehicle';

/** The parts of a `vehicle` marker that change after it is built. */
interface VehicleMarkerParts {
  root: HTMLElement;
  arrow: SVGElement;
  plate: HTMLElement;
  speed: HTMLElement;
}

/** Heading of a `vehicle` marker: where it is turning to, where it points now, and when that was drawn. */
interface MarkerHeading {
  target: number;
  shown: number;
  at: number;
}

const VEHICLE_MARKER_HTML = `
  <div class="vm" role="button" tabindex="0">
    <span class="vm-disc">
      <svg class="vm-glyph vm-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6 18.6 19.4 12 15.7 5.4 19.4Z"/></svg>
      <svg class="vm-glyph vm-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="7.2" y="6.5" width="3.4" height="11" rx="1.2"/><rect x="13.4" y="6.5" width="3.4" height="11" rx="1.2"/></svg>
      <svg class="vm-glyph vm-alert" viewBox="0 0 24 24" aria-hidden="true"><rect x="10.4" y="5" width="3.2" height="9.6" rx="1.6"/><circle cx="12" cy="18.2" r="1.9"/></svg>
      <svg class="vm-glyph vm-stop" viewBox="0 0 24 24" aria-hidden="true"><rect x="7.3" y="7.3" width="9.4" height="9.4" rx="2.2"/></svg>
      <span class="vm-glyph vm-dot" aria-hidden="true"></span>
    </span>
    <span class="vm-badge" aria-hidden="true">!</span>
    <span class="vm-label" aria-hidden="true"><span class="vm-plate"></span><span class="vm-speed"></span></span>
  </div>`;
export interface TrackedVehicle {
  id: string; model: string; driver: string; status: VehicleStatus; speed: number;
  fuel: number; location: string; updated: string; lat: number; lng: number;
  image?: string | null;
  /**
   * Compass bearing (degrees clockwise from north) the marker points along.
   * A live feed sets this from the snapped trail so the marker follows the road
   * instead of the raw GPS heading.
   */
  heading?: number | null;
  /** Pulses the marker halo while the record is live. */
  live?: boolean;
  /**
   * Unread violations. Alert sits on top of the movement status rather than replacing it, so a
   * `vehicle` marker keeps its status colour and gains a red "!" badge.
   */
  alert?: boolean;
  /** Marker shape; defaults to the circular `chip`. */
  variant?: VehicleMarkerVariant;
  /** Device clock (ms) of the latest fix; paces `smoothTracking` playback. */
  fixTime?: number;
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
  /**
   * Screen-space placement of the followed marker: 0.5 centres it, lower values
   * park it toward the left edge. Expressed as a fraction so it stays exact at
   * any container width (the vehicle HUD uses 0.32 to clear its speedometer).
   */
  readonly cameraOffsetX = input(0.5);
  /** Zoom used while following the selected marker. */
  readonly followZoom = input(14);
  /**
   * Ordered breadcrumb of the followed vehicle's positions. Each new point is
   * snapped to the road network with OSRM and appended to an animated trail, so
   * the path drawn on the map follows real roads rather than cutting corners.
   * Pass an empty array to clear the trail.
   */
  readonly liveTrail = input<LatLng[]>([]);
  readonly trailColor = input('');
  /**
   * Glide markers between fixes instead of jumping (shared/maps/smooth-track).
   * Only vehicles drawn as their own marker, in view and zoomed in to
   * ROUTE_MIN_ZOOM, follow the road — OSRM per packet for a whole fleet would
   * be hundreds of calls — the rest move in straight lines.
   */
  readonly smoothTracking = input(false);
  /**
   * Optional popup body builder. The default card is vehicle-shaped (thumbnail,
   * driver, speed/fuel), so a page with a different record shape — POIs, for
   * instance — supplies its own markup here and keeps the same themed popup
   * surface, close button and anchor behaviour.
   */
  readonly popupTemplate = input<((vehicle: TrackedVehicle) => string) | null>(null);
  readonly vehicleSelected = output<TrackedVehicle>();
  readonly fullscreenVehicleClick = output<TrackedVehicle>();
  readonly fullscreenChanged = output<boolean>();
  readonly ready = output<void>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly fullscreenUi = inject(FullscreenUiService);
  private readonly zone = inject(NgZone);
  private readonly injector = inject(Injector);
  /** The selection the centring effect last saw, to tell a new selection from a panel resize. */
  private lastCenterSelection: string | null = null;
  private map?: MapLibreMap;
  protected readonly mapRef = signal<MapLibreMap | undefined>(undefined);
  private readonly markers = new Map<string, maplibregl.Marker>();
  private readonly markerVehicles = new Map<string, TrackedVehicle>();
  private readonly markerPopupContent = new Map<string, string>();
  /**
   * Vehicle whose popup was opened by selection. It behaves like a pinned card:
   * it stays open until another vehicle is selected or the selection is cleared.
   */
  private pinnedPopupId: string | null = null;
  private clusterEnabled = false;
  private readonly clusterBadges = new Map<string, maplibregl.Marker>();
  private readonly clusterBadgeDivs = new Map<string, HTMLElement>();
  private clusteredPairs = new Set<string>();
  private clusterMoveBound = false;
  private zoneClickBound = false;
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
  // Smooth tracking: one tracker per vehicle, the last fix fed to it (renders
  // repeat for every vehicle on any update), and the follow-pan throttle.
  private readonly trackers = new Map<string, SmoothTrack>();
  private readonly trackedFixKeys = new Map<string, string>();
  private lastFollowPanAt = 0;
  private readonly onRoutingMove = () => this.updateRouting();
  private static readonly ROUTE_MIN_ZOOM = 14;
  private static readonly ROUTE_MAX_VEHICLES = 20;
  private readyEmitted = false;
  private routingFrame?: number;
  /** Theme status colours for the current render pass; cleared at the start of each pass. */
  private statusColorCache?: Record<VehicleStatus, string>;
  // `vehicle` markers: their live parts, their headings, and the once-per-frame
  // redraw of every arrow when the map turns or tilts under them.
  private readonly vehicleParts = new Map<string, VehicleMarkerParts>();
  private readonly headings = new Map<string, MarkerHeading>();
  private headingFrame?: number;
  private viewBearing = 0;
  private plateLabelsShown = false;
  /** Plates appear under every vehicle from here in; the selected one always shows its plate. */
  private static readonly PLATE_MIN_ZOOM = 15;
  /** How quickly an arrow swings round to a new heading (ms to cover about 63% of the turn). */
  private static readonly HEADING_EASE_MS = 160;
  /** A non-smooth marker only takes a heading from its own movement once it has moved this far. */
  private static readonly HEADING_MIN_METRES = 4;
  /** Selecting a vehicle keeps a closer zoom the user chose, up to this street-level one. */
  private static readonly FOCUS_MAX_ZOOM = 17;
  /** Selection/fullscreen/popup-builder state the markers were last rendered with. */
  private renderedContext: string | null = null;
  private renderedPopupTemplate: ((vehicle: TrackedVehicle) => string) | null = null;

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
      const selectionChanged = selectedId !== this.lastCenterSelection;
      this.lastCenterSelection = selectedId;
      // A new selection is flown to by the follow effect below, panel inset included. Moving
      // here as well started a second camera move that cut the flight off mid-way.
      if (selectionChanged && selectedId) return;
      const selected = untracked(() => this.vehicles()).find(({ id }) => id === selectedId);
      this.map.easeTo({
        ...(selected ? { center: [selected.lng, selected.lat] as [number, number] } : {}),
        // Same inset as the follow camera, so both agree on where the marker sits.
        padding: selected ? this.followPadding() : { top: 0, bottom: 0, left: 0, right: padding },
        duration: 650,
        easing: glideEase,
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
      // Smooth markers trail the newest fix by about one packet; the tracker's
      // move hook follows the drawn marker instead (see followMarker).
      if (this.smoothTracking()) return;
      this.followVehicle(vehicle);
    });
    effect(() => {
      const selectedId = this.selectedVehicleId();
      if (!this.map) return;
      // Selecting another vehicle, or clearing the selection, dismisses the
      // previously pinned card — only one selection popup may stay open.
      if (this.pinnedPopupId !== selectedId) {
        this.pinnedPopupId = selectedId;
        this.closeOtherPopups(selectedId);
      }
      this.updateMarkerSelection(selectedId);
    });
    effect(() => {
      const trail = this.liveTrail();
      if (!this.map) return;
      this.renderLiveTrail(trail);
    });
    // The trail decides which way the marker points, so re-apply the rotation
    // whenever a new hop lands. Without this the arrow keeps the heading from
    // the last realtime tick instead of the road it is travelling along.
    effect(() => {
      this.liveTrail();
      const selectedId = this.selectedVehicleId();
      if (!this.map || !selectedId) return;
      const marker = this.markers.get(selectedId);
      const vehicle = this.markerVehicles.get(selectedId);
      if (!marker || !vehicle) return;
      const bearing = this.trailBearing() ?? Number(vehicle.heading);
      if (!Number.isFinite(bearing)) return;
      if (vehicle.variant === 'vehicle') {
        // A gliding marker is already steered every frame by the road it is on.
        if (!this.trackers.has(selectedId)) this.steerHeading(selectedId, bearing, performance.now(), true);
        return;
      }
      marker.setRotationAlignment('map');
      marker.setRotation((bearing + 360) % 360);
    });
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, timezoneCountryCenter(), 4);
    this.mapRef.set(this.map);
    this.bindVehicleView(this.map);
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
      if (this.initialFitPending && this.vehicles().length)
        this.renderMarkers(this.vehicles(), true, this.showMarkers(), this.clusterMarkers());
    });
    this.resizeObserver.observe(this.mapElement().nativeElement);
    this.map.on('style.load', () => {
      this.renderMarkers(this.vehicles(), false, this.showMarkers(), this.clusterMarkers());
      this.renderZones(this.zones());
      if (this.map?.getLayer('fleet-trail-casing'))
        this.map.setPaintProperty('fleet-trail-casing', 'line-color', routeCasingColor());
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
    // Theme colours are read once per render instead of once per marker.
    this.statusColorCache = undefined;
    // A vehicle object that hasn't changed needs no popup rebuild or DOM writes unless something
    // every marker depends on (selection, fullscreen footer, theme colours, popup builder) changed too.
    const popupTemplate = this.popupTemplate();
    const dark = document.documentElement.classList.contains('dark');
    const context = `${selectedId}|${this.isFullscreen()}|${dark}`;
    const contextChanged = context !== this.renderedContext || popupTemplate !== this.renderedPopupTemplate;
    this.renderedContext = context;
    this.renderedPopupTemplate = popupTemplate;
    const visibleVehicles = show ? vehicles : [];
    const visibleIds = new Set(visibleVehicles.map(({ id }) => id));
    this.markers.forEach((marker, id) => {
      if (visibleIds.has(id)) return;
      marker.remove();
      this.markers.delete(id);
      this.markerVehicles.delete(id);
      this.markerPopupContent.delete(id);
      this.trackers.get(id)?.destroy();
      this.trackers.delete(id);
      this.trackedFixKeys.delete(id);
      this.vehicleParts.delete(id);
      this.headings.delete(id);
    });

    for (const vehicle of visibleVehicles) {
      const previous = this.markerVehicles.get(vehicle.id);
      this.markerVehicles.set(vehicle.id, vehicle);
      let item = this.markers.get(vehicle.id);
      if (item && previous === vehicle && !contextChanged) continue;
      if (!item) {
        const element = this.createVehicleMarker(vehicle, selectedId);
        element.addEventListener('click', () => {
          const current = this.markerVehicles.get(vehicle.id);
          if (!current) return;
          const wasSelected = this.selectedVehicleId() === current.id;
          if (this.isFullscreen()) {
            this.fullscreenVehicleClick.emit(current);
          } else {
            this.vehicleSelected.emit(current);
          }
          // The camera moves once the page has applied the click. A new selection is flown to by
          // the selection effect, with the details panel already counted; flying from here as well
          // started two moves that cut each other off. A page that doesn't select vehicles, or a
          // second click in fullscreen, still brings the vehicle into view.
          afterNextRender(() => {
            if (this.selectedVehicleId() === current.id && !wasSelected) return;
            if (wasSelected && !this.isFullscreen()) return;
            this.focusVehicle(this.markerVehicles.get(current.id) ?? current);
          }, { injector: this.injector });
        });
        item = new maplibregl.Marker({ element })
          .setLngLat([vehicle.lng, vehicle.lat])
          .setPopup(popupHtml(this.vehiclePopupHtml(vehicle)))
          .addTo(this.map);
        if (vehicle.variant === 'vehicle') {
          this.registerVehicleParts(vehicle.id, element);
          element.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            element.click();
          });
          this.updateVehicleMarker(item, vehicle, selectedId);
        }
        element.addEventListener('mouseenter', () => {
          if (!item) return;
          // Only one card may be open: a pinned selection popup is closed when
          // another marker is hovered.
          if (this.pinnedPopupId !== vehicle.id) this.closeOtherPopups(vehicle.id);
          if (item.getPopup() && !item.getPopup()?.isOpen()) item.togglePopup();
        });
        element.addEventListener('mouseleave', () => {
          // The popup opened by selection stays open until the selection is
          // replaced or cleared; hover release must not dismiss it.
          if (this.pinnedPopupId === vehicle.id) return;
          if (item?.getPopup()?.isOpen()) item.togglePopup();
        });
        this.markers.set(vehicle.id, item);
        this.markerPopupContent.set(vehicle.id, this.vehiclePopupHtml(vehicle));
      } else {
        if (this.smoothTracking()) {
          this.trackVehicle(vehicle, item);
        } else {
          const position = item.getLngLat();
          if (position.lng !== vehicle.lng || position.lat !== vehicle.lat) {
            // Without a glide to steer it, a vehicle marker points along its own last move.
            if (vehicle.variant === 'vehicle' && !Number.isFinite(Number(vehicle.heading))) {
              const from = { lat: position.lat, lng: position.lng };
              const to = { lat: vehicle.lat, lng: vehicle.lng };
              if (metresBetween(from, to) >= FleetMap.HEADING_MIN_METRES)
                this.steerHeading(vehicle.id, bearingBetween(from, to), performance.now(), true);
            }
            item.setLngLat([vehicle.lng, vehicle.lat]);
            this.drawHeading(vehicle.id);
          }
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
    if (fit) this.fitVehicles(vehicles);
    if (this.smoothTracking()) {
      this.map.off('moveend', this.onRoutingMove);
      this.map.on('moveend', this.onRoutingMove);
      this.queueRouting();
    }
  }

  /** Routing is rechecked at most once per frame, however many renders land in it. */
  private queueRouting(): void {
    if (this.routingFrame !== undefined) return;
    this.zone.runOutsideAngular(() => {
      this.routingFrame = requestAnimationFrame(() => {
        this.routingFrame = undefined;
        this.updateRouting();
      });
    });
  }

  /** Feed a vehicle's newest fix to its tracker, creating it on first sight. */
  private trackVehicle(vehicle: TrackedVehicle, marker: maplibregl.Marker): void {
    const key = `${vehicle.lat},${vehicle.lng},${vehicle.fixTime ?? ''}`;
    if (this.trackedFixKeys.get(vehicle.id) === key) return;
    this.trackedFixKeys.set(vehicle.id, key);
    let track = this.trackers.get(vehicle.id);
    if (!track) {
      const id = vehicle.id;
      track = new SmoothTrack(this.zone, { move: (pos, heading) => this.placeTrackedMarker(id, pos, heading) });
      const start = marker.getLngLat();
      track.seed({ lat: start.lat, lng: start.lng });
      this.trackers.set(id, track);
    }
    track.push({ lat: vehicle.lat, lng: vehicle.lng, t: vehicle.fixTime ?? Number.NaN });
  }

  /**
   * Per-frame marker update from a tracker. Runs outside Angular. The heading is
   * the road edge being driven (null while standing still, when the arrow keeps
   * pointing the way it last went).
   */
  private placeTrackedMarker(id: string, pos: TrackPoint, heading: number | null): void {
    const marker = this.markers.get(id);
    if (!marker || !this.map) return;
    marker.setLngLat([pos.lng, pos.lat]);
    if (heading !== null && this.vehicleParts.has(id)) this.steerHeading(id, heading);
    else if (this.pitched()) this.drawHeading(id);
    if (id === this.selectedVehicleId() && !this.followSuspended) this.followMarker(pos);
  }

  /**
   * Keep the followed marker near its framing point. Panning only once it
   * drifts (at most once a second) — re-centring every frame makes the map
   * judder under the marker and fights the user's drag.
   */
  private followMarker(pos: TrackPoint): void {
    const map = this.map!;
    const now = performance.now();
    if (now - this.lastFollowPanAt < 1000) return;
    const container = map.getContainer();
    const padding = this.followPadding();
    const targetX = (padding.left! + container.clientWidth - padding.right!) / 2;
    const targetY = container.clientHeight / 2;
    // Never cut into a selection flight or the user's own drag; follow on once it settles.
    if (map.isMoving()) return;
    const point = map.project([pos.lng, pos.lat]);
    const driftX = Math.abs(point.x - targetX) / Math.max(1, container.clientWidth);
    const driftY = Math.abs(point.y - targetY) / Math.max(1, container.clientHeight);
    if (driftX < 0.2 && driftY < 0.2) return;
    this.lastFollowPanAt = now;
    map.easeTo({ center: [pos.lng, pos.lat], padding, duration: 1000, easing: glideEase });
  }

  /**
   * Choose which trackers snap to roads: vehicles with their own visible
   * marker in view at ROUTE_MIN_ZOOM or closer, the selected one first, up to
   * ROUTE_MAX_VEHICLES. Rechecked after every render and camera move.
   */
  private updateRouting(): void {
    if (!this.map) return;
    const zoomedIn = this.map.getZoom() >= FleetMap.ROUTE_MIN_ZOOM;
    const bounds = this.map.getBounds();
    const selectedId = this.selectedVehicleId();
    const ids = [...this.trackers.keys()].sort((a, b) => Number(b === selectedId) - Number(a === selectedId));
    let budget = FleetMap.ROUTE_MAX_VEHICLES;
    for (const id of ids) {
      const marker = this.markers.get(id);
      const on = zoomedIn && budget > 0 && !!marker
        && marker.getElement().style.display !== 'none' && bounds.contains(marker.getLngLat());
      if (on) budget--;
      this.trackers.get(id)!.setRouting(on);
    }
  }

  // Frames the given markers, reserving room for the details panel so a re-fit
  // never parks markers underneath it. Shared by the initial load/resize fit and
  // the filter-driven re-fit in the constructor effect.
  protected fitAllVehicles(): void {
    this.fitVehicles(this.vehicles());
  }

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
    this.statusColorCache = undefined;
    this.markers.forEach((item, id) => {
      const vehicle = this.markerVehicles.get(id);
      if (!vehicle) return;
      this.updateVehicleMarker(item, vehicle, selectedId);
    });
  }

  private createVehicleMarker(vehicle: TrackedVehicle, selectedId: string | null): HTMLElement {
    // State is written by updateVehicleMarker once the marker exists.
    if (vehicle.variant === 'vehicle') return markerElement(VEHICLE_MARKER_HTML);
    const selected = vehicle.id === selectedId;
    const color = this.statusColor(vehicle.status);
    const image = this.vehicleImageUrl(vehicle.image);
    if (vehicle.variant === 'arrow') {
      // Directional glyph: no chip, no circular mask, sized so the arrow reads at
      // full scale and the bearing rotation is visible.
      return markerElement(`
        <div class="vehicle-marker vehicle-marker--arrow${selected ? ' selected' : ''}"
          style="--marker-color:${color}">
          <span class="vehicle-marker-halo"></span>
          <img src="${escapeHtml(image)}" alt="${escapeHtml(vehicle.id)}" onerror="this.onerror=null;this.src='assets/fleetpoint/def-car.svg'">
        </div>
      `);
    }
    const size = selected ? 44 : 34;
    return markerElement(`
      <div class="vehicle-marker${selected ? ' selected' : ''}${vehicle.status === 'Alert' ? ' alert' : ''}"
        style="--marker-color:${color};width:${size}px;height:${size}px;border-color:${color};
          box-shadow:0 2px 8px rgb(0 0 0 / .25)${selected ? `, 0 0 0 4px ${color}44` : ''}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(vehicle.id)}" onerror="this.onerror=null;this.src='assets/fleetpoint/def-car.svg'">
      </div>
    `);
  }

  private updateVehicleMarker(
    marker: maplibregl.Marker,
    vehicle: TrackedVehicle,
    selectedId: string | null,
  ): void {
    if (vehicle.variant === 'vehicle') {
      this.updateVehicleBadge(marker, vehicle, vehicle.id === selectedId);
      return;
    }
    const element = marker.getElement().querySelector<HTMLElement>('.vehicle-marker');
    if (!element) return;
    const selected = vehicle.id === selectedId;
    const size = selected ? 44 : 34;
    const width = `${size}px`;
    const color = this.statusColor(vehicle.status);
    const arrow = vehicle.variant === 'arrow';
    element.className = `vehicle-marker${arrow ? ' vehicle-marker--arrow' : ''}${selected ? ' selected' : ''}${vehicle.live ? ' live' : ''}${vehicle.status === 'Alert' ? ' alert' : ''}`;
    if (element.style.getPropertyValue('--marker-color') !== color)
      element.style.setProperty('--marker-color', color);
    // The arrow variant is sized entirely by CSS, so only the shared image
    // swap below applies to it; the chip keeps its own size/border/shadow.
    if (!arrow) {
      if (element.style.width !== width) element.style.width = width;
      if (element.style.height !== width) element.style.height = width;
      if (element.style.borderColor !== color) element.style.borderColor = color;
      const shadow = `0 2px 8px rgb(0 0 0 / .25)${selected ? `, 0 0 0 4px ${color}44` : ''}`;
      if (element.style.boxShadow !== shadow) element.style.boxShadow = shadow;
    }
    const image = element.querySelector('img');
    const imageUrl = this.vehicleImageUrl(vehicle.image);
    if (image && image.getAttribute('src') !== imageUrl) image.src = imageUrl;
    if (image && image.alt !== vehicle.id) image.alt = vehicle.id;
    // A heading rotates the marker with the map, so the icon stays aligned to
    // the street it is travelling along under any pitch or bearing.
    const heading = Number(vehicle.heading);
    if (Number.isFinite(heading)) {
      marker.setRotationAlignment('map');
      marker.setRotation((heading + 360) % 360);
    } else {
      marker.setRotation(0);
    }
  }

  // ── Vehicle markers ──────────────────────────────────────────
  // A status-coloured disc. Only the arrow inside turns, so the plate label and
  // the pause and alert marks always read upright. The arrow is drawn in screen
  // space: its angle is the heading as it appears on screen, which is the
  // heading minus the map bearing when flat, and is projected when tilted.

  private registerVehicleParts(id: string, element: HTMLElement): void {
    const root = element.querySelector<HTMLElement>('.vm');
    const arrow = element.querySelector<SVGElement>('.vm-arrow');
    const plate = element.querySelector<HTMLElement>('.vm-plate');
    const speed = element.querySelector<HTMLElement>('.vm-speed');
    if (root && arrow && plate && speed) this.vehicleParts.set(id, { root, arrow, plate, speed });
  }

  private updateVehicleBadge(marker: maplibregl.Marker, vehicle: TrackedVehicle, selected: boolean): void {
    const parts = this.vehicleParts.get(vehicle.id);
    if (!parts) return;
    const heading = Number(vehicle.heading);
    // A heading from the feed counts only while no glide is steering the marker.
    if (Number.isFinite(heading) && !this.trackers.has(vehicle.id))
      this.steerHeading(vehicle.id, heading, performance.now(), !this.headings.has(vehicle.id));
    const className = `vm vm--${vehicle.status.toLowerCase()}${selected ? ' is-selected' : ''}`
      + `${this.headings.has(vehicle.id) ? ' has-heading' : ''}${vehicle.alert ? ' has-alert' : ''}`;
    if (parts.root.className !== className) parts.root.className = className;
    const color = this.statusColor(vehicle.status);
    if (parts.root.style.getPropertyValue('--vm-color') !== color) parts.root.style.setProperty('--vm-color', color);
    if (parts.plate.textContent !== vehicle.id) parts.plate.textContent = vehicle.id;
    const speed = selected && vehicle.status === 'Moving' && vehicle.speed > 0 ? ` · ${Math.round(vehicle.speed)} km/h` : '';
    if (parts.speed.textContent !== speed) parts.speed.textContent = speed;
    const label = `${vehicle.id}, ${vehicle.status.toLowerCase()}${vehicle.alert ? ', has alerts' : ''}`
      + `${vehicle.speed > 0 ? `, ${Math.round(vehicle.speed)} km/h` : ''}`;
    if (parts.root.getAttribute('aria-label') !== label) parts.root.setAttribute('aria-label', label);
    // The selected vehicle and alerts sit above their neighbours.
    const layer = selected ? '3' : vehicle.alert || vehicle.status === 'Alert' ? '2' : '';
    const wrapper = marker.getElement();
    if (wrapper.style.zIndex !== layer) wrapper.style.zIndex = layer;
  }

  /**
   * Turn a vehicle's arrow towards `bearing`. Per-frame callers (the glide) ease
   * it round so a corner reads as a turn, not a snap; `immediate` sets it outright.
   */
  private steerHeading(id: string, bearing: number, now = performance.now(), immediate = false): void {
    const current = this.headings.get(id);
    if (!current || immediate) {
      this.headings.set(id, { target: bearing, shown: bearing, at: now });
      this.vehicleParts.get(id)?.root.classList.add('has-heading');
    } else {
      const elapsed = Math.min(100, Math.max(0, now - current.at));
      const turn = ((bearing - current.shown + 540) % 360) - 180;
      current.target = bearing;
      current.shown += turn * (1 - Math.exp(-elapsed / FleetMap.HEADING_EASE_MS));
      current.at = now;
    }
    this.drawHeading(id);
  }

  private drawHeading(id: string): void {
    const heading = this.headings.get(id);
    const parts = this.vehicleParts.get(id);
    const marker = this.markers.get(id);
    if (!heading || !parts || !marker || !this.map) return;
    const angle = this.screenAngle(marker.getLngLat(), heading.shown);
    parts.arrow.style.transform = `rotate(${angle.toFixed(1)}deg)`;
  }

  /** On-screen angle of a compass bearing at a point: exact under any rotation and tilt. */
  private screenAngle(at: maplibregl.LngLat, bearing: number): number {
    const map = this.map!;
    if (!this.pitched()) return bearing - map.getBearing();
    const radians = (bearing * Math.PI) / 180;
    const step = 1e-4;
    const from = map.project(at);
    const to = map.project([
      at.lng + (Math.sin(radians) * step) / Math.cos((at.lat * Math.PI) / 180),
      at.lat + Math.cos(radians) * step,
    ]);
    return (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  }

  private pitched(): boolean {
    return (this.map?.getPitch() ?? 0) >= 1;
  }

  /** Redraws every arrow once a frame while the map turns or tilts, and shows plates from street zoom. */
  private bindVehicleView(map: MapLibreMap): void {
    this.zone.runOutsideAngular(() => {
      map.on('move', () => {
        const bearing = map.getBearing();
        // Flat and unrotated, a pan or zoom leaves every arrow's screen angle unchanged.
        if (bearing !== this.viewBearing || this.pitched()) {
          this.viewBearing = bearing;
          this.queueHeadingRedraw();
        }
      });
      map.on('zoom', () => this.syncPlateLabels());
      map.once('load', () => this.syncPlateLabels());
    });
  }

  private queueHeadingRedraw(): void {
    if (this.headingFrame !== undefined || !this.headings.size) return;
    this.headingFrame = requestAnimationFrame(() => {
      this.headingFrame = undefined;
      this.headings.forEach((_, id) => this.drawHeading(id));
    });
  }

  private syncPlateLabels(): void {
    const show = (this.map?.getZoom() ?? 0) >= FleetMap.PLATE_MIN_ZOOM;
    if (show === this.plateLabelsShown) return;
    this.plateLabelsShown = show;
    this.mapElement().nativeElement.classList.toggle('vm-plates', show);
  }

  private vehiclePopupHtml(vehicle: TrackedVehicle): string {
    // A page-supplied builder takes over the body; the popup surface, close
    // button and hover/pin behaviour are unchanged.
    const custom = this.popupTemplate();
    if (custom) return custom(vehicle);
    const statusColor = this.statusColor(vehicle.status);
    const speed = vehicle.speed > 0 ? `<span class="vp-detail">${Math.round(vehicle.speed)} km/h</span>` : '';
    const fuel = vehicle.fuel > 0 ? `<span class="vp-detail">Fuel ${Math.round(vehicle.fuel)}%</span>` : '';
    const footerText = this.isFullscreen() ? 'Click to follow this vehicle' : 'Click for full details';
    return `
      <div class="vehicle-popup">
        <div class="vp-head">
          <img class="vp-thumb" src="${escapeHtml(this.vehicleImageUrl(vehicle.image))}" alt="" onerror="this.onerror=null;this.src='assets/fleetpoint/def-car.svg'" />
          <div class="vp-title">
            <strong>${escapeHtml(vehicle.id)}</strong>
            <small>${escapeHtml(vehicle.model)}</small>
          </div>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span class="vp-text">${escapeHtml(vehicle.driver)}</span>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span class="vp-text"><span class="vp-status" style="color:${statusColor}">${escapeHtml(vehicle.status)}</span> ${speed}${fuel}</span>
        </div>
        <div class="vp-row">
          <svg class="vp-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span class="vp-text vp-location">${escapeHtml(vehicle.location)}</span>
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
    // Clustering only mutates marker DOM imperatively (no signals/bindings), so
    // run the per-frame work outside Angular to avoid a change-detection pass on
    // every map move/zoom frame.
    this.zone.runOutsideAngular(() => {
      this.clusterSyncFrame = requestAnimationFrame(() => {
        this.clusterSyncFrame = undefined;
        this.recomputeClusters();
      });
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
    // Grouping only needs screen positions, which the camera gives at any time. Waiting for
    // isStyleLoaded() skipped every pass made while tiles were loading, so a jump or zoom that
    // ended mid-load left the old clusters on screen until the map was moved again.
    if (!this.map || !this.clusterEnabled) return;
    if (this.map.getZoom() >= this.map.getMaxZoom() - 0.01) {
      this.clusteredPairs.clear();
      this.clearClusterBadges();
      return;
    }

    interface ClusterGroup { lng: number; lat: number; ids: string[]; key: string; color: string; counts: Record<VehicleStatus, number>; }
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
    // An alert badge outranks every status, so a group holding one shows the alert colour.
    const statusById = new Map(
      visibleVehicles.map(({ id, status, alert }) => [id, alert ? 'Alert' as const : status]),
    );
    const groups: ClusterGroup[] = [...membersByRoot.values()].map((members) => {
      const ids = members.map(({ id }) => id).sort();
      const lng = members.reduce((sum, vehicle) => sum + vehicle.lng, 0) / members.length;
      const lat = members.reduce((sum, vehicle) => sum + vehicle.lat, 0) / members.length;
      return { lng, lat, ids, key: ids.join('|'), color: this.badgeColor(ids, statusById), counts: this.statusCounts(ids, statusById) };
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
      // Same size steps as the violations map clusters.
      const size = count < 25 ? 36 : count < 100 ? 44 : count < 250 ? 52 : 60;
      const label = count < 1000 ? String(count) : `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
      const width = `${size}px`;
      const fontSize = `${Math.round(size * (label.length > 3 ? 0.27 : 0.32))}px`;
      const ringWidth = size >= 52 ? '5.5px' : '4.5px';
      const ring = this.clusterRing(group.counts, count);
      const setVar = (name: string, value: string) => {
        if (div.style.getPropertyValue(name) !== value) div.style.setProperty(name, value);
      };
      if (div.style.width !== width) div.style.width = width;
      if (div.style.height !== width) div.style.height = width;
      setVar('--cluster-font-size', fontSize);
      setVar('--cluster-ring-width', ringWidth);
      setVar('--cluster-ring', ring);
      setVar('--cluster-status', group.color);
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
      const breakdown = CLUSTER_STATUSES.filter((status) => group.counts[status])
        .map((status) => `${group.counts[status]} ${status.toLowerCase()}`).join(', ');
      const ariaLabel = `${count} vehicles: ${breakdown}`;
      if (div.getAttribute('aria-label') !== ariaLabel) div.setAttribute('aria-label', ariaLabel);
    }
  }

  private statusCounts(ids: string[], statusById: ReadonlyMap<string, VehicleStatus>): Record<VehicleStatus, number> {
    const counts: Record<VehicleStatus, number> = { Moving: 0, Idling: 0, Stopped: 0, Alert: 0, Offline: 0 };
    for (const id of ids) counts[statusById.get(id) ?? 'Offline'] += 1;
    return counts;
  }

  /**
   * Donut ring for a cluster: one arc per status, sized by its share of the members, clockwise
   * from 12 o'clock with hairline gaps (painted in the core colour) between segments.
   */
  private clusterRing(counts: Record<VehicleStatus, number>, total: number): string {
    const segments = CLUSTER_STATUSES.filter((status) => counts[status] > 0);
    if (segments.length === 1) return this.statusColor(segments[0]);
    const gap = 2.4;
    let angle = 0;
    const stops: string[] = [];
    for (const status of segments) {
      const sweep = (counts[status] / total) * 360;
      const color = this.statusColor(status);
      stops.push(
        `var(--cluster-core) ${angle.toFixed(2)}deg ${(angle + gap / 2).toFixed(2)}deg`,
        `${color} ${(angle + gap / 2).toFixed(2)}deg ${(angle + sweep - gap / 2).toFixed(2)}deg`,
        `var(--cluster-core) ${(angle + sweep - gap / 2).toFixed(2)}deg ${(angle + sweep).toFixed(2)}deg`,
      );
      angle += sweep;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }

  // Highest-severity status among the grouped vehicles → badge halo color:
  // Alert > Moving (online) > Idling > Offline.
  private badgeColor(ids: string[], statusById: ReadonlyMap<string, VehicleStatus>): string {
    const rank: Record<string, number> = { Alert: 4, Moving: 3, Idling: 2, Stopped: 1, Offline: 0 };
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
    // Already separated: the members no longer sit within a cluster radius, so
    // the group has fully split and the click must not zoom any further —
    // easing past them would leave the viewport empty. Only re-centre.
    if (this.membersSeparated(vehicles)) {
      this.map.easeTo({ center, duration: 450 });
      return;
    }
    // Cap how far one click may travel. A tight group fits at a very high zoom,
    // so honouring the fit exactly (or the old +8 jump) rockets the camera past
    // the members and leaves the viewport empty. Members sit at the group
    // centre, so a bounded step keeps them framed.
    const ceiling = Math.min(this.map.getMaxZoom(), this.map.getZoom() + 4);
    if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
      // Coincident members can never separate, so step once and stop rather than
      // grinding to the max zoom on repeated clicks.
      this.map.easeTo({ center, zoom: ceiling, duration: 450 });
      this.recomputeClusters();
      return;
    }
    // Zoom exactly as far as needed to clear the 68px exit radius, never past it,
    // so the members end up centred and separate instead of rocketing past them.
    const separateZoom = this.zoomToSeparate(vehicles);
    const target = Math.min(ceiling, Math.max(separateZoom, this.map.getZoom() + 1));
    if (target <= this.map.getZoom() + 0.01) {
      this.map.easeTo({ center, duration: 450 });
      return;
    }
    const camera = this.map.cameraForBounds(bounds, {
      padding: overlaySafePadding(96),
    });
    const zoom = Math.min(target, Math.max(camera?.zoom ?? 0, this.map.getZoom() + 1));
    this.map.easeTo({ center: camera?.center ?? center, zoom, duration: 450 });
  }

  /**
   * Minimum on-screen distance, in pixels, between any two members at the
   * current zoom. Clustering joins markers that are closer together than
   * `CLUSTER_EXIT_PIXEL_RADIUS`, so this is the value that decides whether a
   * group has actually split yet.
   */
  private minMemberSeparation(vehicles: TrackedVehicle[]): number {
    if (!this.map || vehicles.length < 2) return Infinity;
    const points = vehicles.map((vehicle) => this.map!.project([vehicle.lng, vehicle.lat]));
    let min = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        min = Math.min(min, Math.hypot(dx, dy));
      }
    }
    return min;
  }

  /** Zoom level at which the members clear the cluster exit radius. */
  private zoomToSeparate(vehicles: TrackedVehicle[]): number {
    const separation = this.minMemberSeparation(vehicles);
    if (!Number.isFinite(separation) || separation <= 0) return this.map?.getZoom() ?? 0;
    const scale = FleetMap.CLUSTER_EXIT_PIXEL_RADIUS / separation;
    return this.map!.getZoom() + Math.log2(scale);
  }

  /**
   * True once the group has actually split — every member is farther apart than
   * the cluster exit radius — so the click must stop zooming and only re-centre.
   */
  private membersSeparated(vehicles: TrackedVehicle[]): boolean {
    return this.minMemberSeparation(vehicles) >= FleetMap.CLUSTER_EXIT_PIXEL_RADIUS;
  }

  // ── Live road-snapped trail ────────────────────────────────
  // Positions arrive as raw GPS breadcrumbs. Each hop is snapped to the road
  // network with OSRM so the trail never cuts across blocks, and the newly added
  // hop is revealed with a dash-offset animation rather than appearing (and
  // vanishing) in one step.
  private trailSettled: LatLng[] = [];
  private trailPending: LatLng[] = [];
  private trailRaw: LatLng[] = [];
  private trailToken = 0;
  private trailFrame?: number;
  /** Snapped geometry per from→to hop, so an identical segment is never fetched
      twice (a fast feed repeats hops); failures aren't cached so they retry. */
  private readonly snapCache = new Map<string, Promise<LatLng[]>>();

  private renderLiveTrail(raw: LatLng[]): void {
    if (!this.map?.isStyleLoaded()) return;
    // A shrinking breadcrumb means the consumer reset (or re-seeded) the trail.
    if (raw.length < this.trailRaw.length) {
      this.trailRaw = [];
      this.trailSettled = [];
      this.trailPending = [];
      cancelAnimationFrame(this.trailFrame as number);
    }
    this.trailRaw = raw;
    if (raw.length < 2) { this.paintTrail(); return; }
    const from = this.trailRaw[this.trailRaw.length - 2];
    const to = this.trailRaw[this.trailRaw.length - 1];
    if (Math.abs(from[0] - to[0]) < 1e-6 && Math.abs(from[1] - to[1]) < 1e-6) return;
    const token = ++this.trailToken;
    void this.snapToRoad(from, to).then((geometry) => {
      if (token !== this.trailToken || !geometry.length) return;
      this.trailPending = geometry;
      this.animateTrailIn();
    });
  }

  /** OSRM driving route between two fixes, falling back to the straight line.
      Identical hops are served from an in-memory cache; a straight-line fallback
      (OSRM unreachable) is evicted so the next encounter retries the network. */
  private snapToRoad(from: LatLng, to: LatLng): Promise<LatLng[]> {
    const key = `${from[0].toFixed(6)},${from[1].toFixed(6)};${to[0].toFixed(6)},${to[1].toFixed(6)}`;
    const cached = this.snapCache.get(key);
    if (cached) return cached;
    const request = this.requestSnapToRoad(from, to);
    this.snapCache.set(key, request);
    void request.then((points) => {
      if (points.length < 3) this.snapCache.delete(key);
    });
    return request;
  }

  private async requestSnapToRoad(from: LatLng, to: LatLng): Promise<LatLng[]> {
    const fallback: LatLng[] = [from, to];
    const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    for (const baseUrl of [environment.osrmBaseUrl, environment.osrmFallbackUrl]) {
      try {
        const response = await fetch(
          `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false&steps=false`,
        );
        if (!response.ok) continue;
        const result = await response.json() as {
          code?: string;
          routes?: { geometry?: { coordinates?: [number, number][] } }[];
        };
        if (result.code !== 'Ok') continue;
        const points = result.routes?.[0]?.geometry?.coordinates;
        if (points?.length) return points.map(([lng, lat]) => [lat, lng]);
      } catch {
        // Try the next host; the straight line is the last resort.
      }
    }
    return fallback;
  }

  /**
   * Reveals the pending hop by trimming the visible coordinate window, so the
   * line grows along the road instead of being redrawn. On completion the hop
   * joins the settled trail and the marker heading follows its final bearing.
   */
  private animateTrailIn(): void {
    cancelAnimationFrame(this.trailFrame as number);
    const full = this.trailPending;
    if (full.length < 2) { this.paintTrail(); return; }
    const start = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out so the head decelerates into the new position.
      const eased = 1 - Math.pow(1 - progress, 3);
      const visible = Math.max(2, Math.ceil(eased * full.length));
      this.paintTrail(full.slice(0, visible));
      if (progress < 1) {
        this.trailFrame = requestAnimationFrame(step);
        return;
      }
      this.trailSettled = this.trailSettled.concat(full.slice(1));
      this.trailPending = [];
      this.paintTrail();
    };
    // Trail growth only repaints a GeoJSON source — keep the ~60fps loop off the
    // Angular zone so each frame doesn't trigger a change-detection pass.
    this.zone.runOutsideAngular(() => {
      this.trailFrame = requestAnimationFrame(step);
    });
  }

  private paintTrail(pending: LatLng[] = this.trailPending): void {
    if (!this.map) return;
    const points = this.trailSettled.concat(pending);
    if (points.length < 2) {
      removeGeoJson(this.map, 'fleet-trail', TRAIL_LAYER_IDS);
      return;
    }
    const color = this.trailColor() || this.brandColor();
    upsertGeoJson(
      this.map,
      'fleet-trail',
      lineFeature(points, { color }),
      TRAIL_LAYERS(color),
    );
  }

  /** Bearing of the last drawn segment, so the marker points the way it travels. */
  private trailBearing(): number | null {
    const points = this.trailSettled.concat(this.trailPending);
    if (points.length < 2) return null;
    const [fromLat, fromLng] = points[points.length - 2];
    const [toLat, toLng] = points[points.length - 1];
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const y = Math.sin(toRad(toLng - fromLng)) * Math.cos(toRad(toLat));
    const x = Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat))
      - Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(toRad(toLng - fromLng));
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
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
    // Bind the per-layer click handlers once. `renderZones` runs on every
    // `zones()` change plus `style.load`/`load`; re-binding each time stacked
    // duplicate handlers that fired the selection several times per click.
    // Layer-scoped handlers survive the layers being re-created by upsertGeoJson.
    if (!this.zoneClickBound) {
      this.zoneClickBound = true;
      for (const layer of ['zone-fill', 'zone-outline', 'zone-corridor']) {
        this.map.on('click', layer, ({ features }) => {
          const item = this.vehicles().find(({ id }) => id === features?.[0]?.properties?.['id']);
          if (item) this.vehicleSelected.emit(item);
        });
      }
    }
  }

  // Width the details panel steals from the map on desktop, so camera framing
  // can keep markers clear of it (0 when the panel is closed, mobile or fullscreen).
  private panelPadding(): number {
    const desktopPanelOpen =
      this.detailsPanelOpen() && !this.isFullscreen() && !matchMedia('(max-width: 900px)').matches;
    return desktopPanelOpen ? 320 : 0;
  }

  /** Closes every open marker popup except the one belonging to `keepId`. */
  private closeOtherPopups(keepId: string | null): void {
    this.markers.forEach((marker, id) => {
      if (id === keepId) return;
      const popup = marker.getPopup();
      if (popup?.isOpen()) marker.togglePopup();
    });
  }

  /** Brings a vehicle into view and opens its card. */
  private focusVehicle(vehicle: TrackedVehicle): void {
    if (!this.map) return;
    this.moveCameraTo(vehicle);
    this.openVehicleCard(vehicle);
  }

  /** Keeps the selected vehicle centred as new positions arrive (maps without gliding markers). */
  private followVehicle(vehicle: TrackedVehicle): void {
    if (!this.map) return;
    // A flight still landing, or the user dragging, wins; the next position catches up.
    if (!this.map.isMoving()) {
      this.map.easeTo({
        center: [vehicle.lng, vehicle.lat],
        padding: this.followPadding(),
        duration: 900,
        easing: glideEase,
      });
    }
    this.openVehicleCard(vehicle);
  }

  /**
   * One camera move to a vehicle, sized to the trip:
   * - Already on screen and about the right zoom: a glide of 0.8–1.15 s, longer the further it
   *   travels, with no zooming out and back in.
   * - Anywhere else: an arc out and back in over 1.4–2.2 s, longer for longer trips but never
   *   dragging.
   * A closer zoom the user chose is kept (up to street level); otherwise the camera comes in to
   * `followZoom`. Not marked essential, so with the OS set to reduce motion it jumps instead.
   * Any drag or scroll stops it at once.
   */
  private moveCameraTo(vehicle: TrackedVehicle): void {
    const map = this.map!;
    const center: [number, number] = [vehicle.lng, vehicle.lat];
    const padding = this.followPadding();
    const currentZoom = map.getZoom();
    const zoom = currentZoom > this.followZoom()
      ? Math.min(currentZoom, FleetMap.FOCUS_MAX_ZOOM)
      : this.followZoom();
    const zoomChange = Math.abs(zoom - currentZoom);
    const container = map.getContainer();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const point = map.project(center);
    const landingX = (padding.left! + width - padding.right!) / 2;
    const travel = Math.hypot(point.x - landingX, point.y - height / 2);
    const onScreen = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
    if (onScreen && zoomChange < 1.5) {
      map.easeTo({ center, zoom, padding, duration: Math.round(Math.min(1150, 800 + travel * 0.45)), easing: glideEase });
      return;
    }
    const screens = travel / width;
    const duration = Math.round(Math.min(2200, 1400 + 280 * Math.log2(1 + screens) + 90 * zoomChange));
    map.flyTo({ center, zoom, padding, duration, curve: 1.5, easing: flightEase });
  }

  private openVehicleCard(vehicle: TrackedVehicle): void {
    const marker = this.markers.get(vehicle.id);
    if (this.selectedVehicleId() === vehicle.id) {
      // Selection-driven opens are exclusive; follow ticks never dismiss a
      // popup the user opened by hovering another marker.
      this.pinnedPopupId = vehicle.id;
      this.closeOtherPopups(vehicle.id);
    }
    if (marker && marker.getPopup() && !marker.getPopup()?.isOpen()) marker.togglePopup();
  }

  /**
   * Padding that places the followed marker `cameraOffsetX` of the way across
   * the container. A centred marker (0.5) yields no padding, so the existing
   * live-tracking behaviour is unchanged; the HUD passes 0.32 to keep the arrow
   * clear of its speedometer.
   */
  private followPadding(): maplibregl.PaddingOptions {
    const width = this.map?.getContainer().clientWidth ?? 0;
    const offset = Math.min(0.98, Math.max(0.02, this.cameraOffsetX()));
    // The camera centres on the middle of the padded inset, i.e. at
    // (left + width - right) / 2. Aim that at `offset` of the area the details
    // panel leaves visible, so a 0.5 offset centres the marker in the open map.
    const target = offset * Math.max(0, width - this.panelPadding());
    const shift = 2 * target - width;
    return { top: 0, bottom: 0, left: Math.max(0, shift), right: Math.max(0, -shift) };
  }

  /** Status colours, resolved from the theme once per render pass (see statusColorCache). */
  private statusColor(status: VehicleStatus): string {
    if (!this.statusColorCache) {
      const styles = getComputedStyle(document.documentElement);
      const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      this.statusColorCache = {
        Moving: css('--color-success', '#10b981'),
        Idling: css('--color-warning', '#f59e0b'),
        // Engine off and parked: the same slate as Stopped on the dashboard status bar.
        Stopped: css('--color-stopped', '#94a3b8'),
        Alert: css('--color-danger', '#ef4444'),
        Offline: css('--color-muted', '#64748b'),
      };
    }
    return this.statusColorCache[status] ?? this.statusColorCache.Offline;
  }

  ngOnDestroy(): void {
    this.trackers.forEach((track) => track.destroy());
    this.trackers.clear();
    if (this.clusterSyncFrame !== undefined) cancelAnimationFrame(this.clusterSyncFrame);
    if (this.routingFrame !== undefined) cancelAnimationFrame(this.routingFrame);
    if (this.headingFrame !== undefined) cancelAnimationFrame(this.headingFrame);
    cancelAnimationFrame(this.trailFrame as number);
    clearTimeout(this.readyFallback);
    this.resizeObserver?.disconnect();
    this.map?.remove();
    // Null the handle so any late async callback (e.g. geolocate) no-ops on its
    // `this.map?.` guard instead of touching a removed map.
    this.map = undefined;
  }
}
