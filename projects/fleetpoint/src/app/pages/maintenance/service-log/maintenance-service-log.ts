import { Component } from '@angular/core';
import { DataTable, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { SERVICE_LOG } from '../maintenance.data';

@Component({selector:'app-maintenance-service-log',imports:[DataTable],templateUrl:'./maintenance-service-log.html',styleUrl:'./maintenance-service-log.css'})
export class MaintenanceServiceLog {
  protected readonly actions:TableAction[]=['view'];protected readonly rows:TableRow[]=SERVICE_LOG.map(item=>({...item,actions:''}));
  protected readonly columns:TableColumn[]=[{key:'id',label:'Service ID'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'service',label:'Service Completed'},{key:'completed',label:'Completion Date'},{key:'workshop',label:'Workshop'},{key:'technician',label:'Technician'},{key:'mileage',label:'Odometer'},{key:'cost',label:'Cost'},{key:'actions',label:'Actions',type:'actions'}];
}
