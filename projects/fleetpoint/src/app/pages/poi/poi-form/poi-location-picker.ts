import { AfterViewInit, Component, ElementRef, OnDestroy, output, viewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import { createIotMap, markerElement } from '../../../shared/maps/maplibre';

export interface PoiCoordinates {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-poi-location-picker',
  template: '<div #map class="location-map" aria-label="Choose POI location on map"></div>',
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
    this.map = createIotMap(this.mapElement().nativeElement, [30.3753, 69.3451], 6);
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
