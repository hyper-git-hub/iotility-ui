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

const OSRM_BASE_URL = 'https://fms.backend.iot.vodafone.com.qa:5000';
const VEHICLE_MODEL_PATHS = [
  '/assets/fleetpoint/models-trip-vehicle.glb',
  '/assets/models-trip-vehicle.glb',
];
const VEHICLE_MODEL_YAW_OFFSET = 180;
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

@Component({
  selector: 'app-trip-replay-map',
  templateUrl: './trip-replay-map.html',
  styleUrl: './trip-replay-map.css',
})
export class TripReplayMap implements AfterViewInit, OnDestroy {
  readonly positions = input.required<TripPosition[]>();
  readonly events = input<TripReplayEvent[]>([]);
  readonly positionIndex = input(0);
  readonly playbackActive = input(false);
  readonly playbackSpeed = input(1);
  readonly playbackStepDuration = input(260);
  readonly eventSelected = output<TripReplayEvent>();
  readonly routeLoadingChange = output<boolean>();
  readonly ready = output<void>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: MapLibreMap;
  private vehicleOverlay?: MapboxOverlay;
  private vehicleModelUrl?: string;
  private vehicleModelRequest?: Promise<void>;
  private pendingVehicle?: { position: LatLng; heading: number };
  private vehicleVisible = false;
  private endpointMarkers: maplibregl.Marker[] = [];
  private eventMarkers: maplibregl.Marker[] = [];
  private roadCoordinates: LatLng[] = [];
  private roadDistances: number[] = [];
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
  private displayedRoadDistance = 0;
  private displayedHeading?: number;
  private displayedCameraBearing?: number;
  private displayedCameraZoom?: number;
  private displayedCameraPitch?: number;
  private displayedRoadProgress = 0;
  private displayedSpeedKph = 0;
  private targetSpeedKph = 0;
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
  }

  ngAfterViewInit(): void {
    this.map = createIotMap(this.mapElement().nativeElement, [25.3548, 51.1839], 9);
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

  private async renderRoute(positions: TripPosition[], events: TripReplayEvent[]): Promise<void> {
    if (!this.map) return;
    if (!positions.length) {
      this.routeVersion++;
      this.routeRequest?.abort();
      this.routeLoadingChange.emit(false);
      this.clearMarkers();
      this.roadCoordinates = [];
      this.roadDistances = [];
      this.positionRoadIndexes = [];
      if (this.map.isStyleLoaded())
        removeGeoJson(this.map, 'trip-route', [
          'trip-route-casing',
          'trip-route-line',
          'trip-route-completed',
          'trip-route-recent',
        ]);
      this.map.jumpTo({ center: [51.1839, 25.3548], zoom: 9 });
      return;
    }
    const version = ++this.routeVersion;
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
    this.roadDistances = this.buildRoadDistances(coordinates);
    this.positionRoadIndexes = this.mapPositionsToRoad(positions, coordinates);
    this.displayedHeading = undefined;
    this.displayedRoadDistance = 0;
    this.targetRoadDistance = 0;
    this.displayedRoadProgress = 0;
    this.lastRenderedRouteIndex = -1;
    this.renderRouteLayers();
    const colors = getComputedStyle(document.documentElement);
    const css = (name: string, fallback: string) =>
      colors.getPropertyValue(name).trim() || fallback;
    this.endpointMarkers = [
      this.circleMarker(coordinates[0], css('--color-success', '#20a77d'), 'Trip start'),
      this.circleMarker(coordinates.at(-1)!, css('--color-danger', '#df405e'), 'Trip end'),
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
      const glyph = event.type === 'violation' ? '!' : event.type === 'dashcam' ? '●' : '■';
      const element = markerElement(
        `<span aria-hidden="true" style="display:grid;place-items:center;width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:${color};color:#fff;font:700 10px/1 sans-serif;box-shadow:0 2px 7px #18223855">${glyph}</span>`,
      );
      element.setAttribute('aria-label', `${event.label}: ${event.detail}`);
      element.setAttribute('title', `${event.label} · ${event.detail}`);
      element.setAttribute('role', 'button');
      element.tabIndex = 0;
      element.addEventListener('click', () => this.eventSelected.emit(event));
      element.addEventListener('keydown', (keyboardEvent) => {
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ')
          this.eventSelected.emit(event);
      });
      this.eventMarkers.push(
        new maplibregl.Marker({ element })
          .setLngLat([point[1], point[0]])
          .setPopup(popup(`${event.label} · ${event.detail}`))
          .addTo(this.map),
      );
    }
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
    const features = [lineFeature(this.roadCoordinates, { kind: 'route' })];
    if (completedIndex > 0)
      features.push(
        lineFeature(this.roadCoordinates.slice(0, completedIndex + 1), { kind: 'completed' }),
      );
    if (completedIndex > recentStart)
      features.push(
        ...this.buildFadedTrailFeatures(
          this.roadCoordinates.slice(recentStart, completedIndex + 1),
        ),
      );
    const brand =
      getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() ||
      '#7435e8';
    const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    const source = this.map.getSource('trip-route') as maplibregl.GeoJSONSource | undefined;
    const layerIds = [
      'trip-route-casing',
      'trip-route-line',
      'trip-route-completed',
      'trip-route-recent',
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
        paint: { 'line-color': brand, 'line-width': 10, 'line-opacity': 0.14 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-line',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'route'],
        paint: { 'line-color': brand, 'line-width': 4, 'line-opacity': 0.34 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-completed',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'completed'],
        paint: { 'line-color': brand, 'line-width': 4.5, 'line-opacity': 0.72 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        // 'fade' is a per-feature property (0..1) so the trail reads as a soft
        // gradient tapering to nothing, rather than one flat-opacity band.
        id: 'trip-route-recent',
        type: 'line',
        filter: ['==', ['get', 'kind'], 'recent'],
        paint: { 'line-color': brand, 'line-width': 5.5, 'line-opacity': ['get', 'fade'] },
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

  private circleMarker(point: LatLng, color: string, label: string): maplibregl.Marker {
    const element = markerElement(
      `<span aria-hidden="true" style="display:block;width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 2px 7px #18223855"></span>`,
    );
    element.setAttribute('aria-label', label);
    element.setAttribute('title', label);
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
    this.movementFinished = true;
    this.cameraSettledFor = 0;
    this.lastRenderedRouteIndex = -1;
    this.vehicleOverlay?.setProps({ layers: [] });
    this.endpointMarkers.forEach((item) => item.remove());
    this.eventMarkers.forEach((item) => item.remove());
    this.endpointMarkers = [];
    this.eventMarkers = [];
  }

  private async getRoadCoordinates(positions: TripPosition[]): Promise<LatLng[]> {
    const cleanedPositions = this.removeGpsSpikes(positions);
    const fallback = cleanedPositions.map(({ lat, lng }) => [lat, lng] as LatLng);
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    try {
      const matched: LatLng[] = [];
      for (const chunk of this.positionChunks(cleanedPositions, 95)) {
        const coordinates = chunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
        const timestamps = chunk
          .map((point, index) => {
            const parsed = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
            return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : index;
          })
          .join(';');
        const response = await fetch(
          `${OSRM_BASE_URL}/match/v1/driving/${coordinates}?timestamps=${timestamps}&radiuses=${chunk.map(() => '50').join(';')}&overview=full&geometries=geojson`,
          { signal: this.routeRequest.signal },
        );
        if (!response.ok) throw new Error();
        const result = (await response.json()) as {
          code?: string;
          matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
        };
        const values =
          result.code === 'Ok'
            ? result.matchings?.flatMap((item) => item.geometry?.coordinates ?? [])
            : [];
        if (!values?.length) throw new Error();
        matched.push(...values.map(([lng, lat]) => [lat, lng] as LatLng));
      }
      return this.dedupeCoordinates(matched);
    } catch {
      if (this.routeRequest.signal.aborted) return fallback;
      try {
        return await this.getOsrmRoute(cleanedPositions);
      } catch {
        return fallback;
      }
    }
  }

  private async getOsrmRoute(positions: TripPosition[]): Promise<LatLng[]> {
    const routed: LatLng[] = [];
    for (const chunk of this.positionChunks(positions, 95)) {
      const coordinates = chunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
      const response = await fetch(
        `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
        { signal: this.routeRequest?.signal },
      );
      if (!response.ok) throw new Error();
      const result = (await response.json()) as {
        routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
      };
      const route = result.routes?.[0]?.geometry?.coordinates;
      if (!route?.length) throw new Error();
      routed.push(...route.map(([lng, lat]) => [lat, lng] as LatLng));
    }
    return this.dedupeCoordinates(routed);
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
        index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
    );
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
    const roadIndex = this.routeIndex(index, positions.length);
    const position = this.roadCoordinates[roadIndex];
    const targetDistance = this.roadDistances[roadIndex] ?? 0;
    const heading = this.rawHeadingAtDistance(targetDistance);
    const clampedIndex = Math.max(0, Math.min(index, positions.length - 1));
    this.targetSpeedKph = positions[clampedIndex]?.speed ?? this.targetSpeedKph;
    if (this.vehicleVisible) {
      if (this.playbackActive()) this.animateVehicleTo(targetDistance);
      else {
        this.cancelMovement();
        this.targetRoadDistance = targetDistance;
        this.displayedRoadDistance = targetDistance;
        this.movementStartDistance = targetDistance;
        this.movementStartedAt = performance.now();
        this.displayedRoadProgress = roadIndex;
        this.displayedHeading = heading;
        this.renderVehicleModel(position, heading);
        this.renderRouteLayersIfNeeded(true);
        this.startCameraLoop();
      }
    } else {
      this.vehicleVisible = true;
      this.targetRoadDistance = targetDistance;
      this.displayedRoadDistance = targetDistance;
      this.movementStartDistance = targetDistance;
      this.movementStartedAt = performance.now();
      this.displayedRoadProgress = roadIndex;
      this.displayedHeading = heading;
      this.displayedSpeedKph = this.targetSpeedKph;
      this.renderVehicleModel(position, heading);
      this.renderRouteLayersIfNeeded(true);
      this.startCameraLoop();
    }
  }

  private animateVehicleTo(targetDistance: number): void {
    if (!this.map || !this.vehicleOverlay || !this.vehicleVisible) return;
    this.movementStartDistance = this.displayedRoadDistance;
    this.targetRoadDistance = targetDistance;
    this.movementStartedAt = performance.now();
    this.movementDuration = Math.max(40, this.playbackStepDuration() / this.playbackSpeed());
    this.movementFinished = false;
    this.cameraSettledFor = 0;
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
    const position = this.coordinateAtDistance(this.displayedRoadDistance, this.cameraPointScratch);
    const heading = this.smoothVehicleHeading(
      this.rawHeadingAtDistance(this.displayedRoadDistance),
      dt,
    );
    this.renderVehicleModel(position, heading);
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
    this.cancelMovement();
    this.stopCameraLoop();
    this.routeRequest?.abort();
    this.vehicleOverlay?.finalize();
    if (this.vehicleModelUrl) URL.revokeObjectURL(this.vehicleModelUrl);
    this.map?.remove();
  }
}
