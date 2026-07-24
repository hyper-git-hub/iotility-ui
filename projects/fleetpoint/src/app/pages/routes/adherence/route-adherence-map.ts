import { AfterViewInit, Component, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { Map as LeafletMap, circleMarker, latLngBounds, map, polyline, tileLayer } from 'leaflet';
@Component({selector:'app-route-adherence-map',template:'<div #map class="map-host" aria-label="Route adherence map"></div>',styleUrl:'./route-adherence-map.css'})
export class RouteAdherenceMap implements AfterViewInit,OnDestroy {
  private readonly element=viewChild.required<ElementRef<HTMLElement>>('map');private map?:LeafletMap;
  ngAfterViewInit():void{
    const planned:[number,number][]=[[51.54,-.08],[51.52,-.1],[51.49,-.2],[51.8,-1.2],[52.05,-1.4],[52.26,-1.5],[52.455,-1.73]];
    const actual:[number,number][]=[[51.54,-.08],[51.515,-.095],[51.485,-.195],[51.81,-1.18],[52.06,-1.38],[52.27,-1.49],[52.46,-1.72]];
    const deviated:[number,number][]=[[51.81,-1.18],[51.84,-1.12],[51.86,-1.15],[52.06,-1.38]];
    this.map=map(this.element().nativeElement,{zoomControl:true}).setView([52,-.8],7);
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(this.map);
    polyline(planned,{color:'#3b82f6',weight:5,dashArray:'9 7'}).addTo(this.map).bindTooltip('Planned route');
    polyline(actual,{color:'#22c55e',weight:5}).addTo(this.map).bindTooltip('Actual route');
    polyline(deviated,{color:'#ef4444',weight:6}).addTo(this.map).bindTooltip('Deviation');
    circleMarker(actual[0],{radius:7,color:'#fff',weight:3,fillColor:'#22c55e',fillOpacity:1}).addTo(this.map).bindTooltip('Route start');
    circleMarker(actual.at(-1)!,{radius:7,color:'#fff',weight:3,fillColor:'#ef4444',fillOpacity:1}).addTo(this.map).bindTooltip('Route end');
    this.map.fitBounds(latLngBounds([...planned,...actual,...deviated]),{padding:[35,35]});setTimeout(()=>this.map?.invalidateSize(),0);
  }
  ngOnDestroy():void{this.map?.remove();}
}
