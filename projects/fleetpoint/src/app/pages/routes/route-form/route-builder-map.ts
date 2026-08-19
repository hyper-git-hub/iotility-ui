import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import {
  LatLng,
  createIotMap,
  fitLatLngs,
  lineFeature,
  markerElement,
  popup,
  removeGeoJson,
  upsertGeoJson,
} from '../../../shared/maps/maplibre';
import { environment } from '../../../../environments/environment';

export interface RoutePoint { lat: number; lng: number; type: 'start' | 'stop' | 'end'; label: string; }

@Component({
  selector: 'app-route-builder-map',
  template: '<div #map class="map-host" aria-label="Build route on map"></div>',
  styleUrl: './route-builder-map.css',
})
export class RouteBuilderMap implements AfterViewInit, OnDestroy {
  readonly mode = input.required<'start' | 'stop' | 'end'>();
  readonly pointSelected = output<RoutePoint>();
  private readonly element = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: Map;
  private markers: maplibregl.Marker[] = [];
  private points: RoutePoint[] = [];
  private routePath: LatLng[] = [];
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.map = createIotMap(this.element().nativeElement, [52.4862, -1.8904], 6);
    this.map.on('click', ({ lngLat }) => this.addPoint(lngLat.lat, lngLat.lng));
    this.map.on('style.load', () => this.renderLine());
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.element().nativeElement);
  }

  reset(): void {
    this.markers.forEach((item) => item.remove());
    this.markers = [];
    this.points = [];
    this.routePath = [];
    if (this.map?.isStyleLoaded()) removeGeoJson(this.map, 'builder-route', ['builder-outline', 'builder-line']);
  }

  async calculateRoute(): Promise<boolean> {
    if (!this.map || this.points.length < 2) return false;
    const coordinates = this.points.map((point) => `${point.lng},${point.lat}`).join(';');
    for (const baseUrl of [environment.osrmBaseUrl, environment.osrmFallbackUrl]) {
      try {
        const response = await fetch(`${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
        if (!response.ok) continue;
        const result = await response.json() as { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] };
        const route = result.code === 'Ok' ? result.routes?.[0]?.geometry?.coordinates : undefined;
        if (!route?.length) continue;
        const roadPath = route.map(([lng, lat]) => [lat, lng] as LatLng);
        if (!this.matchesEndpoints(roadPath)) continue;
        this.routePath = roadPath;
        this.renderLine(false);
        fitLatLngs(this.map, roadPath, 42, 14);
        return true;
      } catch { continue; }
    }
    return false;
  }

  private renderLine(dashed = this.routePath.length === 0): void {
    if (!this.map?.isStyleLoaded()) return;
    const path: LatLng[] = this.routePath.length
      ? this.routePath
      : this.points.map(({ lat, lng }) => [lat, lng] as LatLng);
    if (path.length < 2) return;
    upsertGeoJson(this.map, 'builder-route', lineFeature(path), [
      {
        id: 'builder-outline', type: 'line',
        paint: { 'line-color': '#fff', 'line-width': dashed ? 0 : 9, 'line-opacity': .9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'builder-line', type: 'line',
        paint: {
          'line-color': '#8b5cf6', 'line-width': dashed ? 4 : 5,
          ...(dashed ? { 'line-dasharray': [2, 1.5] } : {}),
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
    ]);
  }

  private matchesEndpoints(path: LatLng[]): boolean {
    const start = this.points[0], end = this.points.at(-1);
    return !!start && !!end &&
      this.distanceKm(path[0], [start.lat, start.lng]) < 8 &&
      this.distanceKm(path.at(-1)!, [end.lat, end.lng]) < 8;
  }

  private distanceKm(a: LatLng, b: LatLng): number {
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private addPoint(lat: number, lng: number): void {
    const type = this.mode();
    if ((type === 'start' && this.points.some((point) => point.type === 'start')) ||
      (type === 'end' && this.points.some((point) => point.type === 'end'))) return;
    const stopNumber = this.points.filter((point) => point.type === 'stop').length + 1;
    const label = type === 'start' ? 'Start' : type === 'end' ? 'End' : `Stop ${stopNumber}`;
    const point = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), type, label };
    this.points.push(point);
    this.routePath = [];
    const color = type === 'start' ? '#10b981' : type === 'end' ? '#ef4444' : '#8b5cf6';
    const element = markerElement(`<span style="display:block;width:16px;height:16px;border:3px solid #fff;border-radius:50%;background:${color}"></span>`);
    this.markers.push(new maplibregl.Marker({ element }).setLngLat([lng, lat]).setPopup(popup(label)).addTo(this.map!));
    this.renderLine(true);
    this.pointSelected.emit(point);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
