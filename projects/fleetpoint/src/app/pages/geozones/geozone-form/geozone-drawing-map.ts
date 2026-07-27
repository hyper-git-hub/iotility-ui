import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';

export interface GeozoneGeometry {
  shape:'circle'|'polygon';
  center?:{latitude:number;longitude:number};
  radius?:number;
  points?:Array<{latitude:number;longitude:number}>;
}

@Component({
  selector:'app-geozone-drawing-map',
  templateUrl:'./geozone-drawing-map.html',
  styleUrl:'./geozone-drawing-map.css',
})
export class GeozoneDrawingMap implements AfterViewInit,OnDestroy{
  readonly shape=input.required<'circle'|'polygon'>();
  readonly geometryChanged=output<GeozoneGeometry>();
  readonly geometryCleared=output<void>();
  protected readonly pointCount=signal(0);
  protected readonly drawingState=signal<'idle'|'drawing'|'complete'>('idle');
  private readonly mapElement=viewChild.required<ElementRef<HTMLElement>>('map');
  private map?:L.Map;
  private leafletDraw?:typeof L;
  private drawnItems?:L.FeatureGroup;
  private activeDrawer?:L.Draw.Circle|L.Draw.Polygon;
  private resizeObserver?:ResizeObserver;
  private previousShape?:'circle'|'polygon';
  private readonly ensurePolygonVertex=(event:L.LeafletMouseEvent):void=>{
    if(this.shape()!=='polygon'||this.drawingState()!=='drawing'||!(this.activeDrawer instanceof this.leafletDraw!.Draw.Polygon))return;
    const drawer=this.activeDrawer as L.Draw.Polygon&{_poly:L.Polyline};
    const vertices=drawer._poly.getLatLngs() as L.LatLng[];
    const last=vertices[vertices.length-1];
    if(!last||last.distanceTo(event.latlng)>.5)drawer.addVertex(event.latlng);
  };

  constructor(){
    effect(()=>{
      const shape=this.shape();
      if(!this.map)return;
      if(this.previousShape&&this.previousShape!==shape)this.resetDrawing(true);
      this.previousShape=shape;
      this.startDrawing();
    });
  }

  async ngAfterViewInit():Promise<void>{
    const leafletRuntime=Object.assign({},L) as typeof L;
    (globalThis as typeof globalThis & {L:typeof L}).L=leafletRuntime;
    await import('leaflet-draw');
    this.leafletDraw=leafletRuntime;
    this.previousShape=this.shape();
    this.map=leafletRuntime.map(this.mapElement().nativeElement,{zoomControl:true}).setView([51.5074,-0.1278],12);
    leafletRuntime.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(this.map);
    this.drawnItems=new leafletRuntime.FeatureGroup().addTo(this.map);
    this.map.on(leafletRuntime.Draw.Event.CREATED,event=>this.onCreated(event as L.DrawEvents.Created));
    this.map.on(leafletRuntime.Draw.Event.DRAWVERTEX,event=>{
      const layers=(event as unknown as {layers:L.LayerGroup}).layers;
      this.pointCount.set(layers.getLayers().length);
    });
    this.startDrawing();
    this.resizeObserver=new ResizeObserver(()=>this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapElement().nativeElement);
    setTimeout(()=>this.map?.invalidateSize(),0);
  }

  protected startDrawing():void{
    if(!this.map||!this.drawnItems||!this.leafletDraw)return;
    this.activeDrawer?.disable();
    this.drawnItems.clearLayers();
    this.pointCount.set(0);
    this.drawingState.set('drawing');
    this.geometryCleared.emit();
    const options={
      shapeOptions:{
        color:'#7c3aed',
        fillColor:'#8b5cf6',
        fillOpacity:.2,
        weight:2,
        interactive:false,
        clickable:false,
      },
      showArea:true,
      metric:true,
    };
    this.activeDrawer=this.shape()==='circle'
      ?new this.leafletDraw.Draw.Circle(this.map as L.DrawMap,options)
      :new this.leafletDraw.Draw.Polygon(this.map as L.DrawMap,{...options,allowIntersection:true,showLength:true,maxPoints:0});
    this.activeDrawer.enable();
    this.map.off('click',this.ensurePolygonVertex);
    if(this.shape()==='polygon')this.map.on('click',this.ensurePolygonVertex);
  }

  protected finishPolygon():void{
    if(this.shape()!=='polygon'||this.pointCount()<3||!this.leafletDraw||!(this.activeDrawer instanceof this.leafletDraw.Draw.Polygon))return;
    this.activeDrawer.completeShape();
  }

  protected clear():void{
    this.activeDrawer?.disable();
    this.resetDrawing(false);
    this.startDrawing();
  }

  private onCreated(event:L.DrawEvents.Created):void{
    if(!this.drawnItems)return;
    this.map?.off('click',this.ensurePolygonVertex);
    this.drawnItems.clearLayers();
    this.drawnItems.addLayer(event.layer);
    this.activeDrawer=undefined;
    this.drawingState.set('complete');
    this.emitLayer(event.layer);
  }

  private emitLayer(layer:L.Layer):void{
    if(layer instanceof L.Circle){
      const center=layer.getLatLng();
      this.geometryChanged.emit({
        shape:'circle',
        center:{latitude:Number(center.lat.toFixed(6)),longitude:Number(center.lng.toFixed(6))},
        radius:Math.round(layer.getRadius()),
      });
      return;
    }
    if(layer instanceof L.Polygon){
      const rings=layer.getLatLngs() as L.LatLng[][];
      const points=(rings[0]??[]).map(point=>({latitude:Number(point.lat.toFixed(6)),longitude:Number(point.lng.toFixed(6))}));
      this.pointCount.set(points.length);
      this.geometryChanged.emit({shape:'polygon',points});
    }
  }

  private resetDrawing(emit:boolean):void{
    this.activeDrawer?.disable();this.activeDrawer=undefined;
    this.map?.off('click',this.ensurePolygonVertex);
    this.drawnItems?.clearLayers();this.pointCount.set(0);this.drawingState.set('idle');
    if(emit)this.geometryCleared.emit();
  }

  ngOnDestroy():void{
    this.resizeObserver?.disconnect();
    this.activeDrawer?.disable();
    this.map?.off('click',this.ensurePolygonVertex);
    this.map?.remove();
  }
}
