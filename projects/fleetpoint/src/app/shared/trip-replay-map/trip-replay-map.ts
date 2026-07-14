import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, viewChild } from '@angular/core';
import { CircleMarker, Map as LeafletMap, Marker, Polyline, circleMarker, divIcon, latLngBounds, map as createMap, marker, polyline, tileLayer } from 'leaflet';

export interface TripPosition { lat: number; lng: number; speed: number; heading: number; time: string; }
export interface TripReplayEvent { id: string; label: string; type: 'violation' | 'dashcam' | 'stop'; positionIndex: number; detail: string; }

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
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: LeafletMap;
  private routeCasing?: Polyline;
  private route?: Polyline;
  private completedRoute?: Polyline;
  private vehicleMarker?: Marker;
  private endpointMarkers: CircleMarker[] = [];
  private eventMarkers: CircleMarker[] = [];
  private roadCoordinates: Array<[number, number]> = [];
  private routeRequest?: AbortController;
  private routeVersion = 0;
  private playbackZoomApplied = false;
  private movementFrame?: number;
  private displayedHeading?: number;
  private displayedRoadProgress = 0;

  constructor() {
    effect(() => { const positions = this.positions(); const events = this.events(); if (this.map) void this.renderRoute(positions, events); });
    effect(() => { const index = this.positionIndex(); if (this.map) this.updateVehicle(index); });
    effect(() => {
      const active = this.playbackActive();
      if (active && this.map && !this.playbackZoomApplied) {
        this.playbackZoomApplied = true;
        this.map.setZoom(Math.min(this.map.getZoom() + 1, 16), { animate: true });
      }
    });
  }

  ngAfterViewInit(): void {
    this.map = createMap(this.mapElement().nativeElement, { zoomControl: true });
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(this.map);
    void this.renderRoute(this.positions(), this.events());
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private async renderRoute(positions: TripPosition[], events: TripReplayEvent[]): Promise<void> {
    if (!this.map || !positions.length) return;
    const routeVersion = ++this.routeVersion;
    const coordinates = await this.getRoadCoordinates(positions);
    if (!this.map || routeVersion !== this.routeVersion) return;
    const styles = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const success = color('--color-success', '#20a77d');
    const danger = color('--color-danger', '#df405e');
    const warning = color('--color-warning', '#eca91f');
    const info = color('--color-info', '#397bd5');
    this.routeCasing?.removeFrom(this.map); this.route?.removeFrom(this.map); this.completedRoute?.removeFrom(this.map); this.vehicleMarker?.removeFrom(this.map); this.vehicleMarker = undefined;
    this.endpointMarkers.forEach((item) => item.removeFrom(this.map!)); this.endpointMarkers = [];
    this.eventMarkers.forEach((item) => item.removeFrom(this.map!)); this.eventMarkers = [];
    this.roadCoordinates = coordinates;
    this.playbackZoomApplied = false;
    this.displayedHeading = undefined;
    this.displayedRoadProgress = 0;
    this.routeCasing = polyline(coordinates, {
      color: 'white',
      weight: 8,
      opacity: 0.9,
    }).addTo(this.map);
    this.route = polyline(coordinates, {
      color: color('--color-brand-500', '#7435e8'),
      weight: 5,
      opacity: 0.95,
      dashArray: '10 8',
    }).addTo(this.map);
    this.endpointMarkers = [
      circleMarker(coordinates[0], { radius: 8, color: 'white', weight: 3, fillColor: success, fillOpacity: 1 }).bindTooltip('Trip start').addTo(this.map),
      circleMarker(coordinates.at(-1)!, { radius: 8, color: 'white', weight: 3, fillColor: danger, fillOpacity: 1 }).bindTooltip('Trip end').addTo(this.map),
    ];
    for (const event of events) {
      const point = coordinates[this.routeIndex(event.positionIndex, positions.length)]; if (!point) continue;
      const eventColor = event.type === 'violation' ? danger : event.type === 'dashcam' ? warning : info;
      const eventMarker = circleMarker(point, { radius: 7, color: 'white', weight: 2, fillColor: eventColor, fillOpacity: 1 }).bindTooltip(`${event.label} · ${event.detail}`);
      eventMarker.on('click', () => this.eventSelected.emit(event)); eventMarker.addTo(this.map); this.eventMarkers.push(eventMarker);
    }
    this.map.fitBounds(latLngBounds(coordinates), { padding: [48, 48], maxZoom: 13 });
    this.updateVehicle(this.positionIndex());
  }

  private async getRoadCoordinates(positions: TripPosition[]): Promise<Array<[number, number]>> {
    const fallback = positions.map(({ lat, lng }) => [lat, lng] as [number, number]);
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    const waypointIndexes = [0, Math.floor((positions.length - 1) / 3), Math.floor(((positions.length - 1) * 2) / 3), positions.length - 1];
    const waypoints = waypointIndexes.map((index) => `${positions[index].lng},${positions[index].lat}`).join(';');
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`, { signal: this.routeRequest.signal });
      if (!response.ok) return fallback;
      const result = await response.json() as { routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }> };
      const roadRoute = result.routes?.[0]?.geometry?.coordinates;
      return roadRoute?.length ? roadRoute.map(([lng, lat]) => [lat, lng]) : fallback;
    } catch {
      return fallback;
    }
  }

  private routeIndex(positionIndex: number, positionCount: number): number {
    if (positionCount <= 1 || this.roadCoordinates.length <= 1) return 0;
    return Math.round((positionIndex / (positionCount - 1)) * (this.roadCoordinates.length - 1));
  }

  private updateVehicle(index: number): void {
    if (!this.map) return;
    const positions = this.positions(); const current = positions[Math.min(index, positions.length - 1)]; if (!current || !this.roadCoordinates.length) return;
    const roadIndex = this.routeIndex(index, positions.length);
    const roadPosition = this.roadCoordinates[roadIndex];
    const heading = this.headingAt(roadIndex);
    const completed = this.roadCoordinates.slice(0, roadIndex + 1);
    this.completedRoute?.removeFrom(this.map);
    const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim();
    if (completed.length > 1) this.completedRoute = polyline(completed, { color: brandColor, weight: 5, opacity: 0.95 }).addTo(this.map);
    const icon = divIcon({
      className: '',
      html: `<div class="replay-vehicle" style="transform:rotate(${heading}deg)" aria-label="Vehicle position">
        <img src="assets/fleetpoint/vehicle-on-map.png" alt="" />
      </div>`,
      iconSize: [58, 58],
      iconAnchor: [29, 29],
    });
    if (this.vehicleMarker) {
      const vehicleElement = this.vehicleMarker.getElement()?.querySelector<HTMLElement>('.replay-vehicle');
      if (this.playbackActive()) this.animateVehicleTo(roadIndex);
      else {
        this.cancelMovement();
        if (vehicleElement) vehicleElement.style.transform = `rotate(${heading}deg)`;
        this.displayedRoadProgress = roadIndex;
        this.vehicleMarker.setLatLng(roadPosition);
        this.map.panTo(roadPosition, { animate: false, noMoveStart: true });
      }
    } else {
      this.vehicleMarker = marker(roadPosition, { icon, zIndexOffset: 1000 }).addTo(this.map);
      this.displayedRoadProgress = roadIndex;
      this.map.panTo(roadPosition, { animate: false, noMoveStart: true });
    }
  }

  private animateVehicleTo(targetRoadProgress: number): void {
    if (!this.map || !this.vehicleMarker) return;
    this.cancelMovement();
    const startRoadProgress = this.displayedRoadProgress;
    const duration = Math.max(40, this.playbackStepDuration() / this.playbackSpeed());
    const startedAt = performance.now();

    const move = (now: number) => {
      if (!this.map || !this.vehicleMarker) return;
      const progress = Math.min((now - startedAt) / duration, 1);
      this.displayedRoadProgress = startRoadProgress
        + (targetRoadProgress - startRoadProgress) * progress;
      const position = this.coordinateAt(this.displayedRoadProgress);
      this.vehicleMarker.setLatLng(position);
      const vehicleElement = this.vehicleMarker.getElement()?.querySelector<HTMLElement>('.replay-vehicle');
      if (vehicleElement) vehicleElement.style.transform = `rotate(${this.headingAt(this.displayedRoadProgress)}deg)`;
      this.map.panTo(position, { animate: false, noMoveStart: true });
      if (progress < 1) this.movementFrame = requestAnimationFrame(move);
      else this.movementFrame = undefined;
    };

    this.movementFrame = requestAnimationFrame(move);
  }

  private coordinateAt(progress: number): [number, number] {
    const lowerIndex = Math.max(0, Math.min(Math.floor(progress), this.roadCoordinates.length - 1));
    const upperIndex = Math.min(lowerIndex + 1, this.roadCoordinates.length - 1);
    const fraction = progress - lowerIndex;
    const start = this.roadCoordinates[lowerIndex];
    const end = this.roadCoordinates[upperIndex];
    return [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
    ];
  }

  private headingAt(progress: number): number {
    const roadIndex = Math.round(progress);
    const directionStart = this.roadCoordinates[Math.max(roadIndex - 2, 0)];
    const directionEnd = this.roadCoordinates[Math.min(roadIndex + 3, this.roadCoordinates.length - 1)];
    return this.nearestHeading(this.calculateBearing(directionStart, directionEnd));
  }

  private cancelMovement(): void {
    if (this.movementFrame !== undefined) cancelAnimationFrame(this.movementFrame);
    this.movementFrame = undefined;
  }

  private calculateBearing(start: [number, number], end: [number, number]): number {
    const toRadians = (value: number) => value * (Math.PI / 180);
    const startLat = toRadians(start[0]);
    const endLat = toRadians(end[0]);
    const longitudeDelta = toRadians(end[1] - start[1]);
    const y = Math.sin(longitudeDelta) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat)
      - Math.sin(startLat) * Math.cos(endLat) * Math.cos(longitudeDelta);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
  }

  private nearestHeading(nextHeading: number): number {
    if (this.displayedHeading === undefined) {
      this.displayedHeading = nextHeading;
      return nextHeading;
    }
    const normalizedCurrent = ((this.displayedHeading % 360) + 360) % 360;
    const shortestDelta = ((nextHeading - normalizedCurrent + 540) % 360) - 180;
    this.displayedHeading += shortestDelta;
    return this.displayedHeading;
  }

  ngOnDestroy(): void { this.cancelMovement(); this.routeRequest?.abort(); this.map?.remove(); }
}
