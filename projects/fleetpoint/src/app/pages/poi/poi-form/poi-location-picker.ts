import { AfterViewInit, Component, ElementRef, OnDestroy, output, viewChild } from '@angular/core';
import {
  Map as LeafletMap,
  Marker,
  divIcon,
  map as createMap,
  marker as createMarker,
  tileLayer,
} from 'leaflet';

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
  private map?: LeafletMap;
  private marker?: Marker;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.map = createMap(this.mapElement().nativeElement, { zoomControl: true }).setView(
      [52.4862, -1.8904],
      6,
    );
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.map.on('click', ({ latlng }) => this.selectLocation(latlng.lat, latlng.lng));
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private selectLocation(latitude: number, longitude: number): void {
    const coordinates: [number, number] = [latitude, longitude];
    if (!this.marker) {
      const icon = divIcon({
        className: '',
        html: '<span class="poi-picker-marker"><svg viewBox="0 0 36 46" aria-hidden="true"><path d="M18 1.5A15.5 15.5 0 0 0 2.5 17c0 11.2 12.2 24 15.5 27.2C21.3 41 33.5 28.2 33.5 17A15.5 15.5 0 0 0 18 1.5Z"/><circle cx="18" cy="17" r="6"/></svg></span>',
        iconSize: [36, 46],
        iconAnchor: [18, 44],
      });
      this.marker = createMarker(coordinates, { draggable: true, icon }).addTo(this.map!);
      this.marker.on('dragend', () => {
        const position = this.marker!.getLatLng();
        this.emitCoordinates(position.lat, position.lng);
      });
    } else {
      this.marker.setLatLng(coordinates);
    }
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
