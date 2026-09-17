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
  timezoneCenter,
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
const DEFAULT_MAP_CENTER: LatLng = timezoneCenter();
const DEFAULT_MAP_ZOOM = 5;
const NAVIGATION_PITCH = 52;
const NAVIGATION_ZOOM = 16.5;
const CAMERA_BEARING_DAMPING = 4.2;
const CAMERA_FRAMING_DAMPING = 2.4;
const SPEED_DAMPING = 2.5;
const VEHICLE_HEADING_DAMPING = 10;
const CAMERA_BEARING_DEAD_ZONE = 1.2;
const CAMERA_MAX_ROTATION_SPEED = 100;
const CAMERA_SETTLE_SECONDS = 1.25;
const CAMERA_ZOOM_EPSILON = 0.008;
const CAMERA_PITCH_EPSILON = 0.08;
const OSRM_REQUEST_TIMEOUT_MS = 10000;
const STOP_SPEED_KPH = 3;
const STOP_MIN_SAMPLES = 4;

// Trail-drawing tunables — ported from hypernym-fms-fe QE-demo-fixes
// google-map.component.ts + OsrmTrailUtils.ts (side-by-side verified trail).
const IDLE_DISTANCE_M = 8;
const IDLE_MIN_RUN = 3;
const LEG_GAP_SECONDS = 180;
const LEG_GAP_DISTANCE_M = 100;
const TELEPORT_MPS = 45;
// Moderate impossible transitions usually mean missed packets: retain the new
// point as a new leg. Only extreme excursions are treated as corrupt fixes.
// The 100 m floor matters: with sparse reporting (multi-day trails), a fast
// driven loop's consecutive fixes can imply > 45 m/s over 50–100 m — splitting
// those shatters a real loop into 2-point straight-chord fragments.
const TELEPORT_DROP_DISTANCE_M = 20_000;
const MATCH_CONFIDENCE_MIN = 0.1;
const MATCH_BATCH_SIZE = 100;
const MATCH_BATCH_OVERLAP = 3;
// Two-attempt matching: tight radius first, wider on retry (sparse road
// coverage in industrial/desert areas needs more room to find a mapped road).
const MATCH_RADIUS_M = 15;
const MATCH_RADIUS_WIDE_M = 30;
// Last-resort radius before the raw fallback — sparse industrial/desert road
// networks sometimes need this much room to anchor the leg onto a mapped road
// (legacy OsrmTrailUtils tunables used 60 m as the wide radius).
const MATCH_RADIUS_LAST_M = 60;
const DETOUR_RATIO_MAX = 1.35;
// A match must stay inside the raw GPS corridor: matched vertices that drift
// off the recorded fix polyline mean OSRM invented a shortcut/detour.
const MATCH_CORRIDOR_MAX_M = 45;
const MATCH_CORRIDOR_P95_M = 30;
const MATCH_CORRIDOR_OUTLIER_FRACTION = 0.08;

