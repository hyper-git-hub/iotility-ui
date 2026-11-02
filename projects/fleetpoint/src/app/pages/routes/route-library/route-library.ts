import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { DataTable, DataTableExpandedRow, DataTableSkeleton, DropdownOption, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { NOT_AVAILABLE, toRouteRecord } from '../routes.data';

@Component({ selector:'app-route-library', imports:[DataTable,DataTableExpandedRow,DataTableSkeleton], templateUrl:'./route-library.html', styleUrl:'./route-library.css' })
export class RouteLibrary {
  private readonly router=inject(Router);
  private readonly api=inject(RoutesApiService);
  protected readonly loaded=this.api.loaded;
  private readonly fleets=toSignal(this.api.fleets(),{initialValue:[]});
  protected readonly search=signal(''); protected readonly fleet=signal('all');
  protected readonly fleetOptions=computed<DropdownOption[]>(()=>[{id:'all',label:'All fleets'},...this.fleets().map(f=>({id:String(f.id),label:f.name}))]);
  protected readonly columns:TableColumn[]=[{key:'route',label:'Route',type:'user',secondaryKey:'id'},{key:'journey',label:'Start → End'},{key:'stops',label:'Stops'},{key:'distance',label:'Distance'},{key:'fleet',label:'Assigned To'},{key:'template',label:'Template'},{key:'compliance',label:'Avg Compliance'},{key:'runs',label:'Total Runs'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly columnLabels=this.columns.map(c=>c.label);
  protected readonly actions:TableAction[]=['dispatch','view','edit','delete'];
  private readonly routes=computed(()=>this.api.routes().map(toRouteRecord));
  /** A route belongs to a fleet when one of the vehicles it is allocated to is in that fleet. */
  protected readonly filtered=computed(()=>{const q=this.search().trim().toLowerCase();const fleet=this.fleets().find(f=>String(f.id)===this.fleet());const vehicleIds=new Set(fleet?.vehicles.map(v=>String(v.id))??[]);return this.routes().filter(r=>(!fleet||r.vehicleIds.some(id=>vehicleIds.has(id)))&&(!q||`${r.name} ${r.start} ${r.end} ${r.assigned}`.toLowerCase().includes(q)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(r=>({id:r.id,route:r.name,journey:`${r.start} → ${r.end}`,stops:`${r.stops} stops`,distance:`${r.distance} · ${r.duration}`,fleet:r.assigned,template:NOT_AVAILABLE,compliance:NOT_AVAILABLE,runs:r.runs,actions:''})));
  protected selectFleet(option:DropdownOption):void{this.fleet.set(option.id);} protected label():string{return this.fleetOptions().find(o=>o.id===this.fleet())?.label??'All fleets';}
  protected routeStops(row:TableRow){return this.routes().find(r=>r.id===row['id'])?.stopList??[];}
  protected handleAction(event:{action:TableAction;row:TableRow}):void{if(event.action==='dispatch')void this.router.navigate(['/fleetpoint/routes/dispatch'],{queryParams:{route:event.row['id']}});}
}
