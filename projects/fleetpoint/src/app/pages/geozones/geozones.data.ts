export type GeozoneType = 'allowed'|'restricted'|'speed'|'curfew'|'poi'|'corridor';
export interface GeozoneRecord {
  id:string;name:string;type:GeozoneType;shape:string;assigned:string;visitsToday:number;
  visitsWeek:number;inside:number;violations:number;avgDwell:string;link:string;lat:number;lng:number;
  radius?:number;speed?:number;hours?:string;description:string;
}
export const GEOZONES:GeozoneRecord[]=[
  {id:'GZ-01',name:'Stratford Logistics Park — Depot',type:'allowed',shape:'Circle',radius:250,assigned:'All Vehicles',visitsToday:8,visitsWeek:42,inside:2,violations:0,avgDwell:'34 min',link:'POI',lat:51.542,lng:-0.003,description:'Primary logistics depot boundary'},
  {id:'GZ-02',name:'Trafford Park DC — Manchester',type:'allowed',shape:'Circle',radius:200,assigned:'Manchester Vans',visitsToday:5,visitsWeek:28,inside:1,violations:0,avgDwell:'22 min',link:'POI',lat:53.467,lng:-2.311,description:'Manchester distribution centre'},
  {id:'GZ-03',name:'Birmingham Depot Zone B — Restricted',type:'restricted',shape:'Polygon',assigned:'London HGV',visitsToday:1,visitsWeek:3,inside:0,violations:3,avgDwell:'12 min',link:'—',lat:52.501,lng:-1.884,description:'Restricted depot access zone'},
  {id:'GZ-04',name:'High Risk Zone — East London',type:'restricted',shape:'Circle',radius:300,hours:'20:00–06:00',assigned:'All Vehicles',visitsToday:0,visitsWeek:1,inside:0,violations:1,avgDwell:'8 min',link:'—',lat:51.52,lng:0.04,description:'After-hours restricted area'},
  {id:'GZ-05',name:'Stratford Depot Yard — 5mph Zone',type:'speed',shape:'Polygon',speed:8,assigned:'All Vehicles',visitsToday:12,visitsWeek:58,inside:2,violations:4,avgDwell:'18 min',link:'POI',lat:51.544,lng:-0.008,description:'Low-speed depot yard'},
  {id:'GZ-06',name:'ULEZ — Central London',type:'curfew',shape:'Circle',radius:6000,assigned:'All Vehicles',visitsToday:6,visitsWeek:31,inside:3,violations:0,avgDwell:'142 min',link:'POI',lat:51.507,lng:-0.128,description:'Central London operating curfew'},
  {id:'GZ-07',name:'Amazon BHX2 — Customer Site Boundary',type:'poi',shape:'Circle',radius:300,assigned:'All Vehicles',visitsToday:4,visitsWeek:21,inside:0,violations:2,avgDwell:'78 min',link:'POI',lat:52.455,lng:-1.743,description:'Customer-site job tracking boundary'},
  {id:'GZ-08',name:'London → Birmingham Corridor',type:'corridor',shape:'Corridor',assigned:'London HGV',visitsToday:3,visitsWeek:16,inside:1,violations:1,avgDwell:'0 min',link:'Route',lat:52.05,lng:-1.0,description:'Route deviation monitoring corridor'},
];
export const ZONE_TYPE_LABELS:Record<GeozoneType,string>={allowed:'Allowed Zone',restricted:'Restricted Zone',speed:'Speed Zone',curfew:'Curfew Zone',poi:'POI Zone',corridor:'Corridor'};
