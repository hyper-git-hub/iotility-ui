import { Component,computed,signal } from '@angular/core';
import { DataTable,TableAction,TableColumn,TableRow } from '@iotility/shared-ui';
import { VIOLATIONS } from '../violations.data';
@Component({selector:'app-violation-fines',imports:[DataTable],templateUrl:'./violation-fines.html',styleUrl:'./violation-fines.css'})
export class ViolationFines {
  protected readonly search=signal('');protected readonly actions:TableAction[]=['view','edit'];protected readonly fines=VIOLATIONS.filter(item=>item.fine>0);
  protected readonly columns:TableColumn[]=[{key:'id',label:'Reference'},{key:'type',label:'Violation'},{key:'driver',label:'Driver'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'timestamp',label:'Date'},{key:'fine',label:'Fine Amount'},{key:'fineStatus',label:'Status',type:'status'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly rows=computed<TableRow[]>(()=>{const query=this.search().toLowerCase();return this.fines.filter(item=>!query||`${item.type} ${item.driver} ${item.vehicle}`.toLowerCase().includes(query)).map(item=>({...item,fine:`£${item.fine}`,actions:''}));});
}
