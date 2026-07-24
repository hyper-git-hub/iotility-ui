import { DropdownOption } from '@iotility/shared-ui';

export type RunStatus = 'Scheduled' | 'En Route' | 'Completed' | 'Cancelled';
export interface RouteRecord { id:string;name:string;start:string;end:string;stops:number;distance:string;duration:string;fleet:string;template:string;compliance:number;runs:number; }
export interface RunRecord { id:string;routeId:string;route:string;driver:string;vehicle:string;status:RunStatus;dispatch:string;scheduled:string;stops:string;compliance:string;deviations:number; }
export interface RouteStop { name:string;address:string;dwell:string; }

export const ROUTES: RouteRecord[] = [
  { id:'RT-001',name:'London → Birmingham Express',start:'Stratford Logistics Park',end:'Amazon BHX2',stops:3,distance:'126 mi',duration:'2h 45m',fleet:'London Delivery Fleet',template:'Template',compliance:96,runs:84 },
  { id:'RT-002',name:'Manchester Cold Chain',start:'Trafford Park DC',end:'Tilbury Cold Storage',stops:4,distance:'212 mi',duration:'4h 20m',fleet:'Northern Distribution',template:'Template',compliance:91,runs:52 },
  { id:'RT-003',name:'Midlands Depot Loop',start:'Aston Depot',end:'Aston Depot',stops:7,distance:'74 mi',duration:'3h 10m',fleet:'Midlands Operations',template:'Recurring',compliance:88,runs:126 },
  { id:'RT-004',name:'Leeds Northbound Transfer',start:'Stourton Hub',end:'Trafford Park DC',stops:2,distance:'49 mi',duration:'1h 15m',fleet:'Northern Distribution',template:'Template',compliance:94,runs:68 },
  { id:'RT-005',name:'London Customer Circuit',start:'Stratford Logistics Park',end:'Stratford Logistics Park',stops:9,distance:'58 mi',duration:'4h 30m',fleet:'London Delivery Fleet',template:'Recurring',compliance:86,runs:142 },
  { id:'RT-006',name:'Birmingham Airport Supply',start:'Aston Depot',end:'Birmingham Airport',stops:3,distance:'22 mi',duration:'55m',fleet:'Midlands Operations',template:'Template',compliance:98,runs:39 },
];
export const RUNS: RunRecord[] = [
  { id:'RUN-1042',routeId:'RT-001',route:'London → Birmingham Express',driver:'James Hartley',vehicle:'LP-4821',status:'En Route',dispatch:'Auto',scheduled:'06:00 → 09:30',stops:'2/3',compliance:'96%',deviations:1 },
  { id:'RUN-1043',routeId:'RT-002',route:'Manchester Cold Chain',driver:'Thomas Griffiths',vehicle:'LP-6612',status:'En Route',dispatch:'Suggested',scheduled:'07:00 → 13:00',stops:'2/4',compliance:'89%',deviations:2 },
  { id:'RUN-1044',routeId:'RT-003',route:'Midlands Depot Loop',driver:'Aisha Okonkwo',vehicle:'LP-2201',status:'Scheduled',dispatch:'Manual',scheduled:'10:00 → 15:00',stops:'0/7',compliance:'—',deviations:0 },
  { id:'RUN-1045',routeId:'RT-004',route:'Leeds Northbound Transfer',driver:'Mohammed Al-Rashid',vehicle:'LP-3388',status:'Scheduled',dispatch:'Auto',scheduled:'15:00 → 19:00',stops:'0/2',compliance:'—',deviations:0 },
  { id:'RUN-1038',routeId:'RT-006',route:'Birmingham Airport Supply',driver:'Priya Sharma',vehicle:'LP-5531',status:'Completed',dispatch:'Auto',scheduled:'05:30 → 06:25',stops:'3/3',compliance:'98%',deviations:0 },
  { id:'RUN-1037',routeId:'RT-005',route:'London Customer Circuit',driver:'Oliver Pemberton',vehicle:'LP-3312',status:'Completed',dispatch:'Manual',scheduled:'06:30 → 11:00',stops:'9/9',compliance:'84%',deviations:3 },
];
export const FLEET_OPTIONS: DropdownOption[] = [{id:'all',label:'All fleets'},{id:'London Delivery Fleet',label:'London Delivery Fleet'},{id:'Northern Distribution',label:'Northern Distribution'},{id:'Midlands Operations',label:'Midlands Operations'}];
export const STATUS_OPTIONS: DropdownOption[] = [{id:'all',label:'All statuses'},{id:'Scheduled',label:'Scheduled'},{id:'En Route',label:'En Route'},{id:'Completed',label:'Completed'},{id:'Cancelled',label:'Cancelled'}];
export const STOPS_BY_ROUTE: Record<string,RouteStop[]> = {
  'RT-001':[{name:'Stratford Park — Load',address:'Stratford Logistics Park',dwell:'25min'},{name:'Oxford — Stop 1',address:'Oxford Services',dwell:'15min'},{name:'Birmingham — Stop 2',address:'Bordesley',dwell:'20min'},{name:'Amazon BHX2 — Finish',address:'Birmingham B26',dwell:'20min'}],
  'RT-002':[{name:'Trafford Park — Load',address:'Manchester M17',dwell:'30min'},{name:'Sheffield — Stop 1',address:'Tinsley Industrial',dwell:'20min'},{name:'Leicester — Stop 2',address:'Leicester North',dwell:'20min'},{name:'Tilbury — Finish',address:'Tilbury Cold Storage',dwell:'35min'}],
  'RT-003':[{name:'Aston Depot — Load',address:'Aston Industrial Estate',dwell:'20min'},{name:'Digbeth — Stop 1',address:'Digbeth Industrial',dwell:'20min'},{name:'Sparkbrook — Stop 2',address:'Sparkbrook',dwell:'20min'},{name:'Bordesley — Stop 3',address:'Bordesley',dwell:'20min'},{name:'Aston Depot — Return',address:'Aston Industrial Estate',dwell:'10min'}],
};
