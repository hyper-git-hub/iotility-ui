import { DropdownOption } from '@iotility/shared-ui';

export interface MaintenanceWorkOrder { id:string;vehicle:string;service:string;type:string;priority:string;status:string;workshop:string;target:string;cost:string; }
export interface VehicleHealth { vehicle:string;score:number;condition:string;engine:number;brakes:number;tyres:number;battery:number;faults:string; }
export interface Workshop { id:string;name:string;type:string;location:string;phone:string;capacity:string;available:string;specialisation:string; }
export interface ServiceEntry { id:string;vehicle:string;service:string;completed:string;workshop:string;technician:string;mileage:string;cost:string; }
export interface Prediction { id:string;vehicle:string;component:string;urgency:string;confidence:string;failure:string;days:string;cost:string;action:string;status:string; }

export const WORK_ORDERS:MaintenanceWorkOrder[]=[
  {id:'WO-1048',vehicle:'LP-4821',service:'Brake system inspection',type:'Predictive',priority:'Critical',status:'Diagnosing',workshop:'Volvo Truck Centre',target:'26 Jul 2026',cost:'£850'},
  {id:'WO-1047',vehicle:'LP-6612',service:'Cold-chain unit service',type:'Corrective',priority:'High',status:'In Progress',workshop:'Manchester Fleet Care',target:'25 Jul 2026',cost:'£1,240'},
  {id:'WO-1046',vehicle:'LP-3312',service:'Oil and filter change',type:'Scheduled',priority:'Normal',status:'Assigned',workshop:'Stratford Workshop',target:'28 Jul 2026',cost:'£320'},
  {id:'WO-1045',vehicle:'LP-5531',service:'Battery replacement',type:'Driver Reported',priority:'High',status:'Awaiting Parts',workshop:'Birmingham Auto Works',target:'29 Jul 2026',cost:'£410'},
  {id:'WO-1044',vehicle:'LP-2201',service:'Full annual service',type:'Scheduled',priority:'Normal',status:'Quality Check',workshop:'Aston Fleet Services',target:'24 Jul 2026',cost:'£690'},
  {id:'WO-1043',vehicle:'LP-9901',service:'Tyre replacement',type:'Corrective',priority:'Low',status:'Completed',workshop:'Volvo Truck Centre',target:'22 Jul 2026',cost:'£560'},
  {id:'WO-1042',vehicle:'LP-7734',service:'Engine coolant system repair',type:'Corrective',priority:'Critical',status:'Accepted',workshop:'Manchester Fleet Care',target:'30 Jul 2026',cost:'£1,680'},
  {id:'WO-1041',vehicle:'LP-0392',service:'Temperature sensor calibration',type:'Predictive',priority:'High',status:'Raised',workshop:'Stratford Workshop',target:'01 Aug 2026',cost:'£475'},
];
export const VEHICLE_HEALTH:VehicleHealth[]=[
  {vehicle:'LP-4821',score:42,condition:'Poor',engine:71,brakes:34,tyres:68,battery:76,faults:'P0571'},
  {vehicle:'LP-6612',score:58,condition:'Poor',engine:61,brakes:73,tyres:62,battery:39,faults:'P0562'},
  {vehicle:'LP-3312',score:78,condition:'Fair',engine:82,brakes:75,tyres:70,battery:84,faults:'—'},
  {vehicle:'LP-5531',score:64,condition:'Poor',engine:79,brakes:67,tyres:72,battery:38,faults:'B11DB'},
  {vehicle:'LP-2201',score:91,condition:'Good',engine:94,brakes:88,tyres:89,battery:92,faults:'—'},
  {vehicle:'LP-9901',score:86,condition:'Good',engine:89,brakes:84,tyres:82,battery:90,faults:'—'},
];
export const WORKSHOPS:Workshop[]=[
  {id:'WS-01',name:'Volvo Truck Centre',type:'Vendor',location:'Birmingham B6',phone:'+44 121 555 0182',capacity:'6 bays',available:'2 available',specialisation:'HGV · Brakes · Diagnostics'},
  {id:'WS-02',name:'Stratford Workshop',type:'Internal',location:'London E15',phone:'+44 20 555 0144',capacity:'5 bays',available:'1 available',specialisation:'Routine service · Tyres'},
  {id:'WS-03',name:'Manchester Fleet Care',type:'Vendor',location:'Manchester M17',phone:'+44 161 555 0191',capacity:'8 bays',available:'3 available',specialisation:'Cold-chain · Electrical'},
  {id:'WS-04',name:'Aston Fleet Services',type:'Internal',location:'Birmingham B6',phone:'+44 121 555 0120',capacity:'4 bays',available:'Full',specialisation:'Inspection · General repair'},
];
export const SERVICE_LOG:ServiceEntry[]=[
  {id:'SV-2081',vehicle:'LP-9901',service:'Tyre replacement',completed:'22 Jul 2026',workshop:'Volvo Truck Centre',technician:'Daniel Price',mileage:'84,320 mi',cost:'£560'},
  {id:'SV-2080',vehicle:'LP-4821',service:'Engine diagnostics',completed:'18 Jul 2026',workshop:'Stratford Workshop',technician:'Amir Khan',mileage:'102,440 mi',cost:'£280'},
  {id:'SV-2079',vehicle:'LP-2201',service:'Oil and filter change',completed:'14 Jul 2026',workshop:'Aston Fleet Services',technician:'Sophie Reid',mileage:'61,805 mi',cost:'£310'},
  {id:'SV-2078',vehicle:'LP-6612',service:'Refrigeration calibration',completed:'09 Jul 2026',workshop:'Manchester Fleet Care',technician:'Lewis Grant',mileage:'93,110 mi',cost:'£740'},
  {id:'SV-2077',vehicle:'LP-5531',service:'Brake pad replacement',completed:'02 Jul 2026',workshop:'Volvo Truck Centre',technician:'Daniel Price',mileage:'72,940 mi',cost:'£620'},
];
export const PREDICTIONS:Prediction[]=[
  {id:'PR-301',vehicle:'LP-4821',component:'Brake system',urgency:'Critical',confidence:'96%',failure:'29 Jul 2026',days:'5 days',cost:'£850',action:'Inspect brake pressure sensor and pads immediately',status:'Open'},
  {id:'PR-302',vehicle:'LP-6612',component:'Battery / alternator',urgency:'High',confidence:'91%',failure:'02 Aug 2026',days:'9 days',cost:'£480',action:'Run charging-system diagnostic',status:'WO Raised'},
  {id:'PR-303',vehicle:'LP-5531',component:'Starter battery',urgency:'High',confidence:'88%',failure:'05 Aug 2026',days:'12 days',cost:'£410',action:'Schedule battery replacement',status:'Open'},
  {id:'PR-304',vehicle:'LP-3312',component:'Front tyres',urgency:'Medium',confidence:'82%',failure:'18 Aug 2026',days:'25 days',cost:'£520',action:'Inspect tread depth at next service',status:'Open'},
];
export const STATUS_OPTIONS:DropdownOption[]=[{id:'all',label:'All statuses'},...['Raised','Assigned','Diagnosing','Awaiting Parts','In Progress','Quality Check','Completed'].map(label=>({id:label,label}))];
