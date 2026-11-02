import { Component, computed, inject, signal } from '@angular/core';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { NOT_AVAILABLE, RunRecord, routeCode, toRouteRecord, toRunRecord } from '../routes.data';
import { RouteAdherenceMap } from './route-adherence-map';

const EMPTY_RUN: RunRecord = {recordId:0,id:NOT_AVAILABLE,routeId:NOT_AVAILABLE,route:'No runs yet',driver:NOT_AVAILABLE,vehicle:NOT_AVAILABLE,status:'Scheduled',dispatch:NOT_AVAILABLE,scheduled:NOT_AVAILABLE,startsAt:null,stops:NOT_AVAILABLE,compliance:NOT_AVAILABLE,deviations:NOT_AVAILABLE};

/** Planned path is the route's saved polyline; the API has no actual track or adherence score yet. */
@Component({selector:'app-route-adherence',imports:[Dropdown,RouteAdherenceMap],templateUrl:'./route-adherence.html',styleUrl:'./route-adherence.css'})
export class RouteAdherence {
  private readonly api=inject(RoutesApiService);
  private readonly runs=computed(()=>this.api.allocations().map(toRunRecord));
  private readonly picked=signal('');
  protected readonly selectedId=computed(()=>this.picked()||this.runs()[0]?.id||'');
  protected readonly options=computed<DropdownOption[]>(()=>this.runs().map(r=>({id:r.id,label:`${r.id} · ${r.route}`})));
  protected readonly run=computed(()=>this.runs().find(r=>r.id===this.selectedId())??EMPTY_RUN);
  protected readonly plannedPath=computed(()=>{const route=this.api.routes().find(r=>routeCode(r.id)===this.run().routeId);return route?toRouteRecord(route).path:[];});
  protected choose(id:string){this.picked.set(id);}
}
