import { Component, signal } from '@angular/core';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { ROUTES } from '../routes.data';
@Component({selector:'app-route-dispatch',imports:[DateTimePicker,Dropdown],templateUrl:'./route-dispatch.html',styleUrl:'./route-dispatch.css'})
export class RouteDispatch {
  protected readonly mode=signal<'manual'|'suggested'|'auto'>('manual');protected readonly route=signal('');protected readonly driver=signal('');protected readonly vehicle=signal('');protected readonly job=signal('');protected readonly start=signal('');protected readonly end=signal('');
  protected readonly routeOptions:DropdownOption[]=ROUTES.map(r=>({id:r.id,label:r.name}));
  protected readonly driverOptions:DropdownOption[]=['James Hartley','Oliver Pemberton','Mohammed Al-Rashid','Sarah Whitfield','Connor McBride','Priya Sharma','Thomas Griffiths','Aisha Okonkwo'].map(label=>({id:label,label}));
  protected readonly vehicleOptions:DropdownOption[]=['LP-4821','LP-3312','LP-7734','LP-2244','LP-9901','LP-5531','LP-6612','LP-2201'].map(label=>({id:label,label}));
  protected readonly jobOptions:DropdownOption[]=[{id:'',label:'No job linked'},{id:'JOB001',label:'JOB001 · Amazon BHX2 Delivery'},{id:'JOB003',label:'JOB003 · Manchester Collection'},{id:'JOB007',label:'JOB007 · Northbound Transfer'}];
  protected readonly availability=[{initials:'JH',name:'James Hartley',vehicle:'LP-4821',score:94,status:'Available'},{initials:'OP',name:'Oliver Pemberton',vehicle:'LP-3312',score:87,status:'Available'},{initials:'MA',name:'Mohammed Al-Rashid',vehicle:'LP-7734',score:91,status:'Scheduled'},{initials:'SW',name:'Sarah Whitfield',vehicle:'LP-2244',score:96,status:'En Route'},{initials:'CM',name:'Connor McBride',vehicle:'LP-9901',score:72,status:'Available'},{initials:'PS',name:'Priya Sharma',vehicle:'LP-5531',score:89,status:'Available'},{initials:'TG',name:'Thomas Griffiths',vehicle:'LP-6612',score:83,status:'En Route'},{initials:'AO',name:'Aisha Okonkwo',vehicle:'LP-2201',score:98,status:'Scheduled'}];
  protected select(control:'route'|'driver'|'vehicle'|'job',option:DropdownOption){({route:this.route,driver:this.driver,vehicle:this.vehicle,job:this.job})[control].set(option.id);}
  protected label(options:DropdownOption[],value:string,fallback:string){return options.find(o=>o.id===value)?.label??fallback;}
}
