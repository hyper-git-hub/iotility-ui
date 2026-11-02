import { Component,computed,inject } from '@angular/core';
import { ChartCard,DataTable,DataTableCellTemplate,DataTableSkeleton,TableColumn,TableRow } from '@iotility/shared-ui';
import { NOT_AVAILABLE,ZONE_TYPE_LABELS } from '../geozones.data';
import { GeozonesStore } from '../geozones.store';
@Component({selector:'app-geozone-analytics',imports:[ChartCard,DataTable,DataTableCellTemplate,DataTableSkeleton],templateUrl:'./geozone-analytics.html',styleUrl:'./geozone-analytics.css'})
export class GeozoneAnalytics{
  private readonly store=inject(GeozonesStore);
  protected readonly loaded=this.store.loaded;
  /** Visits and violations per zone aren't part of the geo-zone API, so both charts show their empty state. */
  protected readonly emptyMessage='No zone visit data available';
  protected readonly columns:TableColumn[]=[{key:'name',label:'Zone'},{key:'typeLabel',label:'Type',type:'status'},{key:'assigned',label:'Assigned To'},{key:'visitsToday',label:'Visits Today'},{key:'visitsWeek',label:'This Week'},{key:'avgDwell',label:'Avg Dwell'},{key:'inside',label:'Inside Now'},{key:'violationsLabel',label:'Violations',type:'status'},{key:'link',label:'Links',type:'status'}];
  protected readonly columnLabels=this.columns.map(column=>column.label);
  protected readonly rows=computed<TableRow[]>(()=>this.store.zones().map(z=>({
    id:z.id,name:z.name,typeLabel:ZONE_TYPE_LABELS[z.type],assigned:z.assigned,
    visitsToday:z.visitsToday??NOT_AVAILABLE,visitsWeek:z.visitsWeek??NOT_AVAILABLE,avgDwell:z.avgDwell,inside:z.inside??NOT_AVAILABLE,
    violations:z.violations??'',violationsLabel:z.violations===null?NOT_AVAILABLE:z.violations?`${z.violations} violations`:'None',link:z.link,
  })));
}
