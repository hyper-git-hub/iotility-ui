import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';
import { Map } from 'maplibre-gl';
import {
  LatLng, circlePolygon, createIotMap, polygonFeature, removeGeoJson, upsertGeoJson,
} from '../../../shared/maps/maplibre';

export interface GeozoneGeometry {
  shape: 'circle' | 'polygon';
  center?: { latitude: number; longitude: number };
  radius?: number;
  points?: Array<{ latitude: number; longitude: number }>;
}

@Component({
  selector: 'app-geozone-drawing-map',
  templateUrl: './geozone-drawing-map.html',
  styleUrl: './geozone-drawing-map.css',
})
export class GeozoneDrawingMap implements AfterViewInit, OnDestroy {
  readonly active = input(true);
  readonly shape = input.required<'circle' | 'polygon'>();
  readonly geometryChanged = output<GeozoneGeometry>();
  readonly geometryCleared = output<void>();
  protected readonly pointCount = signal(0);
  protected readonly drawingState = signal<'idle' | 'drawing' | 'complete'>('idle');
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: Map;
  private points: LatLng[] = [];
  private circleCenter?: LatLng;
  private circleRadius = 0;
  private resizeObserver?: ResizeObserver;
  private previousShape?: 'circle' | 'polygon';

  constructor() {
    effect(() => {
      const active = this.active(), shape = this.shape();
      if (!this.map) return;
      if (!active) { this.resetDrawing(true); return; }
      if (this.previousShape && this.previousShape !== shape) this.resetDrawing(true);
      this.previousShape = shape;
      this.startDrawing();
      queueMicrotask(() => this.map?.resize());
    });
  }

  ngAfterViewInit(): void {
    this.previousShape = this.shape();
    this.map = createIotMap(this.mapElement().nativeElement, [51.5074, -0.1278], 12);
    this.map.on('click', ({ lngLat }) => this.onMapClick([lngLat.lat, lngLat.lng]));
    this.map.on('mousemove', ({ lngLat }) => {
      if (this.shape() === 'circle' && this.circleCenter && this.drawingState() === 'drawing') {
        this.circleRadius = this.distanceMeters(this.circleCenter, [lngLat.lat, lngLat.lng]);
        this.renderShape();
      }
    });
    this.map.on('style.load', () => this.renderShape());
    if (this.active()) this.startDrawing();
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
  }

  protected startDrawing(): void {
    this.points = [];
    this.circleCenter = undefined;
    this.circleRadius = 0;
    this.pointCount.set(0);
    this.drawingState.set('drawing');
    this.geometryCleared.emit();
    if (this.map?.isStyleLoaded()) removeGeoJson(this.map, 'drawn-geozone', ['geozone-fill', 'geozone-line', 'geozone-points']);
  }

  protected finishPolygon(): void {
    if (this.shape() !== 'polygon' || this.points.length < 3) return;
    this.drawingState.set('complete');
    this.renderShape();
    this.geometryChanged.emit({
      shape: 'polygon',
      points: this.points.map(([latitude, longitude]) => ({
        latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)),
      })),
    });
  }

  protected clear(): void {
    this.resetDrawing(false);
    this.startDrawing();
  }

  private onMapClick(point: LatLng): void {
    if (this.drawingState() !== 'drawing') return;
    if (this.shape() === 'polygon') {
      this.points.push(point);
      this.pointCount.set(this.points.length);
      this.renderShape();
      return;
    }
    if (!this.circleCenter) {
      this.circleCenter = point;
      this.circleRadius = 1;
      this.renderShape();
      return;
    }
    this.circleRadius = this.distanceMeters(this.circleCenter, point);
    this.drawingState.set('complete');
    this.renderShape();
    this.geometryChanged.emit({
      shape: 'circle',
      center: {
        latitude: Number(this.circleCenter[0].toFixed(6)),
        longitude: Number(this.circleCenter[1].toFixed(6)),
      },
      radius: Math.round(this.circleRadius),
    });
  }

  private renderShape(): void {
    if (!this.map?.isStyleLoaded()) return;
    const boundary = this.shape() === 'circle' && this.circleCenter
      ? circlePolygon(this.circleCenter, this.circleRadius)
      : this.points;
    if (!boundary.length) return;
    const boundaryFeature = boundary.length >= 3
      ? polygonFeature(boundary)
      : {
          type: 'Feature' as const, properties: {},
          geometry: { type: 'LineString' as const, coordinates: boundary.map(([lat, lng]) => [lng, lat]) },
        };
    const vertexFeatures: GeoJSON.Feature[] = this.shape() === 'polygon'
      ? this.points.map(([lat, lng]) => ({
          type: 'Feature', properties: { vertex: true },
          geometry: { type: 'Point', coordinates: [lng, lat] },
        }))
      : [];
    upsertGeoJson(this.map, 'drawn-geozone', {
      type: 'FeatureCollection',
      features: [boundaryFeature, ...vertexFeatures],
    }, [
      { id: 'geozone-fill', type: 'fill', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#8b5cf6', 'fill-opacity': .2 } },
      { id: 'geozone-line', type: 'line', paint: { 'line-color': '#7c3aed', 'line-width': 2 } },
      { id: 'geozone-points', type: 'circle', filter: ['==', ['get', 'vertex'], true], paint: { 'circle-radius': 5, 'circle-color': '#7c3aed', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
    ]);
  }

  private distanceMeters(a: LatLng, b: LatLng): number {
    const rad = (value: number) => value * Math.PI / 180;
    const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private resetDrawing(emit: boolean): void {
    this.points = [];
    this.circleCenter = undefined;
    this.pointCount.set(0);
    this.drawingState.set('idle');
    if (this.map?.isStyleLoaded()) removeGeoJson(this.map, 'drawn-geozone', ['geozone-fill', 'geozone-line', 'geozone-points']);
    if (emit) this.geometryCleared.emit();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
