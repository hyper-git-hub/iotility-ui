import { AfterViewInit, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import maplibregl, { Map } from 'maplibre-gl';
import {
  LatLng,
  createIotMap,
  fitLatLngs,
  lineFeature,
  markerElement,
  popup,
  upsertGeoJson,
} from '../../../shared/maps/maplibre';

@Component({
  selector: 'app-route-adherence-map',
  template: '<div #map class="map-host" aria-label="Route adherence map"></div>',
  styleUrl: './route-adherence-map.css',
})
export class RouteAdherenceMap implements AfterViewInit, OnDestroy {
  private readonly element = viewChild.required<ElementRef<HTMLElement>>('map');
  private map?: Map;
  private markers: maplibregl.Marker[] = [];

  ngAfterViewInit(): void {
    const planned: LatLng[] = [[51.54, -.08], [51.52, -.1], [51.49, -.2], [51.8, -1.2], [52.05, -1.4], [52.26, -1.5], [52.455, -1.73]];
    const actual: LatLng[] = [[51.54, -.08], [51.515, -.095], [51.485, -.195], [51.81, -1.18], [52.06, -1.38], [52.27, -1.49], [52.46, -1.72]];
    const deviated: LatLng[] = [[51.81, -1.18], [51.84, -1.12], [51.86, -1.15], [52.06, -1.38]];
    this.map = createIotMap(this.element().nativeElement, [52, -.8], 7);
    const render = () => {
      if (!this.map) return;
      upsertGeoJson(this.map, 'adherence-routes', {
        type: 'FeatureCollection',
        features: [
          lineFeature(planned, { kind: 'planned' }),
          lineFeature(actual, { kind: 'actual' }),
          lineFeature(deviated, { kind: 'deviation' }),
        ],
      }, [
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
      if (!this.markers.length) {
        this.markers = [
          this.endpoint(actual[0], '#22c55e', 'Route start'),
          this.endpoint(actual.at(-1)!, '#ef4444', 'Route end'),
        ];
      }
    };
    this.map.on('style.load', render);
    this.map.once('load', () => {
      render();
      fitLatLngs(this.map!, [...planned, ...actual, ...deviated], 35);
    });
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
