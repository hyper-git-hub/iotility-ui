import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild,
} from '@angular/core';
import { AmbientLight, DirectionalLight, LightingEffect } from '@deck.gl/core';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import {
  LatLng, createIotMap, fitLatLngs, lineFeature, markerElement, popup,
  removeGeoJson, upsertGeoJson,
} from '../maps/maplibre';

const OSRM_BASE_URL = 'https://fms.backend.iot.vodafone.com.qa:5000';
const VEHICLE_MODEL_PATHS = [
  '/assets/fleetpoint/models-trip-vehicle.glb',
  '/assets/models-trip-vehicle.glb',
];
const VEHICLE_MODEL_YAW_OFFSET = 180;
const VEHICLE_LIGHTING = new LightingEffect({
  ambientLight: new AmbientLight({ color: [255, 255, 255], intensity: 2.2 }),
  directionalLight: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 1.1,
    direction: [-3, -8, -5],
  }),
});
interface VehicleModelState {
  position: [longitude: number, latitude: number, altitude: number];
  heading: number;
}
export interface TripPosition {
  lat: number; lng: number; speed: number; heading: number; time: string;
  timestamp?: string; location?: string; driver?: string;
}
export interface TripReplayEvent {
  id: string; label: string; type: 'violation' | 'dashcam' | 'stop';
  positionIndex: number; detail: string;
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
  private routeRequest?: AbortController;
  private routeVersion = 0;
  private playbackZoomApplied = false;
  private movementFrame?: number;
  private displayedHeading?: number;
  private displayedRoadProgress = 0;

