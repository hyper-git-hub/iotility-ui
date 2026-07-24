import { Component, computed, signal } from '@angular/core';
import { DataTable, Dropdown, DropdownOption, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { MaintenanceWorkOrder, STATUS_OPTIONS, WORK_ORDERS } from '../maintenance.data';

@Component({selector:'app-maintenance-work-orders',imports:[DataTable,Dropdown],templateUrl:'./maintenance-work-orders.html',styleUrl:'./maintenance-work-orders.css'})
export class MaintenanceWorkOrders {
  protected readonly total=WORK_ORDERS.length;
  protected readonly selectedOrder=signal<MaintenanceWorkOrder|null>(null);
  protected readonly search=signal('');protected readonly status=signal('all');protected readonly priority=signal('all');protected readonly type=signal('all');protected readonly statusOptions:DropdownOption[]=STATUS_OPTIONS.map((option,index)=>index?option:{...option,label:'All Status'});
  protected readonly priorityOptions:DropdownOption[]=[{id:'all',label:'All Priority'},...['Critical','High','Normal','Low'].map(label=>({id:label,label}))];
  protected readonly typeOptions:DropdownOption[]=[{id:'all',label:'All types'},...['Scheduled','Corrective','Predictive','Driver Reported'].map(label=>({id:label,label}))];
  protected readonly actions:TableAction[]=['view','edit','delete'];
  protected readonly columns:TableColumn[]=[{key:'id',label:'Work Order'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'service',label:'Service'},{key:'type',label:'Type'},{key:'priority',label:'Priority',type:'priority'},{key:'status',label:'Status',type:'status'},{key:'workshop',label:'Workshop'},{key:'target',label:'Target Date'},{key:'cost',label:'Est. Cost'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly filtered=computed(()=>{const query=this.search().toLowerCase();return WORK_ORDERS.filter(item=>(this.status()==='all'||item.status===this.status())&&(this.priority()==='all'||item.priority===this.priority())&&(this.type()==='all'||item.type===this.type())&&(!query||`${item.id} ${item.vehicle} ${item.service} ${item.workshop}`.toLowerCase().includes(query)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(item=>({...item,actions:''})));
  protected selectFilter(control:'status'|'priority'|'type',option:DropdownOption):void{({status:this.status,priority:this.priority,type:this.type})[control].set(option.id);}
  protected filterLabel(options:DropdownOption[],value:string,fallback:string):string{return options.find(option=>option.id===value)?.label??fallback;}
  protected selectOrder(row:TableRow):void{this.selectedOrder.set(WORK_ORDERS.find(order=>order.id===String(row['id']))??null);}
  protected closeDetails():void{this.selectedOrder.set(null);}
  protected workflowStep(order:MaintenanceWorkOrder):number{return ({Raised:1,Assigned:2,Accepted:3,Diagnosing:4,'Awaiting Parts':5,'In Progress':6,'Quality Check':7,Completed:8}[order.status]??1);}
  protected driver(order:MaintenanceWorkOrder):string{return ({'LP-4821':'James Hartley','LP-6612':'Thomas Griffiths','LP-3312':'Oliver Pemberton','LP-5531':'Priya Sharma','LP-2201':'Aisha Okonkwo','LP-9901':'Connor McBride'} as Record<string,string>)[order.vehicle]??'Unassigned';}
  protected actualCost(order:MaintenanceWorkOrder):string{return order.status==='Completed'?order.cost:'—';}
  protected mileage(order:MaintenanceWorkOrder):string{return ({'LP-4821':'102,440 mi','LP-6612':'93,110 mi','LP-3312':'76,205 mi','LP-5531':'72,940 mi','LP-2201':'61,805 mi','LP-9901':'312,800 mi'} as Record<string,string>)[order.vehicle]??'—';}
  protected readonly parts=[{name:'BS/IOT TR3120 GPS Tracker',quantity:1,cost:'£180'},{name:'Engine Mount Set',quantity:1,cost:'£320'},{name:'Brake Pad Set (Front)',quantity:1,cost:'£145'}];
  protected readonly timeline=[{status:'Raised',time:'08:00',detail:'Vehicle offline alert triggered auto work order',by:'System'},{status:'Assigned',time:'08:15',detail:'Assigned to authorised maintenance centre',by:'Ali Mujtaba'},{status:'Accepted',time:'09:00',detail:'Workshop confirmed service slot',by:'Workshop coordinator'},{status:'In Progress',time:'14:15',detail:'Vehicle received, inspection started',by:'Workshop technician'}];
}
