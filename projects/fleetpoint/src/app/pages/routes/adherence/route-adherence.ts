import { Component, computed, signal } from '@angular/core';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { RUNS } from '../routes.data';
import { RouteAdherenceMap } from './route-adherence-map';
@Component({selector:'app-route-adherence',imports:[Dropdown,RouteAdherenceMap],templateUrl:'./route-adherence.html',styleUrl:'./route-adherence.css'})
export class RouteAdherence {
  protected readonly selectedId=signal(RUNS[0].id);protected readonly options:DropdownOption[]=RUNS.map(r=>({id:r.id,label:`${r.id} · ${r.route}`}));
  protected readonly run=computed(()=>RUNS.find(r=>r.id===this.selectedId())??RUNS[0]);
}
