import { Component,computed,signal } from '@angular/core';
import { FleetMap,MapZoneOverlay,TrackedVehicle,VehicleStatus } from '../../../shared/fleet-map/fleet-map';
import { GEOZONES,GeozoneRecord,GeozoneType,ZONE_TYPE_LABELS } from '../geozones.data';
@Component({selector:'app-zone-map',imports:[FleetMap],templateUrl:'./zone-map.html',styleUrl:'./zone-map.css'})
export class ZoneMap{
  protected readonly search=signal('');protected readonly type=signal<'all'|GeozoneType>('all');protected readonly selected=signal<string|null>(null);
  protected readonly filters:ReadonlyArray<{id:'all'|GeozoneType;label:string}>=[
    {id:'all',label:'All'},
    {id:'allowed',label:'Allowed'},
    {id:'restricted',label:'Restricted'},
    {id:'speed',label:'Speed'},
    {id:'curfew',label:'Curfew'},
    {id:'poi',label:'POI'},
    {id:'corridor',label:'Corridor'},
  ];
  protected readonly filtered=computed(()=>{const q=this.search().toLowerCase();return GEOZONES.filter(z=>(this.type()==='all'||z.type===this.type())&&(!q||`${z.name} ${z.description}`.toLowerCase().includes(q)));});
  protected readonly selectedZone=computed(()=>GEOZONES.find(zone=>zone.id===this.selected())??null);
  protected readonly mappedZones=computed(()=>this.filtered().filter(zone=>zone.type!=='corridor'));
  protected readonly markers=computed<TrackedVehicle[]>(()=>this.mappedZones().map(z=>({id:z.id,model:z.name,driver:this.label(z.type),status:this.status(z),speed:z.speed??0,fuel:0,location:z.description,updated:`${z.inside} inside`,lat:z.lat,lng:z.lng})));
  protected readonly overlays=computed<MapZoneOverlay[]>(()=>this.mappedZones().map(zone=>{
    const color=this.zoneColor(zone.type);
    if(zone.shape.toLowerCase()==='polygon'){
      const size=zone.type==='speed'?0.018:0.032;
      return{id:zone.id,label:zone.name,geometry:'polygon',color,points:[[zone.lat+size,zone.lng-size],[zone.lat+size*.65,zone.lng+size],[zone.lat-size,zone.lng+size*.7],[zone.lat-size*.75,zone.lng-size]]};
    }
    return{id:zone.id,label:zone.name,geometry:'circle',color,center:[zone.lat,zone.lng],radius:Math.max(zone.radius??350,3000)};
  }));
  protected choose(type:'all'|GeozoneType):void{this.type.set(type);this.selected.set(null);}
  protected selectMarker(item:TrackedVehicle):void{this.selected.set(item.id);}
  protected toggle(zone:GeozoneRecord):void{this.selected.update(id=>id===zone.id?null:zone.id);}
  protected closeDetails():void{this.selected.set(null);}
  protected label(type:GeozoneType):string{return ZONE_TYPE_LABELS[type];}
  private zoneColor(type:GeozoneType):string{return{allowed:'#22c55e',restricted:'#ef4444',speed:'#f59e0b',curfew:'#8b5cf6',poi:'#3b82f6',corridor:'#14b8a6'}[type];}
  private status(zone:GeozoneRecord):VehicleStatus{return zone.violations?'Alert':zone.type==='allowed'?'Moving':zone.type==='speed'?'Idling':'Offline';}
}
