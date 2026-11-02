import { Component, computed, inject, signal } from '@angular/core';
import { DataTable, DataTableSkeleton, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { STATUS_OPTIONS, toRunRecord } from '../routes.data';
@Component({selector:'app-active-runs',imports:[DataTable,DataTableSkeleton],templateUrl:'./active-runs.html',styleUrl:'./active-runs.css'})
export class ActiveRuns {
  private readonly api=inject(RoutesApiService);
  protected readonly loaded=this.api.loaded;
  protected readonly search=signal('');protected readonly status=signal('all');protected readonly options=STATUS_OPTIONS;
  protected readonly runs=computed(()=>this.api.allocations().map(toRunRecord));
  protected readonly columns:TableColumn[]=[{key:'route',label:'Route',type:'user',secondaryKey:'id'},{key:'driver',label:'Driver'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'status',label:'Status',type:'status'},{key:'dispatch',label:'Dispatch'},{key:'scheduled',label:'Scheduled'},{key:'stops',label:'Stops'},{key:'compliance',label:'Compliance'},{key:'deviations',label:'Deviations'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly columnLabels=this.columns.map(c=>c.label);
  protected readonly actions:TableAction[]=['view','edit'];
  protected readonly filtered=computed(()=>{const q=this.search().trim().toLowerCase();return this.runs().filter(r=>(this.status()==='all'||r.status===this.status())&&(!q||`${r.route} ${r.driver} ${r.vehicle}`.toLowerCase().includes(q)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(r=>({id:r.id,route:r.route,driver:r.driver,vehicle:r.vehicle,status:r.status,dispatch:r.dispatch,scheduled:r.scheduled,stops:r.stops,compliance:r.compliance,deviations:r.deviations,actions:''})));
  protected count(id:string){return id==='all'?this.runs().length:this.runs().filter(r=>r.status===id).length;}
}