  constructor() {
    effect(() => {
      const positions = this.positions(), events = this.events();
      if (this.map) void this.renderRoute(positions, events);
    });
    effect(() => {
      const index = this.positionIndex();
      if (this.map) this.updateVehicle(index);
    });
    effect(() => {
      if (this.playbackActive() && this.map && !this.playbackZoomApplied) {
        this.playbackZoomApplied = true;
        this.map.easeTo({ zoom: Math.min(this.map.getZoom() + 1, 16), duration: 450 });
      }
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
    this.map.once('load', () => void this.renderRoute(this.positions(), this.events()));
  }

  private async renderRoute(positions: TripPosition[], events: TripReplayEvent[]): Promise<void> {
    if (!this.map) return;
    if (!positions.length) {
      this.routeVersion++;
      this.routeRequest?.abort();
      this.routeLoadingChange.emit(false);
      this.clearMarkers();
      this.roadCoordinates = [];
      if (this.map.isStyleLoaded())
        removeGeoJson(this.map, 'trip-route', ['trip-route-casing', 'trip-route-line', 'trip-route-completed']);
      this.map.jumpTo({ center: [51.1839, 25.3548], zoom: 9 });
      return;
    }
    const version = ++this.routeVersion;
    this.routeLoadingChange.emit(true);
    let coordinates: LatLng[];
    try { coordinates = await this.getRoadCoordinates(positions); }
    finally { if (version === this.routeVersion) this.routeLoadingChange.emit(false); }
    if (!this.map || version !== this.routeVersion) return;
    this.clearMarkers();
    this.roadCoordinates = coordinates;
    this.playbackZoomApplied = false;
    this.displayedHeading = undefined;
    this.displayedRoadProgress = 0;
    this.renderRouteLayers();
    const colors = getComputedStyle(document.documentElement);
    const css = (name: string, fallback: string) => colors.getPropertyValue(name).trim() || fallback;
    this.endpointMarkers = [
      this.circleMarker(coordinates[0], css('--color-success', '#20a77d'), 'Trip start'),
      this.circleMarker(coordinates.at(-1)!, css('--color-danger', '#df405e'), 'Trip end'),
    ];
    for (const event of events) {
      const point = coordinates[this.routeIndex(event.positionIndex, positions.length)];
      if (!point) continue;
      const color = event.type === 'violation' ? css('--color-danger', '#df405e')
        : event.type === 'dashcam' ? css('--color-warning', '#eca91f') : css('--color-info', '#397bd5');
      const element = markerElement(`<span style="display:block;width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:${color}"></span>`);
      element.addEventListener('click', () => this.eventSelected.emit(event));
      this.eventMarkers.push(new maplibregl.Marker({ element }).setLngLat([point[1], point[0]])
        .setPopup(popup(`${event.label} · ${event.detail}`)).addTo(this.map));
    }
    this.map.jumpTo({ pitch: 55, bearing: -20 });
    fitLatLngs(this.map, coordinates, 40, 14);
    this.updateVehicle(this.positionIndex());
  }

  private renderRouteLayers(): void {
    if (!this.map?.isStyleLoaded() || this.roadCoordinates.length < 2) return;
    const completedIndex = Math.max(0, Math.round(this.displayedRoadProgress));
    const features = [
      lineFeature(this.roadCoordinates, { kind: 'route' }),
      lineFeature(this.roadCoordinates.slice(0, completedIndex + 1), { kind: 'completed' }),
    ];
    const brand = getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() || '#7435e8';
    upsertGeoJson(this.map, 'trip-route', { type: 'FeatureCollection', features }, [
      {
        id: 'trip-route-casing', type: 'line', filter: ['==', ['get', 'kind'], 'route'],
        paint: { 'line-color': '#fff', 'line-width': 8, 'line-opacity': .9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-line', type: 'line', filter: ['==', ['get', 'kind'], 'route'],
        paint: { 'line-color': brand, 'line-width': 5, 'line-opacity': .95, 'line-dasharray': [2, 1.6] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'trip-route-completed', type: 'line', filter: ['==', ['get', 'kind'], 'completed'],
        paint: { 'line-color': brand, 'line-width': 5, 'line-opacity': .95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
    ]);
  }

  private circleMarker(point: LatLng, color: string, label: string): maplibregl.Marker {
    const element = markerElement(`<span style="display:block;width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:${color}"></span>`);
    return new maplibregl.Marker({ element }).setLngLat([point[1], point[0]]).setPopup(popup(label)).addTo(this.map!);
  }

  private clearMarkers(): void {
    this.vehicleVisible = false;
    this.vehicleOverlay?.setProps({ layers: [] });
    this.endpointMarkers.forEach((item) => item.remove());
    this.eventMarkers.forEach((item) => item.remove());
    this.endpointMarkers = [];
    this.eventMarkers = [];
  }

  private async getRoadCoordinates(positions: TripPosition[]): Promise<LatLng[]> {
    const fallback = positions.map(({ lat, lng }) => [lat, lng] as LatLng);
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    try {
      const matched: LatLng[] = [];
      for (const chunk of this.positionChunks(positions, 95)) {
        const coordinates = chunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
        const timestamps = chunk.map((point, index) => {
          const parsed = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
          return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : index;
        }).join(';');
        const response = await fetch(`${OSRM_BASE_URL}/match/v1/driving/${coordinates}?timestamps=${timestamps}&radiuses=${chunk.map(() => '50').join(';')}&overview=full&geometries=geojson`, { signal: this.routeRequest.signal });
        if (!response.ok) throw new Error();
        const result = await response.json() as { code?: string; matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }> };
        const values = result.code === 'Ok' ? result.matchings?.flatMap((item) => item.geometry?.coordinates ?? []) : [];
        if (!values?.length) throw new Error();
        matched.push(...values.map(([lng, lat]) => [lat, lng] as LatLng));
      }
      return this.dedupeCoordinates(matched);
    } catch {
      if (this.routeRequest.signal.aborted) return fallback;
      try { return await this.getOsrmRoute(positions); } catch { return fallback; }
    }
  }

  private async getOsrmRoute(positions: TripPosition[]): Promise<LatLng[]> {
    const routed: LatLng[] = [];
    for (const chunk of this.positionChunks(positions, 95)) {
      const coordinates = chunk.map(({ lng, lat }) => `${lng},${lat}`).join(';');
      const response = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal: this.routeRequest?.signal });
      if (!response.ok) throw new Error();
      const result = await response.json() as { routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }> };
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
    return points.filter((point, index) => index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
  }

  private routeIndex(positionIndex: number, count: number): number {
    return count <= 1 || this.roadCoordinates.length <= 1 ? 0
      : Math.round((positionIndex / (count - 1)) * (this.roadCoordinates.length - 1));
  }

  private updateVehicle(index: number): void {
    if (!this.map || !this.vehicleOverlay || !this.roadCoordinates.length || !this.positions().length) return;
    const roadIndex = this.routeIndex(index, this.positions().length);
    const position = this.roadCoordinates[roadIndex];
    const heading = this.headingAt(roadIndex);
    this.renderRouteLayers();
    if (this.vehicleVisible) {
      if (this.playbackActive()) this.animateVehicleTo(roadIndex);
      else {
        this.cancelMovement();
        this.displayedRoadProgress = roadIndex;
        this.renderVehicleModel(position, heading);
        this.map.panTo([position[1], position[0]], { duration: 0 });
      }
    } else {
      this.vehicleVisible = true;
      this.displayedRoadProgress = roadIndex;
      this.renderVehicleModel(position, heading);
    }
  }

  private animateVehicleTo(target: number): void {
    if (!this.map || !this.vehicleOverlay || !this.vehicleVisible) return;
    this.cancelMovement();
    const start = this.displayedRoadProgress;
    const duration = Math.max(40, this.playbackStepDuration() / this.playbackSpeed());
    const startedAt = performance.now();
    const move = (now: number) => {
      if (!this.map || !this.vehicleOverlay || !this.vehicleVisible) return;
      const progress = Math.min((now - startedAt) / duration, 1);
      this.displayedRoadProgress = start + (target - start) * progress;
      const position = this.coordinateAt(this.displayedRoadProgress);
      this.renderVehicleModel(position, this.headingAt(this.displayedRoadProgress));
      this.map.panTo([position[1], position[0]], { duration: 0 });
      if (progress < 1) this.movementFrame = requestAnimationFrame(move);
    };
    this.movementFrame = requestAnimationFrame(move);
  }

  private renderVehicleModel(position: LatLng, heading: number): void {
    if (!this.vehicleModelUrl) {
      this.pendingVehicle = { position, heading };
      void this.loadVehicleModel();
      return;
    }
    const data: VehicleModelState[] = [{
      position: [position[1], position[0], 0.4],
      heading,
    }];
    this.vehicleOverlay?.setProps({
      layers: [
        new ScenegraphLayer<VehicleModelState>({
          id: 'trip-vehicle-model',
          data,
          scenegraph: this.vehicleModelUrl,
          getPosition: (vehicle) => vehicle.position,
          getOrientation: (vehicle) => [0, -vehicle.heading + VEHICLE_MODEL_YAW_OFFSET, 90],
          // The low-poly muscle car is approximately six authoring units long.
          getScale: [0.4, 0.4, 0.4],
          sizeScale: 1,
          sizeMinPixels: 28,
          sizeMaxPixels: 56,
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
          const response = await fetch(new URL(path, window.location.origin), { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          const magic = new TextDecoder('ascii').decode(bytes.slice(0, 4));
          if (magic !== 'glTF') throw new Error(`Expected GLB data but received ${magic || 'an empty response'}`);
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

  private coordinateAt(progress: number): LatLng {
    const lower = Math.max(0, Math.min(Math.floor(progress), this.roadCoordinates.length - 1));
    const upper = Math.min(lower + 1, this.roadCoordinates.length - 1), fraction = progress - lower;
    const start = this.roadCoordinates[lower], end = this.roadCoordinates[upper];
    return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
  }

  private headingAt(progress: number): number {
    const index = Math.round(progress);
    return this.nearestHeading(this.calculateBearing(
      this.roadCoordinates[Math.max(index - 2, 0)],
      this.roadCoordinates[Math.min(index + 3, this.roadCoordinates.length - 1)],
    ));
  }

  private calculateBearing(start: LatLng, end: LatLng): number {
    const rad = (value: number) => value * Math.PI / 180;
    const startLat = rad(start[0]), endLat = rad(end[0]), delta = rad(end[1] - start[1]);
    const y = Math.sin(delta) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(delta);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private nearestHeading(next: number): number {
    if (this.displayedHeading === undefined) return this.displayedHeading = next;
    const current = ((this.displayedHeading % 360) + 360) % 360;
    return this.displayedHeading += ((next - current + 540) % 360) - 180;
  }

  private cancelMovement(): void {
    if (this.movementFrame !== undefined) cancelAnimationFrame(this.movementFrame);
    this.movementFrame = undefined;
  }

  ngOnDestroy(): void {
    this.cancelMovement();
    this.routeRequest?.abort();
    this.vehicleOverlay?.finalize();
    if (this.vehicleModelUrl) URL.revokeObjectURL(this.vehicleModelUrl);
    this.map?.remove();
  }
}
