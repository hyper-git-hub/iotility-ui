import { Component } from '@angular/core';
import { DataTable,DataTableCellTemplate,TableColumn,TableRow } from '@iotility/shared-ui';
import { ChartData,ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { GEOZONES,ZONE_TYPE_LABELS } from '../geozones.data';
@Component({selector:'app-geozone-analytics',imports:[DataTable,DataTableCellTemplate,FleetBarChart],templateUrl:'./geozone-analytics.html',styleUrl:'./geozone-analytics.css'})
export class GeozoneAnalytics{
  protected readonly visits:ChartData<'bar',number[],string>={labels:GEOZONES.map(z=>this.short(z.name)),datasets:[{label:'Visits Today',data:GEOZONES.map(z=>z.visitsToday),backgroundColor:'#8347f5',borderRadius:5}]};
  protected readonly violations:ChartData<'bar',number[],string>={labels:GEOZONES.map(z=>this.short(z.name)),datasets:[{label:'Violations',data:GEOZONES.map(z=>z.violations),backgroundColor:'#d9435f',borderRadius:5}]};
  protected readonly options:ChartOptions<'bar'>={indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{display:true,color:'rgba(148, 163, 184, 0.2)',lineWidth:1},border:{display:false}},y:{grid:{display:true,color:'rgba(148, 163, 184, 0.14)',lineWidth:1},border:{display:false}}}};
  protected readonly columns:TableColumn[]=[{key:'name',label:'Zone'},{key:'typeLabel',label:'Type',type:'status'},{key:'assigned',label:'Assigned To'},{key:'visitsToday',label:'Visits Today'},{key:'visitsWeek',label:'This Week'},{key:'avgDwell',label:'Avg Dwell'},{key:'inside',label:'Inside Now'},{key:'violationsLabel',label:'Violations',type:'status'},{key:'link',label:'Links',type:'status'}];
  protected readonly rows:TableRow[]=GEOZONES.map(z=>({...z,typeLabel:ZONE_TYPE_LABELS[z.type],violationsLabel:z.violations?`${z.violations} violations`:'None'}));
  private short(name:string):string{return name.split('—')[0].trim().split(' ').slice(0,2).join(' ');}
}
