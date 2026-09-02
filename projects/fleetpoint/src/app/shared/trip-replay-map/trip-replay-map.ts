import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer } from '@deck.gl/layers';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng,
  createIotMap,
  fitLatLngs,
  lineFeature,
  markerElement,
  popup,
  removeGeoJson,
  upsertGeoJson,
} from '../maps/maplibre';
import { attachTooltip } from '@iotility/shared-ui';
import { MapControls } from '../map-overlays/map-controls';
import { environment } from '../../../environments/environment';

const VEHICLE_MODEL_PATHS = [
  '/assets/fleetpoint/models-trip-vehicle.glb',
  '/assets/models-trip-vehicle.glb',
];
const VEHICLE_MODEL_YAW_OFFSET = 180;
const DEFAULT_MAP_CENTER: LatLng = [30.3753, 69.3451];
const DEFAULT_MAP_ZOOM = 5;
const NAVIGATION_PITCH = 52;
const NAVIGATION_ZOOM = 16.5;
const RECENT_TRAIL_POINTS = 32;
// Damping factors are "per second" rates for exponential smoothing, so the
// camera eases at the same speed regardless of the viewer's frame rate.
const CAMERA_BEARING_DAMPING = 4.2;
const CAMERA_FRAMING_DAMPING = 2.4;
const SPEED_DAMPING = 2.5;
const VEHICLE_HEADING_DAMPING = 10;
const CAMERA_BEARING_DEAD_ZONE = 1.2;
const CAMERA_MAX_ROTATION_SPEED = 100;
const CAMERA_SETTLE_SECONDS = 1.25;
const CAMERA_ZOOM_EPSILON = 0.008;
const CAMERA_PITCH_EPSILON = 0.08;
// The OSRM trail is rebuilt into uniformly spaced waypoints that act as the
// authoritative path for marker movement. Playback then steps along that path
// instead of along raw-sample density, so sparse GPS no longer produces fast
// jumps and dense clusters no longer freeze the marker.
const OSRM_RESAMPLE_STEP_M = 8;
// A raw run is treated as a genuine vehicle stop (marker held in place) when
// it is moving at or below this speed for at least this many consecutive
// samples. Matches the stationary-point condenser floor (STATIONARY_SPEED_KPH).
const STOP_SPEED_KPH = 3;
const STOP_MIN_SAMPLES = 4;
const OSRM_MAX_DISTANCE_INFLATION = 3;
const OSRM_MATCH_RADIUS = 200;
// Second-tier road matching: when the primary OSRM server (osrmBaseUrl) fails
// or times out, fall back to the public OSRM demo server so trails stay
// road-snapped during outages. It is only used after the primary has failed a
// few consecutive chunks (PUBLIC_OSRM_FAIL_THRESHOLD) to avoid hammering the
// shared server when the primary is merely flaky, and its radius is capped low
// because the demo instance rejects large radiuses ("TooBig").
const PUBLIC_OSRM_MATCH_RADIUS = 40;
const PUBLIC_OSRM_FAIL_THRESHOLD = 2;
// The public OSRM demo server rejects /match traces above a small coordinate
// budget with "TooBig" — measured ceiling is 10 trace points. Since primary
// chunks are far larger, the fallback splits each chunk into sub-traces at
// most this size before matching. Each sub-trace is internally road-following,
// so concatenating them preserves the driven path.
const PUBLIC_OSRM_MAX_TRACE = 10;
// OSRM backends can hang (upstream returns 524 only after a long wait, or
// 503s). A per-request timeout stops a stuck server from freezing the whole
// trail and forces the raw-GPS fallback instead.
const OSRM_REQUEST_TIMEOUT_MS = 10000;
// GPS receivers keep reporting while the vehicle is parked, and the jittering
// cloud of points around a stop can straddle nearby streets. OSRM then matches
// the cloud as if the vehicle drove around the block, producing the square
// detour artefact. Stationary points inside this radius collapse to one.
const STATIONARY_SPEED_KPH = 3;
const STATIONARY_COLLAPSE_RADIUS_M = 25;
// Matched geometry can still double back on itself (out-and-back artefacts
// from redundant coordinates). A loop is excised when the path returns close
// to a recent vertex after having travelled a meaningful distance — tight
// enough to catch city blocks, loose enough to keep legitimate hairpins.
const LOOP_WINDOW_POINTS = 60;
const LOOP_CLOSE_RADIUS_M = 18;
const LOOP_MIN_TRAVELLED_M = 150;
// Chunks share their boundary sample, but OSRM snaps it to the road once per
// chunk — up to a few metres apart. Leading vertices of the next segment that
// sit within this radius of the running end are dropped so joins stay
// seamless; keeping both copies painted the boundary twice (redundant trail)
// and made the marker step backwards before advancing at the same points.
const BOUNDARY_STITCH_RADIUS_M = 12;
const VEHICLE_LIGHTING = new LightingEffect({
  ambientLight: new AmbientLight({ color: [255, 255, 255], intensity: 2.2 }),
  directionalLight: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 1.1,
    direction: [-3, -8, -5],
  }),
});
// Hoisted so the 60fps render loop doesn't allocate a fresh array literal for
// every ScatterplotLayer/ScenegraphLayer prop on every single frame.
const VEHICLE_SHADOW_FILL_COLOR: [number, number, number, number] = [12, 14, 22, 90];
const VEHICLE_MODEL_SCALE: [number, number, number] = [0.335, 0.335, 0.335];
interface VehicleModelState {
  position: [longitude: number, latitude: number, altitude: number];
  heading: number;
}
export interface TripPosition {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  time: string;
  timestamp?: string;
  location?: string;
  driver?: string;
}
export interface TripReplayEvent {
  id: string;
  label: string;
  type: 'violation' | 'dashcam' | 'stop';
  positionIndex: number;
  detail: string;
}
interface EventMarkerRecord {
  event: TripReplayEvent;
  marker: maplibregl.Marker;
  element: HTMLElement;
  content: HTMLElement;
}

