import { AfterViewInit, Component, ElementRef, OnDestroy, output, signal, viewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import { createIotMap, timezoneCenter, markerElement } from '../../../shared/maps/maplibre';
import { MapControls } from '../../../shared/map-overlays/map-controls';

export interface PoiCoordinates {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-poi-location-picker',
  imports: [MapControls],
  host: { '[class.is-fullscreen]': 'isFullscreen()' },
  template: `
    <div #map class="location-map" aria-label="Choose POI location on map"></div>
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
  styleUrl: './poi-location-picker.css',
})
export class PoiLocationPicker implements AfterViewInit, OnDestroy {
  readonly locationSelected = output<PoiCoordinates>();
  private readonly mapElement = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: Map;
  private marker?: maplibregl.Marker;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    // Default map center to Pakistan; will override if geolocation succeeds
    this.map = createIotMap(this.mapElement().nativeElement, timezoneCenter(), 6);
    // Attempt live geolocation, overriding the default on success
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.map!.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14, duration: 700 });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
    this.map.on('click', ({ lngLat }) => this.selectLocation(lngLat.lat, lngLat.lng));
    this.resizeObserver = new ResizeObserver(() => this.map?.resize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
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

  private selectLocation(latitude: number, longitude: number): void {
    if (!this.marker) {
      const element = markerElement('<span class="poi-picker-marker"><svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1.5A15.5 15.5 0 0 0 2.5 17c0 11.2 12.2 24 15.5 27.2C21.3 41 33.5 28.2 33.5 17A15.5 15.5 0 0 0 18 1.5Z"/><circle cx="18" cy="17" r="6"/></svg></span>');
      this.marker = new maplibregl.Marker({ element, draggable: true, anchor: 'bottom' })
        .setLngLat([longitude, latitude])
        .addTo(this.map!);
      this.marker.on('dragend', () => {
        const position = this.marker!.getLngLat();
        this.emitCoordinates(position.lat, position.lng);
      });
    } else this.marker.setLngLat([longitude, latitude]);
    this.emitCoordinates(latitude, longitude);
  }

  private emitCoordinates(latitude: number, longitude: number): void {
    this.locationSelected.emit({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }
}
