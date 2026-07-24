import { Component, computed, signal } from '@angular/core';
import { DataTable, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { RUNS, STATUS_OPTIONS } from '../routes.data';
@Component({selector:'app-active-runs',imports:[DataTable],templateUrl:'./active-runs.html',styleUrl:'./active-runs.css'})
export class ActiveRuns {
  protected readonly search=signal('');protected readonly status=signal('all');protected readonly options=STATUS_OPTIONS;protected readonly runs=RUNS;
  protected readonly columns:TableColumn[]=[{key:'route',label:'Route',type:'user',secondaryKey:'id'},{key:'driver',label:'Driver'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'status',label:'Status',type:'status'},{key:'dispatch',label:'Dispatch'},{key:'scheduled',label:'Scheduled'},{key:'stops',label:'Stops'},{key:'compliance',label:'Compliance'},{key:'deviations',label:'Deviations'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly actions:TableAction[]=['view','edit'];
  protected readonly filtered=computed(()=>{const q=this.search().trim().toLowerCase();return RUNS.filter(r=>(this.status()==='all'||r.status===this.status())&&(!q||`${r.route} ${r.driver} ${r.vehicle}`.toLowerCase().includes(q)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(r=>({...r,actions:''})));
  protected count(id:string){return id==='all'?RUNS.length:RUNS.filter(r=>r.status===id).length;}
}