@Component({
  selector: 'app-trip-replay-map',
  templateUrl: './trip-replay-map.html',
  styleUrl: './trip-replay-map.css',
  imports: [MapControls],
})
export class TripReplayMap implements AfterViewInit, OnDestroy {
  readonly positions = input.required<TripPosition[]>();
  readonly events = input<TripReplayEvent[]>([]);
  readonly selectedEventId = input<string | null>(null);
  readonly positionIndex = input(0);
  readonly playbackActive = input(false);
  readonly playbackSpeed = input(1);
  readonly playbackStepDuration = input(260);
  readonly eventSelected = output<TripReplayEvent>();
  readonly routeLoadingChange = output<boolean>();
  readonly displayedSpeedChange = output<number>();
  readonly ready = output<void>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: MapLibreMap;
  private vehicleOverlay?: MapboxOverlay;
  private vehicleModelUrl?: string;
  private vehicleModelRequest?: Promise<void>;
  private pendingVehicle?: { position: LatLng; heading: number };
  private vehicleVisible = false;
  private endpointMarkers: maplibregl.Marker[] = [];
  private eventMarkers: EventMarkerRecord[] = [];
  // One shared, theme-aware detail card reused for every event dot: hovering a
  // dot previews it, clicking pins it until another event is selected.
  private readonly eventCard = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16,
  });
  private eventCardHideTimer?: number;
  private roadCoordinates: LatLng[] = [];
  private roadSegments: LatLng[][] = [];
  private roadSegmentRanges: Array<[number, number]> = [];
  private roadDistances: number[] = [];
  private resampledRoadCoordinates: LatLng[] = [];
  private resampledRoadDistances: number[] = [];
  private lastVehicleIndex = -1;
  private positionRoadIndexes: number[] = [];
  private positionRoadDistances: number[] = [];
  // Road-coordinate indices that the trail bridges over a raw GSP dropout or
  // teleport (an impossible jump between consecutive samples). Wherever the
  // raw trail is absent the segment renders dotted instead of a solid line
  // over territory with no recorded position.
  private jumpRoadIndices: Set<number> = new Set();
  private routeRequest?: AbortController;
  private readyFallback?: ReturnType<typeof setTimeout>;
  private readyEmitted = false;
  private routeVersion = 0;
  // Tracks consecutive primary-OSRM failures so the public fallback is only
  // engaged after the primary has clearly gone down this trip, and is reset
  // whenever a new route starts or a primary call succeeds.
  private primaryOsrmFailCount = 0;
  private cameraFrame?: number;
  private lastCameraFrameTime?: number;
  private cameraSettledFor = 0;
  private movementFinished = true;
  private lastRenderedRouteIndex = -1;
  private readonly vehicleModelData: VehicleModelState[] = [
    {
      position: [0, 0, 0.4],
      heading: 0,
    },
  ];
  private readonly vehicleShadowData: VehicleModelState[] = [
    {
      position: [0, 0, 0],
      heading: 0,
    },
  ];
  private movementStartedAt = 0;
  private movementDuration = 1;
  private movementStartDistance = 0;
  private targetRoadDistance = 0;
  private movementStartPosition: LatLng = [0, 0];
  private targetPosition: LatLng = [0, 0];
  private displayedPosition: LatLng = [0, 0];
  private displayedRoadDistance = 0;
  private displayedHeading?: number;
  private displayedCameraBearing?: number;
  private displayedCameraZoom?: number;
  private displayedCameraPitch?: number;
  private displayedRoadProgress = 0;
  private displayedSpeedKph = 0;
  private targetSpeedKph = 0;
  private lastEmittedSpeedKph = -1;
  // Scratch buffers reused across animation frames instead of allocating new
  // tuples ~5-6 times per rAF tick (bearing lookups + camera centering).
  private readonly bearingFromScratch: LatLng = [0, 0];
  private readonly bearingToScratch: LatLng = [0, 0];
  private readonly cameraPointScratch: LatLng = [0, 0];
  private readonly cameraCenterScratch: [number, number] = [0, 0];
  private readonly vehicleOrientationScratch: [number, number, number] = [0, 0, 90];
  private readonly getVehiclePosition = (vehicle: VehicleModelState) => vehicle.position;
  private readonly getVehicleOrientation = (vehicle: VehicleModelState) => {
    this.vehicleOrientationScratch[1] = -vehicle.heading + VEHICLE_MODEL_YAW_OFFSET;
    return this.vehicleOrientationScratch;
  };

  private themeObserver?: MutationObserver;

  constructor(private readonly zone: NgZone) {
    effect(() => {
      const positions = this.positions(),
        events = this.events();
      if (this.map) void this.renderRoute(positions, events);
    });
    effect(() => {
      const index = this.positionIndex();
      if (this.map) this.updateVehicle(index);
    });
    effect(() => {
      if (!this.map) return;
      this.selectedEventId();
      this.applyEventSelection();
    });
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    this.vehicleOverlay = new MapboxOverlay({
      // A separate Deck canvas is more reliable than an interleaved custom layer
      // when this component is loaded through native module federation.
      interleaved: false,
      layers: [],
      effects: [VEHICLE_LIGHTING],
      onError: (error) => console.error('Trip vehicle model could not be rendered.', error),
    });
    this.map.addControl(this.vehicleOverlay as unknown as maplibregl.IControl);
    void this.loadVehicleModel();
    this.map.on('style.load', () => this.renderRouteLayers());
    this.watchTheme();
    this.map.once('load', () => {
      void this.renderRoute(this.positions(), this.events());
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

  private async renderRoute(positions: TripPosition[], events: TripReplayEvent[]): Promise<void> {
    if (!this.map) return;
    if (!positions.length) {
      this.routeVersion++;
      this.routeRequest?.abort();
      this.routeLoadingChange.emit(false);
      this.clearMarkers();
      this.roadCoordinates = [];
      this.roadSegments = [];
      this.roadSegmentRanges = [];
      this.roadDistances = [];
      this.resampledRoadCoordinates = [];
      this.resampledRoadDistances = [];
      this.positionRoadIndexes = [];
      this.positionRoadDistances = [];
      this.jumpRoadIndices = new Set();
      if (this.map.isStyleLoaded())
        removeGeoJson(this.map, 'trip-route', [
          'trip-route-casing',
          'trip-route-line',
          'trip-route-completed',
          'trip-route-recent',
          'trip-route-jump',
        ]);
      this.map.jumpTo({
        center: [DEFAULT_MAP_CENTER[1], DEFAULT_MAP_CENTER[0]],
        zoom: DEFAULT_MAP_ZOOM,
      });
      return;
    }
    const version = ++this.routeVersion;
    this.roadSegments = [];
    this.primaryOsrmFailCount = 0;
    this.routeLoadingChange.emit(true);
    let coordinates: LatLng[];
    try {
      coordinates = await this.getRoadCoordinates(positions);
    } finally {
      if (version === this.routeVersion) this.routeLoadingChange.emit(false);
    }
    if (!this.map || version !== this.routeVersion) return;
    this.clearMarkers();
    this.roadCoordinates = coordinates;
    if (!this.roadSegments.length) this.roadSegments = [coordinates];
    this.roadSegmentRanges = [];
    let segmentStart = 0;
    for (const segment of this.roadSegments) {
      const segmentEnd = Math.min(coordinates.length - 1, segmentStart + segment.length - 1);
      if (segmentEnd > segmentStart) this.roadSegmentRanges.push([segmentStart, segmentEnd]);
      segmentStart = segmentEnd + 1;
    }
    this.roadDistances = this.buildRoadDistances(coordinates);
    this.resampledRoadCoordinates = this.resampleTrail(coordinates, this.roadDistances);
    this.resampledRoadDistances = this.buildRoadDistances(this.resampledRoadCoordinates);
    this.positionRoadIndexes = this.mapPositionsToRoad(positions, coordinates);
    this.positionRoadDistances = this.buildSyncedRoadDistances(positions);
    this.jumpRoadIndices = this.buildJumpRoadIndices(positions);
    this.displayedHeading = undefined;
    this.displayedRoadDistance = 0;
    this.targetRoadDistance = 0;
    this.displayedRoadProgress = 0;
    this.lastRenderedRouteIndex = -1;
    this.lastVehicleIndex = -1;
    this.renderRouteLayers();
    const colors = getComputedStyle(document.documentElement);
    const css = (name: string, fallback: string) =>
      colors.getPropertyValue(name).trim() || fallback;
    this.endpointMarkers = [
      this.circleMarker(
        this.roadSegments[0]?.[0] ?? coordinates[0],
        css('--color-success', '#20a77d'),
        'Trip start',
      ),
      this.circleMarker(
        this.roadSegments.at(-1)?.at(-1) ?? coordinates.at(-1)!,
        css('--color-danger', '#df405e'),
        'Trip end',
      ),
    ];
    for (const event of events) {
      const point = coordinates[this.routeIndex(event.positionIndex, positions.length)];
      if (!point) continue;
      const color =
        event.type === 'violation'
          ? css('--color-danger', '#df405e')
          : event.type === 'dashcam'
            ? css('--color-warning', '#eca91f')
            : css('--color-info', '#397bd5');
      const glyph = event.type === 'violation' ? '!' : event.type === 'dashcam' ? '●' : '';
      const border = event.type === 'stop' ? 'none' : '2px solid #fff';
      const size = event.type === 'stop' ? '12px' : '18px';
      const element = markerElement(
        `<span aria-hidden="true" style="display:grid;place-items:center;width:${size};height:${size};border:${border};border-radius:50%;background:${color};color:#fff;font:700 10px/1 sans-serif;box-shadow:0 2px 7px #18223855">${glyph}</span>`,
      );
      element.classList.add('event-dot', `type-${event.type}`);
      element.setAttribute('aria-label', `${event.label}: ${event.detail}`);
      element.setAttribute('role', 'button');
      element.tabIndex = 0;
      const marker = new maplibregl.Marker({ element })
        .setLngLat([point[1], point[0]])
        .addTo(this.map);
      const record: EventMarkerRecord = {
        event,
        marker,
        element,
        content: this.eventCardContent(event),
      };
      // Hovering previews the themed detail card; it stays reachable while the
      // cursor is over the dot or the card itself, and pins when selected.
      element.addEventListener('mouseenter', () => this.showEventCard(record));
      element.addEventListener('mouseleave', () => this.queueHideEventCard());
      record.content.addEventListener('mouseenter', () =>
        clearTimeout(this.eventCardHideTimer),
      );
      record.content.addEventListener('mouseleave', () => this.queueHideEventCard());
      element.addEventListener('click', () => this.eventSelected.emit(event));
      element.addEventListener('keydown', (keyboardEvent) => {
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ')
          this.eventSelected.emit(event);
      });
      this.eventMarkers.push(record);
    }
    this.applyEventSelection();
    // Ease into the cinematic pitch/bearing rather than snapping to it, so the
    // very first frame of a trip doesn't feel like a hard cut.
    this.map.easeTo({ pitch: 42, bearing: -20, duration: 700 });
    fitLatLngs(this.map, coordinates, 40, 14);
    this.updateVehicle(this.positionIndex());
  }

  private renderRouteLayers(): void {
    if (!this.map?.isStyleLoaded() || this.roadCoordinates.length < 2) return;
    const completedIndex = Math.max(0, Math.round(this.displayedRoadProgress));
    const recentStart = Math.max(0, completedIndex - RECENT_TRAIL_POINTS);
    const features = this.roadSegments
      .map((segment, segmentIndex) => [segment, this.roadSegmentRanges[segmentIndex]?.[0] ?? 0] as const)
      .flatMap(([segment, base]) => this.baseRouteFeatures(segment, base));
    if (completedIndex > 0)
      features.push(...this.rangeFeatures(0, completedIndex, 'completed'));
    if (completedIndex > recentStart)
      features.push(...this.rangeFeatures(recentStart, completedIndex, 'recent', true));
    // MapLibre's color parser does not reliably support the oklch() value
    // returned by our Tailwind CSS variable, so use equivalent concrete colors.
    const routeColor = document.documentElement.classList.contains('dark')
      ? '#c4b5fd'
      : '#8b19f5';
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    const source = this.map.getSource('trip-route') as maplibregl.GeoJSONSource | undefined;
    const layerIds = [
      'trip-route-casing',
      'trip-route-line',
      'trip-route-completed',
      'trip-route-recent',
      'trip-route-jump',
    ];
    if (source && layerIds.every((id) => this.map?.getLayer(id))) {
      // Updating source data preserves the existing GPU layers and avoids a visible
      // hitch every time playback advances.
      source.setData(data);
      return;
    }
    upsertGeoJson(this.map, 'trip-route', data, [
      {
        id: 'trip-route-casing',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'route'],
        paint: { 'line-color': routeColor, 'line-width': 9, 'line-opacity': 0.18 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-line',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'route'],
        paint: { 'line-color': routeColor, 'line-width': 4, 'line-opacity': 0.82 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-completed',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'completed'],
        paint: { 'line-color': routeColor, 'line-width': 4.5, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        // 'fade' is a per-feature property (0..1) so the trail reads as a soft
        // gradient tapering to nothing, rather than one flat-opacity band.
        id: 'trip-route-recent',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'recent'],
        paint: { 'line-color': routeColor, 'line-width': 5.5, 'line-opacity': ['get', 'fade'] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        // Dropouts and teleports are drawn as a dotted line so the trail reads
        // as discontinuous rather than a solid line over territory with no road.
        id: 'trip-route-jump',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'jump'],
        paint: {
          'line-color': routeColor,
          'line-width': 4,
          'line-opacity': 0.9,
          'line-dasharray': [1, 2],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
    ]);
  }

  private buildFadedTrailFeatures(coordinates: LatLng[]): GeoJSON.Feature[] {
    const segments = coordinates.length - 1;
    if (segments < 1) return [];
    const features: GeoJSON.Feature[] = [];
    for (let index = 0; index < segments; index++) {
      // Oldest segment fades near-transparent; newest segment is fully opaque.
      const fade = 0.12 + 0.88 * ((index + 1) / segments);
      features.push(
        lineFeature([coordinates[index], coordinates[index + 1]], { kind: 'recent', fade }),
      );
    }
    return features;
  }

  private rangeFeatures(
    start: number,
    end: number,
    kind: 'completed' | 'recent',
    fade = false,
  ): GeoJSON.Feature[] {
    const features: GeoJSON.Feature[] = [];
    for (const [segmentStart, segmentEnd] of this.roadSegmentRanges) {
      const from = Math.max(start, segmentStart);
      const to = Math.min(end, segmentEnd);
      if (to <= from) continue;
      const points = this.roadCoordinates.slice(from, to + 1);
      if (!fade) features.push(lineFeature(points, { kind }));
      else features.push(...this.buildFadedTrailFeatures(points));
    }
    return features;
  }

  // Splits a matched segment into contiguous solid (kind 'route') and dotted
  // (kind 'jump') features. A segment's coordinates are flattened into
  // roadCoordinates at renderRoute; `base` is that segment's starting index
  // within roadCoordinates, so every segment vertex resolves a global index
  // into jumpRoadIndices (indexes OSRM bridged over a raw GPS dropout).
  private baseRouteFeatures(segment: LatLng[], base: number): GeoJSON.Feature[] {
    if (segment.length < 2) return [];
    const features: GeoJSON.Feature[] = [];
    let runKind: 'route' | 'jump' | null = null;
    let runStart = 0;
    for (let index = 0; index < segment.length - 1; index++) {
      const kind: 'route' | 'jump' = this.jumpRoadIndices.has(base + index) ? 'jump' : 'route';
      if (runKind !== kind) {
        if (runKind && index > runStart)
          features.push(lineFeature(segment.slice(runStart, index + 1), { kind: runKind }));
        runKind = kind;
        runStart = index;
      }
    }
    if (runKind && segment.length - 1 > runStart)
      features.push(lineFeature(segment.slice(runStart, segment.length), { kind: runKind }));
    return features;
  }

  private circleMarker(point: LatLng, color: string, label: string): maplibregl.Marker {
    const element = markerElement(
      `<span aria-hidden="true" style="display:block;width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 2px 7px #18223855"></span>`,
    );
    element.setAttribute('aria-label', label);
    attachTooltip(element, label, 'top');
    return new maplibregl.Marker({ element })
      .setLngLat([point[1], point[0]])
      .setPopup(popup(label))
      .addTo(this.map!);
  }

  private clearMarkers(): void {
    this.vehicleVisible = false;
    this.stopCameraLoop();
    this.displayedCameraBearing = undefined;
    this.displayedCameraZoom = undefined;
    this.displayedCameraPitch = undefined;
    this.displayedSpeedKph = 0;
    this.targetSpeedKph = 0;
    this.emitDisplayedSpeed();
    this.movementFinished = true;
    this.cameraSettledFor = 0;
    this.lastRenderedRouteIndex = -1;
    this.vehicleOverlay?.setProps({ layers: [] });
    this.endpointMarkers.forEach((item) => item.remove());
    this.eventMarkers.forEach((record) => record.marker.remove());
    this.hideEventCard();
    this.endpointMarkers = [];
    this.eventMarkers = [];
  }

  // Keeps the map in sync with whichever event is selected anywhere in the UI:
  // enlarges its dot — the detail card only appears on hover.
  private applyEventSelection(): void {
    const selectedId = this.selectedEventId();
    for (const record of this.eventMarkers) {
      record.element.classList.toggle('selected', record.event.id === selectedId);
    }
  }

  private showEventCard(record: EventMarkerRecord): void {
    clearTimeout(this.eventCardHideTimer);
    if (!this.map) return;
    this.eventCard
      .setLngLat(record.marker.getLngLat())
      .setDOMContent(record.content)
      .addTo(this.map);
  }

  // Small delay so moving the cursor between the dot and the card (or within
  // the card) never makes it flicker away mid-read.
  private queueHideEventCard(): void {
    if (this.eventCardHideTimer !== undefined) clearTimeout(this.eventCardHideTimer);
    this.eventCardHideTimer = window.setTimeout(() => {
      this.eventCardHideTimer = undefined;
      this.hideEventCard();
    }, 90);
  }

  private hideEventCard(): void {
    clearTimeout(this.eventCardHideTimer);
    this.eventCardHideTimer = undefined;
    this.eventCard.remove();
  }

  // Built with DOM APIs + textContent so API-sourced labels can never inject
  // markup, and every element picks up its color from theme CSS variables.
  private eventCardContent(event: TripReplayEvent): HTMLElement {
    const position = this.positions()[Math.max(0, event.positionIndex)];
    const time = position ? this.clockTime(position.timestamp ?? position.time) : '—:—';
    const speed = position ? ` · ${position.speed} km/h` : '';
    const root = document.createElement('div');
    root.className = `trip-event-popup type-${event.type}`;
    const header = document.createElement('header');
    const dot = document.createElement('i');
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = event.type === 'violation' ? '!' : event.type === 'dashcam' ? '\u25CF' : '\u25CF';
    const title = document.createElement('strong');
    title.textContent = event.label;
    header.append(dot, title);
    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `${time}${speed}`;
    const detail = document.createElement('p');
    detail.className = 'detail';
    detail.textContent = event.detail;
    root.append(header, meta, detail);
    return root;
  }

  private clockTime(value: string | undefined): string {
    if (!value) return '—:—';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false })
        .format(date);
    return value.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? value;
  }

  private async getRoadCoordinates(positions: TripPosition[]): Promise<LatLng[]> {
    const cleanedPositions = this.condenseStationaryPoints(this.removeGpsSpikes(positions));
    const fallback = cleanedPositions.map(({ lat, lng }) => [lat, lng] as LatLng);
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    try {
      const matched: LatLng[] = [];
      const segments: LatLng[][] = [];
      for (const chunk of this.positionChunks(cleanedPositions, 95)) {
        let segment = await this.matchChunk(chunk);
        // Stitch the chunk join: drop the next segment's leading vertices that
        // sit within BOUNDARY_STITCH_RADIUS_M of the running end. Segments are
        // internally de-duplicated, so this keeps every segment an exact 1:1
        // slice of the flattened route (roadSegmentRanges depends on that).
        while (
          matched.length &&
          segment.length > 1 &&
          this.distanceBetweenCoordinates(matched[matched.length - 1], segment[0]) <=
            BOUNDARY_STITCH_RADIUS_M
        )
          segment = segment.slice(1);
        if (!segment.length) continue;
        segments.push(segment);
        matched.push(...segment);
      }
      this.roadSegments = segments;
      return matched;
    } catch {
      // A superseded request (a newer route started) must not overwrite the
      // segment state the newer run is about to publish.
      if (!this.routeRequest?.signal.aborted) this.roadSegments = [fallback];
      return fallback;
    }
  }

  private async matchChunk(chunk: TripPosition[]): Promise<LatLng[]> {
    const coordinates = chunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
    const timestamps = chunk
      .map((point, index) => {
        const parsed = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
        return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : index;
      })
      .join(';');
    const rawCoordinates = chunk.map(({ lat, lng }) => [lat, lng] as LatLng);
    const rawDistance = this.pathDistance(rawCoordinates);
    const accepted = (matched: LatLng[] | null): LatLng[] | null =>
      matched && this.pathDistance(matched) <= rawDistance * OSRM_MAX_DISTANCE_INFLATION
        ? matched
        : null;

    // Attempt 1: OSRM /match with standard parameters on the primary server.
    const matchResult = accepted(
      await this.tryOsrmMatch(environment.osrmBaseUrl, coordinates, timestamps, OSRM_MATCH_RADIUS),
    );
    if (matchResult) {
      this.primaryOsrmFailCount = 0;
      return this.removeTrailLoops(this.dedupeCoordinates(matchResult));
    }

    // Attempt 2: OSRM /match with double radius on the primary server — GPS
    // drift in urban canyons or poor-signal areas can exceed 200m.
    const looseResult = accepted(
      await this.tryOsrmMatch(
        environment.osrmBaseUrl,
        coordinates,
        timestamps,
        OSRM_MATCH_RADIUS * 2,
      ),
    );
    if (looseResult) {
      this.primaryOsrmFailCount = 0;
      return this.removeTrailLoops(this.dedupeCoordinates(looseResult));
    }

    // The primary server rejected both radiuses for this chunk. Only once it
    // has failed a few consecutive chunks (clear outage, not a one-off flake)
    // do we engage the public OSRM server as a second road-matched tier.
    this.primaryOsrmFailCount++;
    if (this.primaryOsrmFailCount >= PUBLIC_OSRM_FAIL_THRESHOLD) {
      // The public demo server enforces a small matching budget, so the chunk
      // is split into sub-traces and the matched geometries are concatenated.
      const publicResult = accepted(
        await this.tryOsrmMatchSubChunks(chunk, PUBLIC_OSRM_MATCH_RADIUS),
      );
      if (publicResult) return this.removeTrailLoops(this.dedupeCoordinates(publicResult));
    }

    // Final fallback: raw GPS with backtracking cleanup. Raw GPS is at least
    // accurate to the vehicle's reported position — better than a square detour.
    return this.removeTrailLoops(this.cleanRawCoordinates(rawCoordinates));
  }

  private async tryOsrmMatch(
    baseUrl: string,
    coordinates: string,
    timestamps: string,
    radius: number,
  ): Promise<LatLng[] | null> {
    try {
      const radiuses = coordinates.split(';').map(() => String(radius)).join(';');
      const url =
        `${baseUrl}/match/v1/driving/${coordinates}` +
        `?timestamps=${timestamps}&radiuses=${radiuses}&overview=full&geometries=geojson`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OSRM_REQUEST_TIMEOUT_MS);
      this.routeRequest?.signal.addEventListener(
        'abort',
        () => controller.abort(),
        { once: true },
      );
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) return null;
      const result = (await response.json()) as {
        code?: string;
        matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      if (result.code !== 'Ok') return null;
      // OSRM may split a chunk into several sequential matchings; they arrive
      // in travel order, so concatenation preserves the driven path. Each
      // matching is road-following by construction.
      // Splitting a chunk into several matchings (or the fallback into
      // sub-traces) re-snaps each piece independently, so the pieces can begin
      // with a short double-back over the previous piece's tail. Dropping each
      // piece's leading vertices that sit within BOUNDARY_STITCH_RADIUS_M of
      // the running end removes those loop artefacts.
      const merged: LatLng[] = [];
      for (const matching of result.matchings ?? []) {
        let coords = (matching.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as LatLng);
        if (coords.length < 2) continue;
        while (
          merged.length &&
          coords.length > 1 &&
          this.distanceBetweenCoordinates(merged[merged.length - 1], coords[0]) <=
            BOUNDARY_STITCH_RADIUS_M
        )
          coords = coords.slice(1);
        if (!coords.length) continue;
        merged.push(...coords);
      }
      return merged.length >= 2 ? merged : null;
    } catch {
      return null;
    }
  }

  // Matches a chunk against the public OSRM fallback by splitting it into
  // sub-traces within the demo server's coordinate budget and concatenating
  // the matched geometries. Every sub-trace uses the same radius and each is
  // internally road-following, so concatenation preserves the driven path.
  private async tryOsrmMatchSubChunks(
    chunk: TripPosition[],
    radius: number,
  ): Promise<LatLng[] | null> {
    const merged: LatLng[] = [];
    for (const subChunk of this.positionChunks(chunk, PUBLIC_OSRM_MAX_TRACE)) {
      const coordinates = subChunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
      const timestamps = subChunk
        .map((point, index) => {
          const parsed = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
          return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : index;
        })
        .join(';');
      const matched = await this.tryOsrmMatch(
        environment.osrmFallbackUrl,
        coordinates,
        timestamps,
        radius,
      );
      if (!matched) return null;
      // Stitch the sub-chunk join: each sub-trace is independently snapped, so
      // drop leading vertices overlapping the running end (same rule as the
      // primary chunk stitching) to prevent double-back loops at the joins.
      let coords = matched;
      while (
        merged.length &&
        coords.length > 1 &&
        this.distanceBetweenCoordinates(merged[merged.length - 1], coords[0]) <=
          BOUNDARY_STITCH_RADIUS_M
      )
        coords = coords.slice(1);
      if (!coords.length) continue;
      merged.push(...coords);
    }
    return merged.length >= 2 ? merged : null;
  }

  private positionChunks(positions: TripPosition[], size: number): TripPosition[][] {
    const chunks: TripPosition[][] = [];
    for (let index = 0; index < positions.length - 1; index += size - 1)
      chunks.push(positions.slice(index, Math.min(index + size, positions.length)));
    return chunks;
  }

  private dedupeCoordinates(points: LatLng[]): LatLng[] {
    return points.filter(
      (point, index) =>
        index === 0 || this.distanceBetweenCoordinates(point, points[index - 1]) > 0.5,
    );
  }

  private cleanRawCoordinates(points: LatLng[]): LatLng[] {
    if (points.length < 3) return points;
    // Pass 1: Remove points that cause backtracking — where the next point
    // moves back toward a recent point instead of continuing forward. This
    // eliminates the "thick trail" caused by redundant overlapping segments.
    const forward: LatLng[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = forward.at(-1)!;
      const curr = points[i];
      if (curr[0] === prev[0] && curr[1] === prev[1]) continue;
      // Check if this point backtracks toward any recent forward point.
      const backtrackThreshold = 30; // metres
      let backtracks = false;
      for (let j = Math.max(0, forward.length - 4); j < forward.length; j++) {
        if (this.distanceBetweenCoordinates(curr, forward[j]) < backtrackThreshold) {
          backtracks = true;
          break;
        }
      }
      if (!backtracks) forward.push(curr);
    }
    // Pass 2: Remove near-duplicate consecutive points (within 2m).
    return this.dedupeCoordinates(
      forward.filter(
        (point, index) =>
          index === 0 ||
          this.distanceBetweenCoordinates(point, forward[index - 1]) > 2,
      ),
    );
  }

  // Collapses the GPS jitter cloud recorded while the vehicle is parked into a
  // single point per stop. Without this, the map matcher reads the scattered
  // stationary points as a detour onto surrounding streets — the "square"
  // artefact in the trail — and the extra fake distance then makes the marker
  // speed up while crossing it.
  private condenseStationaryPoints(positions: TripPosition[]): TripPosition[] {
    if (positions.length < 3) return positions;
    const condensed: TripPosition[] = [positions[0]];
    let anchor = positions[0];
    for (let index = 1; index < positions.length; index++) {
      const point = positions[index];
      const isStationary = (point.speed ?? 0) <= STATIONARY_SPEED_KPH;
      if (isStationary && this.distanceMetres(anchor, point) < STATIONARY_COLLAPSE_RADIUS_M)
        continue;
      condensed.push(point);
      anchor = point;
    }
    return condensed;
  }

  // Excises double-back loops from trail geometry: when the path returns to
  // within LOOP_CLOSE_RADIUS_M of a recent vertex after travelling at least
  // LOOP_MIN_TRAVELLED_M, everything between the two visits is redundant
  // back-and-forth trace that paints the thick overlapping band and can walk
  // the marker backwards along the same street.
  private removeTrailLoops(points: LatLng[]): LatLng[] {
    if (points.length < 4) return points;
    const result: LatLng[] = [points[0]];
    const travelled: number[] = [0];
    for (let index = 1; index < points.length; index++) {
      const point = points[index];
      const windowStart = Math.max(0, result.length - LOOP_WINDOW_POINTS);
      let loopStart = -1;
      for (let j = result.length - 2; j >= windowStart; j--) {
        if (this.distanceBetweenCoordinates(point, result[j]) >= LOOP_CLOSE_RADIUS_M) continue;
        if (travelled[result.length - 1] - travelled[j] < LOOP_MIN_TRAVELLED_M) continue;
        loopStart = j;
        break;
      }
      if (loopStart >= 0) {
        result.length = loopStart + 1;
        travelled.length = loopStart + 1;
      }
      const previous = result[result.length - 1];
      const step = this.distanceBetweenCoordinates(previous, point);
      if (step <= 0.5) continue;
      result.push(point);
      travelled.push(travelled[travelled.length - 1] + step);
    }
    return result;
  }

  private pathDistance(points: LatLng[]): number {
    let distance = 0;
    for (let index = 1; index < points.length; index++)
      distance += this.distanceBetweenCoordinates(points[index - 1], points[index]);
    return distance;
  }

  private removeGpsSpikes(positions: TripPosition[]): TripPosition[] {
    if (positions.length < 3) return positions;
    return positions.filter((point, index) => {
      if (index === 0 || index === positions.length - 1) return true;
      const previous = positions[index - 1],
        next = positions[index + 1];
      const intoSpike = this.distanceMetres(previous, point);
      const outOfSpike = this.distanceMetres(point, next);
      const direct = this.distanceMetres(previous, next);
      return !(intoSpike > 250 && outOfSpike > 250 && direct < (intoSpike + outOfSpike) * 0.35);
    });
  }

  private distanceMetres(a: TripPosition, b: TripPosition): number {
    return this.distanceBetweenCoordinates([a.lat, a.lng], [b.lat, b.lng]);
  }

  private distanceBetweenCoordinates(a: LatLng, b: LatLng): number {
    const radians = (value: number) => (value * Math.PI) / 180;
    const lat = radians(b[0] - a[0]),
      lng = radians(b[1] - a[1]);
    const value =
      Math.sin(lat / 2) ** 2 +
      Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(lng / 2) ** 2;
    return 12_742_000 * Math.asin(Math.sqrt(value));
  }

  private buildRoadDistances(coordinates: LatLng[]): number[] {
    const distances = [0];
    for (let index = 1; index < coordinates.length; index++)
      distances.push(
        distances[index - 1] +
          this.distanceBetweenCoordinates(coordinates[index - 1], coordinates[index]),
      );
    return distances;
  }

  // Rebuilds the OSRM trail into uniformly spaced waypoints (OSRM_RESAMPLE_STEP_M
  // apart). The result is the authoritative path for playback: stepping along it
  // decouples marker movement from raw-sample density, so sparse GPS no longer
  // produces fast leaps and dense clusters no longer hold the marker still.
  private resampleTrail(
    coordinates: LatLng[],
    distances: number[],
    stepMetres: number = OSRM_RESAMPLE_STEP_M,
  ): LatLng[] {
    if (coordinates.length < 2) return coordinates.slice();
    const total = distances.at(-1) ?? 0;
    if (total <= 0 || stepMetres <= 0) return coordinates.slice();
    const resampled: LatLng[] = [coordinates[0].slice() as LatLng];
    let nextDist = stepMetres;
    let index = 1;
    while (nextDist < total && index < coordinates.length) {
      while (index < coordinates.length && distances[index] < nextDist) index++;
      if (index >= coordinates.length) break;
      const d0 = distances[index - 1];
      const d1 = distances[index];
      const fraction = d1 === d0 ? 0 : (nextDist - d0) / (d1 - d0);
      const lat = coordinates[index - 1][0] + (coordinates[index][0] - coordinates[index - 1][0]) * fraction;
      const lng = coordinates[index - 1][1] + (coordinates[index][1] - coordinates[index - 1][1]) * fraction;
      resampled.push([lat, lng]);
      nextDist += stepMetres;
    }
    const last = coordinates[coordinates.length - 1];
    const lastResampled = resampled[resampled.length - 1];
    if (this.distanceBetweenCoordinates(lastResampled, last) > 1)
      resampled.push(last.slice() as LatLng);
    return resampled;
  }

  private routeIndex(positionIndex: number, count: number): number {
    const mapped = this.positionRoadIndexes[Math.max(0, Math.min(positionIndex, count - 1))];
    if (mapped !== undefined) return mapped;
    return count <= 1 || this.roadCoordinates.length <= 1
      ? 0
      : Math.round((positionIndex / (count - 1)) * (this.roadCoordinates.length - 1));
  }

  private mapPositionsToRoad(positions: TripPosition[], road: LatLng[]): number[] {
    if (!positions.length || !road.length) return [];
    let previousIndex = 0;
    return positions.map((position, positionIndex) => {
      const expected =
        positions.length <= 1
          ? 0
          : Math.round((positionIndex / (positions.length - 1)) * (road.length - 1));
      // Search near both the previous match and the expected trip progress. This
      // prevents an overlapping road later in the trip from stealing the match.
      const radius = Math.max(80, Math.ceil((road.length / positions.length) * 8));
      const start = Math.max(previousIndex, Math.min(expected - radius, road.length - 1));
      const end = Math.min(road.length - 1, Math.max(previousIndex + radius, expected + radius));
      let bestIndex = previousIndex;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = start; index <= end; index++) {
        const latScale = road[index][0] - position.lat;
        const lngScale = (road[index][1] - position.lng) * Math.cos((position.lat * Math.PI) / 180);
        const distance = latScale * latScale + lngScale * lngScale;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      previousIndex = Math.max(previousIndex, bestIndex);
      return previousIndex;
    });
  }

  // Marks the road-coordinate indices that bridge an impossible jump between
// consecutive RAW samples (dropout, teleport, device switch). Every road
// vertex from one sample's matched position to the next is flagged, so the
// OSRM trail renders dotted exactly where no raw trail exists.
  private buildJumpRoadIndices(positions: TripPosition[]): Set<number> {
    const jump = new Set<number>();
    for (let index = 0; index < positions.length - 1; index++) {
      if (!this.isImpossibleRawJump(positions[index], positions[index + 1])) continue;
      const fromRoad = this.positionRoadIndexes[index];
      const toRoad = this.positionRoadIndexes[index + 1];
      if (fromRoad === undefined || toRoad === undefined) continue;
      for (
        let roadIndex = Math.min(fromRoad, toRoad);
        roadIndex < Math.max(fromRoad, toRoad);
        roadIndex++
      )
        jump.add(roadIndex);
    }
    return jump;
  }

  // Same impossibility rule as TripReplayPage.isImpossibleTrailJump: permit a
  // generous 198 km/h (55 m/s) between samples but never bridge a dropout or
  // device switch spanning hundreds of metres in only a few seconds.
  private isImpossibleRawJump(a: TripPosition, b: TripPosition): boolean {
    const rawA = a.timestamp ?? a.time;
    const rawB = b.timestamp ?? b.time;
    if (!rawA || !rawB) return false;
    const timeA = new Date(rawA).getTime();
    const timeB = new Date(rawB).getTime();
    if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return false;
    const elapsedSeconds = Math.max(1, (timeB - timeA) / 1_000);
    const distance = this.distanceMetres(a, b);
    return distance > Math.max(300, elapsedSeconds * 55);
  }

  // Synchronises marker progress with the OSRM trail. The position→road
  // mapping can compress a run of consecutive samples onto the same road
  // vertex (the matcher clips corners, and dedupe/condense shorten the trail),
  // which used to freeze the marker for the whole duration of those samples.
  // Each compressed run is decided by comparing the raw coordinates against
  // the OSRM progress: if the raw GPS actually travelled (net displacement
  // beyond jitter), the samples are spread across the road stretch up to the
  // next advancing anchor, proportional to raw travel; if the raw points
  // barely moved, it is a genuine stop and the marker holds its position.
  private buildSyncedRoadDistances(positions: TripPosition[]): number[] {
    const result = this.positionRoadIndexes.map((index) => this.roadDistances[index] ?? 0);
    if (result.length < 2) return result;
    const raw = positions.map(({ lat, lng }) => [lat, lng] as LatLng);
    const roadTotal = this.roadDistances.at(-1) ?? 0;
    const RAW_STOP_JITTER_M = 10;
    let start = 0;
    while (start < result.length) {
      let end = start;
      while (end + 1 < result.length && result[end + 1] <= result[start]) end++;
      if (end > start) {
        const spreadEnd = end + 1 < result.length ? result[end + 1] : roadTotal;
        const spread = spreadEnd - result[start];
        const drift = this.distanceBetweenCoordinates(raw[start], raw[end]);
        if (spread > 0 && drift > RAW_STOP_JITTER_M) {
          for (let k = start; k <= end; k++) {
            const progressed =
              this.distanceBetweenCoordinates(raw[start], raw[Math.min(k, raw.length - 1)]);
            result[k] = result[start] + spread * Math.min(1, progressed / (drift || 1));
          }
        }
      }
      start = end + 1;
    }
    return result;
  }

  private updateVehicle(index: number): void {
    if (
      !this.map ||
      !this.vehicleOverlay ||
      !this.roadCoordinates.length ||
      !this.positions().length
    )
      return;
    const positions = this.positions();
    // Distance along the resampled (uniformly spaced) trail. Moving along
    // fixed-spacing waypoints in step with playback time fixes both "fast
    // jump" (sparse GPS spanning a long road gap) and "frozen marker" (dense
    // GPS compressed onto one vertex) artefacts.
    const clampedIndex = Math.max(0, Math.min(index, positions.length - 1));
    const targetDistance = this.targetDistanceForIndex(clampedIndex, positions.length);
    const position = this.coordinateAtDistance(targetDistance);
    const heading = this.rawHeadingAtDistance(targetDistance);
    this.targetSpeedKph = positions[clampedIndex]?.speed ?? this.targetSpeedKph;
    // Forward playback must never walk the marker backwards: residual
    // geometry back-steps (chunk joins, loop excision) hold the marker in
    // place instead of retracing. Backward steps only occur on an explicit
    // seek, which teleports straight to the target.
    const forwardStep = index >= this.lastVehicleIndex;
    this.lastVehicleIndex = index;
    if (this.vehicleVisible) {
      if (this.playbackActive() && forwardStep)
        this.animateVehicleTo(
          position,
          Math.max(targetDistance, this.displayedRoadDistance),
        );
      else if (this.playbackActive())
        // Backward playback never happens during normal playback, so a step
        // backwards is always an explicit seek (scrub to an earlier point,
        // event jump, restart). Teleport straight there instead of retracing
        // the drawn trail in reverse at the forward step rate.
        this.teleportVehicle(position, heading, targetDistance);
      else this.teleportVehicle(position, heading, targetDistance);
    } else {
      this.vehicleVisible = true;
      this.targetRoadDistance = targetDistance;
      this.displayedRoadDistance = targetDistance;
      this.movementStartDistance = targetDistance;
      this.movementStartPosition[0] = position[0];
      this.movementStartPosition[1] = position[1];
      this.targetPosition[0] = position[0];
      this.targetPosition[1] = position[1];
      this.movementStartedAt = performance.now();
      this.displayedRoadProgress = this.progressAtDistance(targetDistance);
      this.displayedHeading = heading;
      this.displayedSpeedKph = this.targetSpeedKph;
      this.displayedPosition[0] = position[0];
      this.displayedPosition[1] = position[1];
      this.renderVehicleModel(position, heading);
      this.renderRouteLayersIfNeeded(true);
      this.startCameraLoop();
    }
  }

  // Maps a raw position index to metres travelled along the resampled trail,
  // in proportion to playback progress (index / total). During a genuine
  // stationary run the marker is held at the run's starting distance instead
  // of gliding forward, matching real-world behaviour.
  private targetDistanceForIndex(index: number, count: number): number {
    const last = count - 1;
    const lastDistance = this.resampledRoadDistances.at(-1) ?? 0;
    if (last <= 0 || lastDistance <= 0) return 0;
    const clamped = Math.max(0, Math.min(index, last));
    const stopStart = this.stationaryRunStart(count, clamped);
    const effectiveIndex = stopStart >= 0 ? Math.max(0, stopStart - 1) : clamped;
    return (Math.max(0, Math.min(effectiveIndex, last)) / last) * lastDistance;
  }

  // Returns the index of the first sample of a genuine stationary run that
  // contains `index`, or -1 when the vehicle was moving at that sample.
  private stationaryRunStart(count: number, index: number): number {
    const positions = this.positions();
    if (count < STOP_MIN_SAMPLES || index >= count) return -1;
    let runStart = index;
    while (runStart > 0 && (positions[runStart - 1]?.speed ?? 0) <= STOP_SPEED_KPH)
      runStart--;
    let runEnd = index;
    while (runEnd + 1 < count && (positions[runEnd + 1]?.speed ?? 0) <= STOP_SPEED_KPH)
      runEnd++;
    if (runEnd - runStart + 1 < STOP_MIN_SAMPLES) return -1;
    return (positions[index]?.speed ?? 0) <= STOP_SPEED_KPH ? runStart : -1;
  }

  private animateVehicleTo(targetPosition: LatLng, targetDistance: number): void {
    if (!this.map || !this.vehicleOverlay || !this.vehicleVisible) return;
    this.movementStartDistance = this.displayedRoadDistance;
    this.targetRoadDistance = targetDistance;
    this.movementStartPosition[0] = this.displayedPosition[0];
    this.movementStartPosition[1] = this.displayedPosition[1];
    this.targetPosition[0] = targetPosition[0];
    this.targetPosition[1] = targetPosition[1];
    this.movementStartedAt = performance.now();
    this.movementDuration = Math.max(40, this.playbackStepDuration());
    this.movementFinished = false;
    this.cameraSettledFor = 0;
    this.startCameraLoop();
  }

  // Instantly places the marker at a target without animating along the trail.
  // Used for paused scrubs and any seek/jump to an earlier point, where an
  // animated move would visibly retrace the drawn route backwards.
  private teleportVehicle(position: LatLng, heading: number, targetDistance: number): void {
    this.cancelMovement();
    this.targetRoadDistance = targetDistance;
    this.displayedRoadDistance = targetDistance;
    this.movementStartDistance = targetDistance;
    this.movementStartPosition[0] = position[0];
    this.movementStartPosition[1] = position[1];
    this.targetPosition[0] = position[0];
    this.targetPosition[1] = position[1];
    this.movementStartedAt = performance.now();
    this.displayedRoadProgress = this.progressAtDistance(targetDistance);
    this.displayedHeading = heading;
    this.displayedPosition[0] = position[0];
    this.displayedPosition[1] = position[1];
    this.renderVehicleModel(position, heading);
    this.renderRouteLayersIfNeeded(true);
    this.startCameraLoop();
  }

  private renderVehicleModel(position: LatLng, heading: number): void {
    if (!this.vehicleModelUrl) {
      this.pendingVehicle = { position, heading };
      void this.loadVehicleModel();
      return;
    }
    const model = this.vehicleModelData[0];
    const shadow = this.vehicleShadowData[0];
    model.position[0] = position[1];
    model.position[1] = position[0];
    model.position[2] = 0.4;
    model.heading = heading;
    shadow.position[0] = position[1];
    shadow.position[1] = position[0];
    shadow.position[2] = 0;
    shadow.heading = heading;
    this.vehicleOverlay?.setProps({
      layers: [
        // A soft ground contact shadow keeps the model from reading as a
        // floating cut-out icon, the same trick used by Google/Uber-style maps.
        new ScatterplotLayer<VehicleModelState>({
          id: 'trip-vehicle-shadow',
          data: this.vehicleShadowData,
          getPosition: this.getVehiclePosition,
          getRadius: 3.6,
          radiusUnits: 'meters',
          getFillColor: VEHICLE_SHADOW_FILL_COLOR,
          stroked: false,
          pickable: false,
          updateTriggers: { getPosition: [position[0], position[1]] },
        }),
        new ScenegraphLayer<VehicleModelState>({
          id: 'trip-vehicle-model',
          data: this.vehicleModelData,
          scenegraph: this.vehicleModelUrl,
          getPosition: this.getVehiclePosition,
          getOrientation: this.getVehicleOrientation,
          // The low-poly muscle car is approximately six authoring units long.
          getScale: VEHICLE_MODEL_SCALE,
          sizeScale: 1,
          sizeMinPixels: 24,
          sizeMaxPixels: 44,
          pickable: false,
          _lighting: 'pbr',
          updateTriggers: {
            getPosition: [position[0], position[1]],
            getOrientation: [heading],
          },
        }),
      ],
    });
  }

  private loadVehicleModel(): Promise<void> {
    if (this.vehicleModelRequest) return this.vehicleModelRequest;
    this.vehicleModelRequest = (async () => {
      let lastError: unknown;
      for (const path of VEHICLE_MODEL_PATHS) {
        try {
          const response = await fetch(new URL(path, window.location.origin), {
            cache: 'no-store',
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          const magic = new TextDecoder('ascii').decode(bytes.slice(0, 4));
          if (magic !== 'glTF')
            throw new Error(`Expected GLB data but received ${magic || 'an empty response'}`);
          this.vehicleModelUrl = URL.createObjectURL(
            new Blob([bytes], { type: 'model/gltf-binary' }),
          );
          const pending = this.pendingVehicle;
          this.pendingVehicle = undefined;
          if (pending) this.renderVehicleModel(pending.position, pending.heading);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      console.error('Trip vehicle GLB could not be downloaded.', lastError);
    })();
    return this.vehicleModelRequest;
  }

  private coordinateAt(progress: number, out?: LatLng): LatLng {
    const lower = Math.max(0, Math.min(Math.floor(progress), this.roadCoordinates.length - 1));
    const upper = Math.min(lower + 1, this.roadCoordinates.length - 1),
      fraction = progress - lower;
    const start = this.roadCoordinates[lower],
      end = this.roadCoordinates[upper];
    const lat = start[0] + (end[0] - start[0]) * fraction;
    const lng = start[1] + (end[1] - start[1]) * fraction;
    if (out) {
      out[0] = lat;
      out[1] = lng;
      return out;
    }
    return [lat, lng];
  }

  private progressAtDistance(distance: number): number {
    if (this.roadDistances.length < 2) return 0;
    const clamped = Math.max(0, Math.min(distance, this.roadDistances.at(-1) ?? 0));
    let low = 0,
      high = this.roadDistances.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.roadDistances[middle] <= clamped) low = middle;
      else high = middle - 1;
    }
    const upper = Math.min(low + 1, this.roadDistances.length - 1);
    const segmentLength = this.roadDistances[upper] - this.roadDistances[low];
    return low + (segmentLength > 0 ? (clamped - this.roadDistances[low]) / segmentLength : 0);
  }

  private coordinateAtDistance(distance: number, out?: LatLng): LatLng {
    return this.coordinateAt(this.progressAtDistance(distance), out);
  }

  private rawHeadingAtDistance(distance: number): number {
    const from = this.coordinateAtDistance(distance - 5, this.bearingFromScratch);
    const to = this.coordinateAtDistance(distance + 9, this.bearingToScratch);
    if (this.distanceBetweenCoordinates(from, to) < 1 && this.displayedHeading !== undefined)
      return this.displayedHeading;
    return this.calculateBearing(from, to);
  }

  private cameraHeadingAtDistance(distance: number, speedKph: number): number {
    const speedFactor = Math.max(0, Math.min(speedKph / 100, 1));
    const tangentHalfLength = 10 + speedFactor * 12;
    const lookAhead = 35 + speedFactor * 75;
    const samples = 6;
    let vectorX = 0;
    let vectorY = 0;
    let totalWeight = 0;

    // Blend several local road tangents instead of measuring one long chord
    // through a corner. As each tangent enters the window, a large turn is
    // introduced progressively rather than as one abrupt target-bearing jump.
    for (let index = 0; index < samples; index++) {
      const progress = index / (samples - 1);
      const sampleDistance = distance + progress * lookAhead;
      const from = this.coordinateAtDistance(
        sampleDistance - tangentHalfLength,
        this.bearingFromScratch,
      );
      const to = this.coordinateAtDistance(
        sampleDistance + tangentHalfLength,
        this.bearingToScratch,
      );
      if (this.distanceBetweenCoordinates(from, to) < 1) continue;
      const radians = (this.calculateBearing(from, to) * Math.PI) / 180;
      const weight = 1 - progress * 0.65;
      vectorX += Math.cos(radians) * weight;
      vectorY += Math.sin(radians) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0)
      return this.displayedCameraBearing ?? this.displayedHeading ?? 0;
    return ((Math.atan2(vectorY, vectorX) * 180) / Math.PI + 360) % 360;
  }

  private calculateBearing(start: LatLng, end: LatLng): number {
    const rad = (value: number) => (value * Math.PI) / 180;
    const startLat = rad(start[0]),
      endLat = rad(end[0]),
      delta = rad(end[1] - start[1]);
    const y = Math.sin(delta) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(delta);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  private smoothVehicleHeading(next: number, dt: number): number {
    if (this.displayedHeading === undefined) return (this.displayedHeading = next);
    const current = ((this.displayedHeading % 360) + 360) % 360;
    const delta = ((next - current + 540) % 360) - 180;
    const blend = 1 - Math.exp(-VEHICLE_HEADING_DAMPING * dt);
    return (this.displayedHeading += delta * blend);
  }

  private cameraParamsForSpeed(speedKph: number): {
    zoom: number;
    pitch: number;
    lookAhead: number;
  } {
    // Nav apps zoom out slightly and look further down the road at higher
    // speed, and sit closer/steeper when crawling or stopped.
    const t = Math.max(0, Math.min(speedKph / 100, 1));
    return {
      zoom: NAVIGATION_ZOOM - t * 1.2,
      pitch: NAVIGATION_PITCH - t * 6,
      lookAhead: 28 + t * 90,
    };
  }

  private cameraCenterAhead(lookAheadMetres: number): [number, number] {
    const point = this.coordinateAtDistance(
      this.displayedRoadDistance + lookAheadMetres,
      this.cameraPointScratch,
    );
    this.cameraCenterScratch[0] = point[1];
    this.cameraCenterScratch[1] = point[0];
    return this.cameraCenterScratch;
  }

  private startCameraLoop(): void {
    if (this.cameraFrame !== undefined || !this.map) return;
    this.zone.runOutsideAngular(() => {
      const step = (now: number) => {
        if (!this.map || !this.vehicleVisible) {
          this.stopCameraLoop();
          return;
        }
        const dt =
          this.lastCameraFrameTime !== undefined
            ? Math.min((now - this.lastCameraFrameTime) / 1000, 0.1)
            : 1 / 60;
        this.lastCameraFrameTime = now;
        this.applyMovementFrame(now, dt);
        // Keep the map camera on the same display-synchronised frame as the
        // vehicle. Throttling this independently makes the whole replay appear
        // to run at 24/30 fps even though the model itself updates at 60 fps.
        this.applyCameraFrame(dt);
        if (this.shouldContinueAnimation()) this.cameraFrame = requestAnimationFrame(step);
        else this.stopCameraLoop();
      };
      this.cameraSettledFor = 0;
      this.cameraFrame = requestAnimationFrame(step);
    });
  }

  private stopCameraLoop(): void {
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = undefined;
    this.lastCameraFrameTime = undefined;
  }

  private applyCameraFrame(dt: number): void {
    if (!this.map) return;
    this.displayedSpeedKph +=
      (this.targetSpeedKph - this.displayedSpeedKph) * Math.min(1, dt * SPEED_DAMPING);
    this.emitDisplayedSpeed();
    const {
      zoom: targetZoom,
      pitch: targetPitch,
      lookAhead,
    } = this.cameraParamsForSpeed(this.displayedSpeedKph);
    const targetHeading = this.cameraHeadingAtDistance(
      this.displayedRoadDistance,
      this.displayedSpeedKph,
    );

    // On first engagement, seed from the map's current camera so the
    // transition into nav mode eases smoothly instead of snapping.
    if (this.displayedCameraBearing === undefined)
      this.displayedCameraBearing = this.map.getBearing();
    if (this.displayedCameraZoom === undefined) this.displayedCameraZoom = this.map.getZoom();
    if (this.displayedCameraPitch === undefined) this.displayedCameraPitch = this.map.getPitch();

    const bearingT = 1 - Math.exp(-CAMERA_BEARING_DAMPING * dt);
    const current = ((this.displayedCameraBearing % 360) + 360) % 360;
    const delta = ((targetHeading - current + 540) % 360) - 180;
    // On a real turn, remove the straight-road dead zone so rotation begins
    // immediately. Cap angular velocity to prevent a sharp route tangent from
    // ever producing a visual snap.
    const deadZone = Math.abs(delta) > 15 ? 0 : CAMERA_BEARING_DEAD_ZONE;
    const bearingCorrection =
      Math.abs(delta) <= deadZone
        ? 0
        : delta - Math.sign(delta) * deadZone;
    const desiredRotation = bearingCorrection * bearingT;
    // Faster replay needs more angular headroom or the camera can fall behind
    // the vehicle. Square-root scaling keeps 1x gentle without making 5x snap.
    const maximumRotation =
      CAMERA_MAX_ROTATION_SPEED * Math.sqrt(this.playbackSpeed()) * dt;
    const appliedRotation = Math.max(
      -maximumRotation,
      Math.min(desiredRotation, maximumRotation),
    );
    this.displayedCameraBearing += appliedRotation;

    const framingT = 1 - Math.exp(-CAMERA_FRAMING_DAMPING * dt);
    this.displayedCameraZoom += (targetZoom - this.displayedCameraZoom) * framingT;
    this.displayedCameraPitch += (targetPitch - this.displayedCameraPitch) * framingT;

    const zoomChanged = Math.abs(targetZoom - this.displayedCameraZoom) > CAMERA_ZOOM_EPSILON;
    const pitchChanged = Math.abs(targetPitch - this.displayedCameraPitch) > CAMERA_PITCH_EPSILON;
    const cameraIsSettled = Math.abs(bearingCorrection) < 0.15 && !zoomChanged && !pitchChanged;
    this.cameraSettledFor = cameraIsSettled ? this.cameraSettledFor + dt : 0;

    const camera: maplibregl.JumpToOptions = {
      center: this.cameraCenterAhead(lookAhead),
    };
    // MapLibre treats every supplied camera property as an update. Leave
    // settled values out so high-refresh displays do less transform/event work
    // while the centre continues to move on every animation frame.
    const bearingDelta =
      ((this.displayedCameraBearing - this.map.getBearing() + 540) % 360) - 180;
    if (Math.abs(bearingDelta) >= 0.01) camera.bearing = this.displayedCameraBearing;
    if (Math.abs(this.displayedCameraPitch - this.map.getPitch()) >= 0.01)
      camera.pitch = this.displayedCameraPitch;
    if (Math.abs(this.displayedCameraZoom - this.map.getZoom()) >= 0.0005)
      camera.zoom = this.displayedCameraZoom;
    this.map.jumpTo(camera);
  }

  private emitDisplayedSpeed(): void {
    const speed = Math.max(0, Math.round(this.displayedSpeedKph));
    if (speed === this.lastEmittedSpeedKph) return;
    this.lastEmittedSpeedKph = speed;
    this.zone.run(() => this.displayedSpeedChange.emit(speed));
  }

  private applyMovementFrame(now: number, dt: number): void {
    if (!this.vehicleVisible) return;
    const progress = Math.max(
      0,
      Math.min((now - this.movementStartedAt) / this.movementDuration, 1),
    );
    // Linear interpolation in metres gives genuinely constant motion between
    // samples. It does not restart an acceleration curve at every GPS point.
    this.displayedRoadDistance =
      this.movementStartDistance +
      (this.targetRoadDistance - this.movementStartDistance) * progress;
    this.displayedRoadProgress = this.progressAtDistance(this.displayedRoadDistance);
    this.renderRouteLayersIfNeeded();
    const position = this.coordinateAtDistance(this.displayedRoadDistance, this.cameraPointScratch);
    const heading = this.smoothVehicleHeading(
      this.rawHeadingAtDistance(this.displayedRoadDistance),
      dt,
    );
    this.renderVehicleModel(position, heading);
    this.displayedPosition[0] = position[0];
    this.displayedPosition[1] = position[1];
    if (progress >= 1 && !this.movementFinished) {
      this.movementFinished = true;
      this.renderRouteLayersIfNeeded();
    }
  }

  private renderRouteLayersIfNeeded(force = false): void {
    const routeIndex = Math.max(0, Math.round(this.displayedRoadProgress));
    if (!force && routeIndex === this.lastRenderedRouteIndex) return;
    this.lastRenderedRouteIndex = routeIndex;
    this.renderRouteLayers();
  }

  private shouldContinueAnimation(): boolean {
    return (
      !this.movementFinished ||
      this.playbackActive() ||
      this.cameraSettledFor < CAMERA_SETTLE_SECONDS
    );
  }

  private cancelMovement(): void {
    this.movementStartDistance = this.displayedRoadDistance;
    this.targetRoadDistance = this.displayedRoadDistance;
    this.movementStartedAt = performance.now();
    this.movementFinished = true;
  }

  ngOnDestroy(): void {
    clearTimeout(this.readyFallback);
    clearTimeout(this.eventCardHideTimer);
    this.cancelMovement();
    this.stopCameraLoop();
    this.routeRequest?.abort();
    this.vehicleOverlay?.finalize();
    this.themeObserver?.disconnect();
    if (this.vehicleModelUrl) URL.revokeObjectURL(this.vehicleModelUrl);
    this.map?.remove();
  }

  private watchTheme(): void {
    this.themeObserver = new MutationObserver(() => {
      if (!this.map) return;
      // After setStyle({ diff: false }) the new style may not be fully settled
      // when 'style.load' fires, so use 'idle' which guarantees the map has
      // finished painting the new style and all sources are ready.
      this.map.once('idle', () => this.renderRouteLayers());
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
}
