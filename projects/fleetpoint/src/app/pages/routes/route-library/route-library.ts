import { Component, computed, signal } from '@angular/core';
import { DataTable, DataTableExpandedRow, DropdownOption, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { FLEET_OPTIONS, ROUTES, STOPS_BY_ROUTE } from '../routes.data';

@Component({ selector:'app-route-library', imports:[DataTable,DataTableExpandedRow], templateUrl:'./route-library.html', styleUrl:'./route-library.css' })
export class RouteLibrary {
  protected readonly search=signal(''); protected readonly fleet=signal('all'); protected readonly fleetOptions=FLEET_OPTIONS;
  protected readonly columns:TableColumn[]=[{key:'route',label:'Route',type:'user',secondaryKey:'id'},{key:'journey',label:'Start → End'},{key:'stops',label:'Stops'},{key:'distance',label:'Distance'},{key:'fleet',label:'Assigned To'},{key:'template',label:'Template',type:'status'},{key:'compliance',label:'Avg Compliance'},{key:'runs',label:'Total Runs'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly actions:TableAction[]=['view','edit'];
  protected readonly filtered=computed(()=>{const q=this.search().trim().toLowerCase();return ROUTES.filter(r=>(this.fleet()==='all'||r.fleet===this.fleet())&&(!q||`${r.name} ${r.start} ${r.end} ${r.fleet}`.toLowerCase().includes(q)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(r=>({id:r.id,route:r.name,journey:`${r.start} → ${r.end}`,stops:`${r.stops} stops`,distance:`${r.distance} · ${r.duration}`,fleet:r.fleet,template:r.template,compliance:`${r.compliance}%`,runs:r.runs,actions:''})));
  protected selectFleet(option:DropdownOption):void{this.fleet.set(option.id);} protected label():string{return FLEET_OPTIONS.find(o=>o.id===this.fleet())?.label??'All fleets';}
  protected routeStops(row:TableRow){return STOPS_BY_ROUTE[String(row['id'])]??[];}
}
