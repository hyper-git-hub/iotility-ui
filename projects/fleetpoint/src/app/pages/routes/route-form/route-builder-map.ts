import { AfterViewInit, Component, ElementRef, OnDestroy, input, output, viewChild } from '@angular/core';
import { Map as LeafletMap, Marker, Polyline, circleMarker, map, polyline, tileLayer } from 'leaflet';
const OSRM_BASE_URL='https://fms.backend.iot.vodafone.com.qa:5000';
const OSRM_FALLBACK_URL='https://router.project-osrm.org';
export interface RoutePoint { lat:number;lng:number;type:'start'|'stop'|'end';label:string; }
@Component({selector:'app-route-builder-map',template:'<div #map class="map-host" aria-label="Build route on map"></div>',styleUrl:'./route-builder-map.css'})
export class RouteBuilderMap implements AfterViewInit,OnDestroy {
  readonly mode=input.required<'start'|'stop'|'end'>();readonly pointSelected=output<RoutePoint>();
  private readonly element=viewChild.required<ElementRef<HTMLElement>>('map');private map?:LeafletMap;private markers:Marker[]=[];private line?:Polyline;private routeOutline?:Polyline;private points:RoutePoint[]=[];private resizeObserver?:ResizeObserver;private invalidateTimer?:ReturnType<typeof setTimeout>;
  ngAfterViewInit():void{
    this.map=map(this.element().nativeElement).setView([52.4862,-1.8904],6);
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19,crossOrigin:true}).addTo(this.map);
    this.map.on('click',({latlng})=>this.addPoint(latlng.lat,latlng.lng));
    this.resizeObserver=new ResizeObserver(()=>this.map?.invalidateSize({pan:false}));
    this.resizeObserver.observe(this.element().nativeElement);
    requestAnimationFrame(()=>this.map?.invalidateSize({pan:false}));
    this.invalidateTimer=setTimeout(()=>this.map?.invalidateSize({pan:false}),550);
  }
  reset():void{this.markers.forEach(marker=>marker.remove());this.markers=[];this.line?.remove();this.routeOutline?.remove();this.line=undefined;this.routeOutline=undefined;this.points=[];}
  async calculateRoute():Promise<boolean>{
    if(!this.map||this.points.length<2)return false;
    const coordinates=this.points.map(point=>`${point.lng},${point.lat}`).join(';');
    for(const baseUrl of [OSRM_BASE_URL,OSRM_FALLBACK_URL]){try{
      const response=await fetch(`${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
      if(!response.ok)continue;
      const result=await response.json() as {code?:string;routes?:{geometry?:{coordinates?:[number,number][]}}[]};
      const route=result.code==='Ok'?result.routes?.[0]?.geometry?.coordinates:undefined;if(!route?.length)continue;
      const roadPath=route.map(([lng,lat])=>[lat,lng] as [number,number]);
      if(!this.matchesEndpoints(roadPath))continue;
      this.line?.remove();this.routeOutline?.remove();
      this.routeOutline=polyline(roadPath,{color:'#fff',weight:9,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(this.map);
      this.line=polyline(roadPath,{color:'#8b5cf6',weight:5,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(this.map);
      this.map.fitBounds(this.line.getBounds(),{padding:[42,42],maxZoom:14});
      return true;
    }catch{continue;}}
    return false;
  }
  private matchesEndpoints(path:[number,number][]):boolean{
    const start=this.points[0],end=this.points.at(-1);if(!start||!end)return false;
    return this.distanceKm(path[0],[start.lat,start.lng])<8&&this.distanceKm(path.at(-1)!,[end.lat,end.lng])<8;
  }
  private distanceKm(a:[number,number],b:[number,number]):number{
    const rad=(value:number)=>value*Math.PI/180;const dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);const value=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
  }
  private addPoint(lat:number,lng:number):void{
    const type=this.mode();if(type==='start'&&this.points.some(point=>point.type==='start')||type==='end'&&this.points.some(point=>point.type==='end'))return;
    const stopNumber=this.points.filter(point=>point.type==='stop').length+1;const label=type==='start'?'Start':type==='end'?'End':`Stop ${stopNumber}`;const point={lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6)),type,label};this.points.push(point);
    const color=type==='start'?'#10b981':type==='end'?'#ef4444':'#8b5cf6';this.markers.push(circleMarker([lat,lng],{radius:8,color:'#fff',weight:3,fillColor:color,fillOpacity:1}).addTo(this.map!).bindTooltip(label,{permanent:true,direction:'top'}) as unknown as Marker);
    this.line?.remove();this.routeOutline?.remove();this.routeOutline=undefined;this.line=polyline(this.points.map(item=>[item.lat,item.lng]),{color:'#8b5cf6',weight:4,dashArray:'8 6'}).addTo(this.map!);this.pointSelected.emit(point);
  }
  ngOnDestroy():void{this.resizeObserver?.disconnect();if(this.invalidateTimer)clearTimeout(this.invalidateTimer);this.map?.remove();}
}