interface OsrmTrailPoint {
  lat: number;
  lng: number;
  _ts: number;
  speed: number;
  /** The point right after a preserved moderate jump — always starts a new leg. */
  _afterDrop?: boolean;
}
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
  private legEnds: Array<[OsrmTrailPoint, OsrmTrailPoint]> = [];
  // Chronological leg records [startTs, endTs, startIndex, endIndex] — used to
  // align raw GPS positions to their own leg's segment of the merged road
  // coordinates (which now interleaves the estimated gap trails between legs).
  private legTimeRanges: Array<[number, number, number, number]> = [];
  // OSRM /route bridges across leg gaps — drawn dashed, and interleaved into
  // the marker's coordinate stream so playback drives over the gaps too.
  private estimatedGapSegments: LatLng[][] = [];
  private roadSegmentRanges: Array<[number, number]> = [];
  private roadDistances: number[] = [];
  private lastVehicleIndex = -1;
  private positionRoadIndexes: number[] = [];
  private routeRequest?: AbortController;
  private readyFallback?: ReturnType<typeof setTimeout>;
  private readyEmitted = false;
  private routeVersion = 0;
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
      this.estimatedGapSegments = [];
      this.legTimeRanges = [];
      this.roadSegmentRanges = [];
      this.roadDistances = [];
      this.positionRoadIndexes = [];
      if (this.map.isStyleLoaded())
        removeGeoJson(this.map, 'trip-route', [
          'trip-route-bg',
          'trip-route-line',
          'trip-route-completed',
          'trip-route-estimated',
        ]);
      this.map.jumpTo({
        center: [DEFAULT_MAP_CENTER[1], DEFAULT_MAP_CENTER[0]],
        zoom: DEFAULT_MAP_ZOOM,
      });
      return;
    }
    const version = ++this.routeVersion;
    this.roadSegments = [];
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
    // Solid trail segments are the matched legs; the interleaved gap bridges
    // live between them in `roadCoordinates` but are never drawn solid. Ranges
    // come from the recorded leg indices because cumulative segment lengths no
    // longer line up once gap geometry sits between legs.
    this.roadSegmentRanges = this.legTimeRanges.map(([, , start, end]) => [
      start,
      end,
    ] as [number, number]);
    if (!this.roadSegmentRanges.length) this.roadSegmentRanges = [[0, coordinates.length - 1]];
    this.roadDistances = this.buildRoadDistances(coordinates);
    this.positionRoadIndexes = this.mapPositionsToRoad(positions, coordinates);
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
      // Distance-based placement (not the nearest-road-vertex lookup): the
      // timeline dot and the vehicle marker both use index-proportional
      // distance, so the map dot must use the same mapping or the three
      // markers land at different spots along the trail.
      const point = this.coordinateAtDistance(
        this.targetDistanceForIndex(event.positionIndex, positions.length),
      );
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
    const features: GeoJSON.Feature[] = [];
    for (const [segmentStart, segmentEnd] of this.roadSegmentRanges) {
      const points = this.roadCoordinates.slice(segmentStart, segmentEnd + 1);
      if (points.length >= 2) features.push(lineFeature(points, { kind: 'route' }));
    }
    if (completedIndex > 0) {
      for (const [segmentStart, segmentEnd] of this.roadSegmentRanges) {
        const from = Math.max(segmentStart, 0);
        const to = Math.min(segmentEnd, completedIndex);
        if (to <= from) continue;
        const points = this.roadCoordinates.slice(from, to + 1);
        if (points.length >= 2) features.push(lineFeature(points, { kind: 'completed' }));
      }
    }
    // Estimated gap bridges (OSRM /route across leg silences) — dashed, never
    // solid, so a user can tell recorded movement from an estimate at a glance.
    for (const segment of this.estimatedGapSegments) {
      if (segment.length >= 2) features.push(lineFeature(segment, { kind: 'estimated' }));
    }
    const routeColor = document.documentElement.classList.contains('dark')
      ? '#c4b5fd'
      : '#8b19f5';
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    const source = this.map.getSource('trip-route') as maplibregl.GeoJSONSource | undefined;
    const layerIds = [
      'trip-route-bg',
      'trip-route-line',
      'trip-route-completed',
      'trip-route-estimated',
    ];
    if (source && layerIds.every((id) => this.map?.getLayer(id))) {
      source.setData(data);
      return;
    }
    upsertGeoJson(this.map, 'trip-route', data, [
      {
        id: 'trip-route-bg',
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
        id: 'trip-route-estimated',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'estimated'],
        paint: {
          // Same colour as the main trail — the dash pattern alone separates
          // estimated from recorded segments.
          'line-color': routeColor,
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [1.2, 1.6],
        },
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
      },
    ]);
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
    // Raw fallback never includes (0,0) device defaults or unparseable coords —
    // it must match what the OSRM path is allowed to draw (B4).
    const fallback = positions
      .map(({ lat, lng }) => [Number(lat), Number(lng)] as LatLng)
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0));
    this.routeRequest?.abort();
    // Capture the run's controller: batches attach to THIS signal so a
    // superseding render's controller can never strand an old-run batch (B9).
    const run = new AbortController();
    this.routeRequest = run;
    try {
      const legs = this.buildMatchLegs(positions);
      const segments: LatLng[][] = [];
      this.estimatedGapSegments = [];
      this.legEnds = [];
      this.legTimeRanges = [];
      const merged: LatLng[] = [];
      for (const leg of legs) {
        const segment = await this.matchLegToRoad(leg, run.signal);
        if (!segment.length) continue;
        if (this.legEnds.length) {
          // Gap estimation between legs: EVERY gap is bridged with the OSRM
          // /route road path, rendered as a DASHED estimate. The bridge is
          // also spliced into the marker coordinate stream between the two
          // legs so playback drives over the gap instead of teleporting.
          const estimated = await this.estimateGap(
            this.legEnds.at(-1)![1],
            leg[0],
            run.signal,
          );
          if (estimated.length >= 2) {
            this.estimatedGapSegments.push(estimated);
            this.appendGeometry(merged, estimated);
          }
        }
        const segmentStart = merged.length;
        segments.push(this.trimSeam(segments.at(-1), segment));
        const appended = segments.at(-1)!;
        for (const point of appended) this.appendGeometry(merged, [point]);
        this.legTimeRanges.push([
          leg[0]._ts,
          leg.at(-1)!._ts,
          segmentStart,
          merged.length - 1,
        ]);
        this.legEnds.push([leg[0], leg.at(-1)!]);
      }
      if (!merged.length) {
        this.roadSegments = [fallback];
        return fallback;
      }
      this.roadSegments = segments;
      return merged;
    } catch {
      // Fallback road has no leg ranges — stale ones would misplace the solid
      // segment ranges, so drop them with the rest of the run's state.
      this.legTimeRanges = [];
      if (!run.signal.aborted) this.roadSegments = [fallback];
      return fallback;
    }
  }

  // Trims leading vertices of an incoming run of coordinates that duplicate the
  // previous run's tail (batch/leg/route seams), so no road stretch is doubled.
  private trimSeam(previous: LatLng[] | undefined, incoming: LatLng[]): LatLng[] {
    if (!previous?.length || incoming.length < 2) return incoming;
    const trimmed = incoming.slice();
    while (
      trimmed.length > 1 &&
      previous.length > 1 &&
      this.distanceBetweenCoordinates(previous.at(-1)!, trimmed[0]) < 12
    )
      trimmed.shift();
    return trimmed;
  }

  // Gap classification: the fixes are always chronological, so ANY gap between
  // two consecutive legs — close or far, regardless of implied speed — is
  // bridged with the OSRM /route road path (the shortest drivable connection
  // between the two points). Never a straight line, never a hole. Only a
  // degenerate zero-length gap skips the request.
  private async estimateGap(
    from: OsrmTrailPoint,
    to: OsrmTrailPoint,
    runSignal: AbortSignal | undefined,
  ): Promise<LatLng[]> {
    if (this.haversine(from.lat, from.lng, to.lat, to.lng) < 1) return [];
    if ((to._ts - from._ts) / 1000 <= 0) return [];
    return (await this.sendSnapToRoadRequestRoute(from, to, runSignal)) ?? [];
  }

  // Cleans + segments the raw fix stream into independent legs before OSRM
  // /match — port of QE-demo-fixes buildMatchLegs(). Fixes the "phantom loop
  // while parked" issue:
  //   1. Teleport handling: moderate impossible jumps are missed packets, not
  //      corruption — the point is kept and starts a NEW leg (never bridged by
  //      a match OR raw fallback). Only > TELEPORT_DROP_DISTANCE_M excursions
  //      are dropped as corrupt.
  //   2. Stationary GPS jitter (parked drift of a few metres) collapses to ONE
  //      representative point, so /match never picks between two adjacent
  //      parking lanes for a vehicle that never moved.
  //   3. Legs split on real silences (> 180 s AND > 100 m), or right after a
  //      dropped teleport fix.
  private buildMatchLegs(positions: TripPosition[]): OsrmTrailPoint[][] {
    const parsed: OsrmTrailPoint[] = [];
    for (const p of positions) {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      const ts = p.timestamp ? new Date(p.timestamp).getTime() : NaN;
      // Invalid coords (incl. (0,0) device defaults) and points without a
      // parseable timestamp never enter the pipeline.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      if (!Number.isFinite(ts)) continue;
      // Exact duplicate fixes (QE-demo-fixes createSnapToRoad dedupe) would
      // skew /match's timestamp interpolation.
      const prev = parsed.at(-1);
      if (prev && prev.lat === lat && prev.lng === lng && prev._ts === ts) continue;
      parsed.push({ lat, lng, _ts: ts, speed: Number(p.speed) || 0 });
    }
    parsed.sort((a, b) => a._ts - b._ts);

    // 1. Teleport handling. The point surviving right after a drop gets
    //    flagged — we don't know the vehicle's real path across a corrupted
    //    fix, so it must start a new leg rather than being bridged.
    const cleaned: OsrmTrailPoint[] = [];
    let breakBeforeNextAcceptedPoint = false;
    for (const point of parsed) {
      const prev = cleaned.at(-1);
      if (prev) {
        const dt = (point._ts - prev._ts) / 1000;
        const dist = this.haversine(prev.lat, prev.lng, point.lat, point.lng);
        const impliedSpeed = dt > 0 ? dist / dt : 0;
        if (impliedSpeed > TELEPORT_MPS && dist > 100) {
          // A kilometre-scale jump followed by coherent fixes is normally
          // missing packets, not bad new positions — keep it as the start of
          // an independent leg.
          if (dist <= TELEPORT_DROP_DISTANCE_M) {
            point._afterDrop = true;
            breakBeforeNextAcceptedPoint = false;
            cleaned.push(point);
            continue;
          }
          breakBeforeNextAcceptedPoint = true;
          continue;
        }
      }
      if (breakBeforeNextAcceptedPoint) {
        point._afterDrop = true;
        breakBeforeNextAcceptedPoint = false;
      }
      cleaned.push(point);
    }

    // 2. Collapse stationary jitter runs into a single representative point
    //    (the run anchor). Runs never cross an _afterDrop leg boundary.
    const collapsed: OsrmTrailPoint[] = [];
    let i = 0;
    while (i < cleaned.length) {
      let j = i;
      while (
        j + 1 < cleaned.length &&
        !cleaned[j + 1]._afterDrop &&
        this.haversine(cleaned[i].lat, cleaned[i].lng, cleaned[j + 1].lat, cleaned[j + 1].lng) <
          IDLE_DISTANCE_M
      )
        j++;
      if (j - i + 1 >= IDLE_MIN_RUN) collapsed.push(cleaned[i]);
      else for (let k = i; k <= j; k++) collapsed.push(cleaned[k]);
      i = j + 1;
    }

    // 3. Split into legs on real time gaps or right after a dropped teleport
    //    fix — OSRM (and the raw fallback) must never bridge either break.
    const legs: OsrmTrailPoint[][] = [];
    let leg: OsrmTrailPoint[] = [];
    for (const point of collapsed) {
      const previous = leg.at(-1);
      const gapBreak =
        previous &&
        (point._ts - previous._ts) / 1000 > LEG_GAP_SECONDS &&
        this.haversine(previous.lat, previous.lng, point.lat, point.lng) > LEG_GAP_DISTANCE_M;
      if (leg.length && (gapBreak || point._afterDrop)) {
        if (leg.length > 1) legs.push(leg);
        leg = [];
      }
      leg.push(point);
    }
    if (leg.length > 1) legs.push(leg);
    return legs;
  }

  // Appends matched geometry to a running coordinate list, collapsing
  // consecutive points that are effectively on top of each other (this quietly
  // absorbs batch-overlap seams, as in QE-demo-fixes appendGeometry).
  private appendGeometry(target: LatLng[], coords: LatLng[]): void {
    for (const point of coords) {
      const last = target.at(-1);
      if (!last || this.distanceBetweenCoordinates(last, point) > 1) target.push(point);
    }
  }

  // Max distance from any matched vertex to the raw fix polyline (QE-demo-fixes
  // matchFollowsRawTrail). A match that leaves the recorded GPS corridor is a
  // shortcut/detour invented by the matcher — collapse-loop or parallel-road —
  // and must fall back to raw.
  private pointToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
    const radius = 6_371_000;
    const refLat = ((p[0] + a[0] + b[0]) / 3) * (Math.PI / 180);
    const project = (q: LatLng) => ({
      x: q[1] * (Math.PI / 180) * Math.cos(refLat) * radius,
      y: q[0] * (Math.PI / 180) * radius,
    });
    const pp = project(p);
    const aa = project(a);
    const bb = project(b);
    const vx = bb.x - aa.x;
    const vy = bb.y - aa.y;
    const wx = pp.x - aa.x;
    const wy = pp.y - aa.y;
    const vv = vx * vx + vy * vy;
    if (vv === 0) return Math.sqrt(wx * wx + wy * wy);
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv));
    const dx = pp.x - (aa.x + t * vx);
    const dy = pp.y - (aa.y + t * vy);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private distanceToRawPolylineMeters(point: LatLng, raw: LatLng[]): number {
    if (!raw.length) return Number.POSITIVE_INFINITY;
    if (raw.length === 1) return this.distanceBetweenCoordinates(point, raw[0]);
    let best = Number.POSITIVE_INFINITY;
    for (let i = 1; i < raw.length; i++)
      best = Math.min(best, this.pointToSegmentMeters(point, raw[i - 1], raw[i]));
    return best;
  }

  private matchFollowsRawTrail(geometry: LatLng[], raw: LatLng[]): boolean {
    if (geometry.length < 2 || raw.length < 2) return false;
    const maxSamples = 250;
    const step = Math.max(1, Math.floor(geometry.length / maxSamples));
    const distances: number[] = [];
    for (let i = 0; i < geometry.length; i += step)
      distances.push(this.distanceToRawPolylineMeters(geometry[i], raw));
    if ((geometry.length - 1) % step !== 0)
      distances.push(this.distanceToRawPolylineMeters(geometry.at(-1)!, raw));
    const sorted = distances.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const maxDistance = sorted.at(-1)!;
    const outlierFraction =
      distances.filter((d) => d > MATCH_CORRIDOR_P95_M).length / distances.length;
    return !(
      maxDistance > MATCH_CORRIDOR_MAX_M ||
      p95 > MATCH_CORRIDOR_P95_M ||
      outlierFraction > MATCH_CORRIDOR_OUTLIER_FRACTION
    );
  }

  // Matches a single leg: tight radius first, then a wider radius (sparse road
  // coverage often just needs more room to find the nearest mapped road), and
  // only falls back to the leg's own raw points as a last resort.
  private async matchLegToRoad(
    leg: OsrmTrailPoint[],
    runSignal: AbortSignal | undefined,
  ): Promise<LatLng[]> {
    const geometry =
      (await this.attemptMatch(leg, MATCH_RADIUS_M, runSignal)) ??
      (await this.attemptMatch(leg, MATCH_RADIUS_WIDE_M, runSignal)) ??
      (await this.attemptMatch(leg, MATCH_RADIUS_LAST_M, runSignal));
    return geometry ?? leg.map((p) => [p.lat, p.lng] as LatLng);
  }

  // Runs OSRM /match over a leg's batches at a uniform radius. Returns null if
  // nothing acceptable came back (confidence, detour ratio, or raw-corridor
  // violation) so the caller can retry wider or fall back to raw.
  private async attemptMatch(
    leg: OsrmTrailPoint[],
    radiusM: number,
    runSignal: AbortSignal | undefined,
  ): Promise<LatLng[] | null> {
    const batches = this.buildBatches(leg, MATCH_BATCH_SIZE, MATCH_BATCH_OVERLAP);
    const geometry: LatLng[] = [];
    let matchedAnything = false;
    for (const batch of batches) {
      const result = await this.sendSnapToRoadRequestMatch(batch, radiusM, runSignal);
      if (!result) continue;
      matchedAnything = true;
      this.appendGeometry(geometry, result);
    }
    if (!matchedAnything || geometry.length < 2) return null;
    // Reject a "confidently wrong" match: real road geometry for a moving leg
    // tracks close to the raw distance covered. A jog onto a parallel road
    // inflates matched length well past that.
    const rawLength = this.pathDistance(leg.map((p) => [p.lat, p.lng] as LatLng));
    const matchedLength = this.pathDistance(geometry);
    if (rawLength > 0 && matchedLength / rawLength > DETOUR_RATIO_MAX) return null;
    const rawGeometry = leg.map((p) => [p.lat, p.lng] as LatLng);
    if (!this.matchFollowsRawTrail(geometry, rawGeometry)) return null;
    // /match can omit tracepoints at a leg boundary. Restoring only nearby raw
    // endpoints closes those artificial visual cuts without accepting a detour.
    const firstRaw = rawGeometry[0];
    const lastRaw = rawGeometry.at(-1)!;
    if (this.distanceBetweenCoordinates(firstRaw, geometry[0]) <= LEG_GAP_DISTANCE_M)
      geometry.unshift(firstRaw);
    if (this.distanceBetweenCoordinates(lastRaw, geometry.at(-1)!) <= LEG_GAP_DISTANCE_M)
      geometry.push(lastRaw);
    return geometry;
  }

  private buildBatches(
    points: OsrmTrailPoint[],
    size: number,
    overlap: number,
  ): OsrmTrailPoint[][] {
    const batches: OsrmTrailPoint[][] = [];
    for (let i = 0; i < points.length; i += size - overlap) {
      const end = Math.min(i + size, points.length);
      if (end - i < 2) {
        // A trailing 1-point remainder would match nothing and be appended as a
        // stray raw vertex — fold it into the previous batch instead (B2).
        if (batches.length) batches.at(-1)!.push(points[i]);
        else batches.push(points.slice(i, end));
        break;
      }
      batches.push(points.slice(i, end));
    }
    return batches;
  }

  private async sendSnapToRoadRequestMatch(
    points: OsrmTrailPoint[],
    radiusM: number,
    runSignal: AbortSignal | undefined,
  ): Promise<LatLng[] | null> {
    if (points.length < 2) return null;
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const timestamps = points.map((p) => Math.floor(p._ts / 1000)).join(';');
    // Uniform radius across the whole attempt — per-point speed-based radiuses
    // let slow pickup-loop points snap 60 m onto a nearby main road.
    const radiuses = points.map(() => radiusM).join(';');
    const url =
      `${environment.osrmBaseUrl}/match/v1/driving/${coords}` +
      `?timestamps=${timestamps}&radiuses=${radiuses}&overview=full&geometries=geojson&gaps=split&tidy=true`;
    return this.osrmGeometryRequest<{
      code?: string;
      matchings?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
        confidence?: number;
      }>;
    }>(url, runSignal, (result) => {
      if (result.code !== 'Ok') return null;
      const merged: LatLng[] = [];
      for (const matching of result.matchings ?? []) {
        const confidence = matching.confidence ?? 0;
        if (confidence < MATCH_CONFIDENCE_MIN) continue;
        const coords = (matching.geometry?.coordinates ?? []).map(
          ([lng, lat]) => [lat, lng] as LatLng,
        );
        if (coords.length < 2) continue;
        this.appendGeometry(merged, coords);
      }
      if (merged.length < 2) return null;
      return merged;
    });
  }

  // Bridges a gap between two legs with the actual road path from the OSRM
  // /route service. No speed/detour rejection: the fixes are chronological, so
  // whatever drivable path OSRM returns IS the estimate.
  private async sendSnapToRoadRequestRoute(
    from: OsrmTrailPoint,
    to: OsrmTrailPoint,
    runSignal: AbortSignal | undefined,
  ): Promise<LatLng[] | null> {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url =
      `${environment.osrmBaseUrl}/route/v1/driving/${coords}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    return this.osrmGeometryRequest<{
      code?: string;
      routes?: Array<{
        distance?: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    }>(url, runSignal, (result) => {
      if (result.code !== 'Ok') return null;
      const route = result.routes?.[0];
      const routeCoords = (route?.geometry?.coordinates ?? []).map(
        ([lng, lat]) => [lat, lng] as LatLng,
      );
      if (routeCoords.length < 2) return null;
      const routeDistance = route?.distance ?? 0;
      if (!Number.isFinite(routeDistance) || routeDistance <= 0) return null;
      return routeCoords;
    });
  }

  // Shared OSRM plumbing: fetch with timeout + run-signal propagation, JSON
  // parse, and delegate validation/extraction to the caller's extractor.
  private async osrmGeometryRequest<T>(
    url: string,
    runSignal: AbortSignal | undefined,
    extract: (result: T) => LatLng[] | null,
  ): Promise<LatLng[] | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OSRM_REQUEST_TIMEOUT_MS);
      runSignal?.addEventListener('abort', () => controller.abort(), { once: true });
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) return null;
      return extract((await response.json()) as T);
    } catch {
      return null;
    }
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radians = (v: number) => (v * Math.PI) / 180;
    const dLat = radians(lat2 - lat1);
    const dLng = radians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
    return 12_742_000 * Math.asin(Math.sqrt(a));
  }

  private pathDistance(points: LatLng[]): number {
    let distance = 0;
    for (let index = 1; index < points.length; index++)
      distance += this.distanceBetweenCoordinates(points[index - 1], points[index]);
    return distance;
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

  private updateVehicle(index: number): void {
    if (
      !this.map ||
      !this.vehicleOverlay ||
      !this.roadCoordinates.length ||
      !this.positions().length
    )
      return;
    const positions = this.positions();
    // Distance along the matched road trail, proportional to playback progress.
    // Sparse GPS spanning a long road segment still moves the marker steadily
    // because interpolation happens along the drawn geometry, not raw samples.
    const clampedIndex = Math.max(0, Math.min(index, positions.length - 1));
    const targetDistance = this.targetDistanceForIndex(clampedIndex, positions.length);
    const position = this.coordinateAtDistance(targetDistance);
    const heading = this.rawHeadingAtDistance(targetDistance);
    this.targetSpeedKph = positions[clampedIndex]?.speed ?? this.targetSpeedKph;
    // Forward playback must never walk the marker backwards: residual
    // geometry back-steps hold the marker in place instead of retracing.
    // Backward steps only occur on an explicit seek, which teleports straight
    // to the target.
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

  // Maps a raw position index to metres travelled along the road trail,
  // in proportion to playback progress (index / total). During a genuine
  // stationary run the marker is held at the run's starting distance instead
  // of gliding forward, matching real-world behaviour.
  private targetDistanceForIndex(index: number, count: number): number {
    const last = count - 1;
    const lastDistance = this.roadDistances.at(-1) ?? 0;
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
