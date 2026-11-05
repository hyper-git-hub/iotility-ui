import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, signal, viewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import {
  LatLng,
  createIotMap,
  removeGeoJson,
  timezoneCenter,
  fitLatLngs,
  lineFeature,
  markerElement,
  popup,
  upsertGeoJson,
  routeCasingColor,
} from '../../../shared/maps/maplibre';
import { MapControls } from '../../../shared/map-overlays/map-controls';

@Component({
  selector: 'app-route-adherence-map',
  imports: [MapControls],
  host: { '[class.is-fullscreen]': 'isFullscreen()' },
  template: `
    <div #map class="map-host" aria-label="Route adherence map"></div>
    <div class="map-overlays">
      <app-map-controls
        class="overlay-controls"
        [fullscreen]="isFullscreen()"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (toggle3D)="onToggle3D()"
        (resetNorth)="onResetNorth()"
        (rotate)="onRotate()"
        (fullscreenToggle)="onFullscreenToggle()"
      />
    </div>
  `,
  styleUrl: './route-adherence-map.css',
})
/**
 * Planned route (dashed) for the selected run. Actual and deviated tracks are drawn when the
 * API provides them; until then only the plan shows.
 */
export class RouteAdherenceMap implements AfterViewInit, OnDestroy {
  /** Planned road path as [lat, lng] pairs. */
  readonly planned = input<LatLng[]>([]);
  readonly actual = input<LatLng[]>([]);
  readonly deviated = input<LatLng[]>([]);
  private readonly element = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: Map;
  private markers: maplibregl.Marker[] = [];
  private ready = false;

  constructor() {
    effect(() => {
      const paths = { planned: this.planned(), actual: this.actual(), deviated: this.deviated() };
      if (this.ready) this.render(paths, true);
    });
  }

  ngAfterViewInit(): void {
    // Default map center to Pakistan; will override if geolocation succeeds
    this.map = createIotMap(this.element().nativeElement, timezoneCenter(), 7);
    this.map.on('click', () => {});
    // Attempt live geolocation when there is no route to show
    if (!this.planned().length && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.map!.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 700 });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
    const paths = () => ({ planned: this.planned(), actual: this.actual(), deviated: this.deviated() });
    this.map.on('style.load', () => this.render(paths(), false));
    this.map.once('load', () => {
      this.ready = true;
      this.render(paths(), true);
    });
  }

  private render({ planned, actual, deviated }: Record<'planned' | 'actual' | 'deviated', LatLng[]>, fit: boolean): void {
    if (!this.map?.isStyleLoaded()) return;
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];
    const lines = [
      planned.length > 1 ? lineFeature(planned, { kind: 'planned' }) : null,
      actual.length > 1 ? lineFeature(actual, { kind: 'actual' }) : null,
      deviated.length > 1 ? lineFeature(deviated, { kind: 'deviation' }) : null,
    ].filter((feature) => !!feature);
    if (!lines.length) {
      removeGeoJson(this.map, 'adherence-routes', ['adherence-outline', 'adherence-planned', 'adherence-actual', 'adherence-deviation']);
      return;
    }
    upsertGeoJson(this.map, 'adherence-routes', { type: 'FeatureCollection', features: lines }, [
      {
        id: 'adherence-outline', type: 'line',
        paint: { 'line-color': routeCasingColor(), 'line-width': 8, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'adherence-planned', type: 'line', filter: ['==', ['get', 'kind'], 'planned'],
        paint: { 'line-color': '#3b82f6', 'line-width': 5, 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'adherence-actual', type: 'line', filter: ['==', ['get', 'kind'], 'actual'],
        paint: { 'line-color': '#22c55e', 'line-width': 5 },
      },
      {
        id: 'adherence-deviation', type: 'line', filter: ['==', ['get', 'kind'], 'deviation'],
        paint: { 'line-color': '#ef4444', 'line-width': 6 },
      },
    ]);
    const path = actual.length ? actual : planned;
    this.markers = [this.endpoint(path[0], '#22c55e', 'Route start'), this.endpoint(path.at(-1)!, '#ef4444', 'Route end')];
    if (fit) fitLatLngs(this.map, [...planned, ...actual, ...deviated], 35);
  }

  protected readonly isFullscreen = signal(false);

  protected zoomIn(): void {
    this.map?.zoomIn();
  }

  protected zoomOut(): void {
    this.map?.zoomOut();
  }

  // Button behaviour mirrors the shared fleet map so every map in the app
  // responds to the overlay identically.
  protected onToggle3D(): void {
    if (!this.map) return;
    this.map.easeTo({ pitch: this.map.getPitch() > 0 ? 0 : 60, duration: 500 });
  }

  protected onResetNorth(): void {
    this.map?.easeTo({ bearing: 0, duration: 500 });
  }

  protected onRotate(): void {
    if (!this.map) return;
    this.map.easeTo({ bearing: this.map.getBearing() + 90, duration: 500 });
  }

  protected onFullscreenToggle(): void {
    this.isFullscreen.update((value) => !value);
    // The host changes size, so MapLibre must re-measure after layout.
    requestAnimationFrame(() => requestAnimationFrame(() => this.map?.resize()));
  }

  private endpoint(point: LatLng, color: string, label: string): maplibregl.Marker {
    const element = markerElement(`<span style="display:block;width:14px;height:14px;border:3px solid white;border-radius:50%;background:${color}"></span>`);
    return new maplibregl.Marker({ element })
      .setLngLat([point[1], point[0]])
      .setPopup(popup(label))
      .addTo(this.map!);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
