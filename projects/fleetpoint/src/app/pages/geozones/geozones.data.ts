import { GeozoneApiRecord, GeozoneCircleTerritory, GeozonePoint } from '../../shared/services/geozones-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';

export { NOT_AVAILABLE };

export type GeozoneType = 'allowed'|'restricted'|'speed'|'curfew'|'poi'|'corridor';
export interface GeozoneRecord {
  id:string;name:string;type:GeozoneType;shape:string;assigned:string;
  /** Visit, occupancy, violation and dwell figures aren't part of the geo-zone API. */
  visitsToday:number|null;visitsWeek:number|null;inside:number|null;violations:number|null;avgDwell:string;
  link:string;lat:number;lng:number;
  /** Metres. */
  radius?:number;speed?:number;hours?:string;description:string;
  active:boolean;
  /** Polygon boundary as [lat, lng] pairs. */
  points?:[number,number][];
}
export const ZONE_TYPE_LABELS:Record<GeozoneType,string>={allowed:'Allowed Zone',restricted:'Restricted Zone',speed:'Speed Zone',curfew:'Curfew Zone',poi:'POI Zone',corridor:'Corridor'};

function territory(value:GeozoneApiRecord['territory']):GeozonePoint[]|GeozoneCircleTerritory|null{
  if(typeof value!=='string')return value;
  try{return JSON.parse(value);}catch{return null;}
}

/** Maps a geo-zone onto the page's record: access type 2 is restricted, a POI zone is a POI zone. */
export function toGeozoneRecord(record:GeozoneApiRecord):GeozoneRecord{
  const shape=territory(record.territory);
  const points=Array.isArray(shape)?shape.map(({lat,lng}):[number,number]=>[Number(lat),Number(lng)]):undefined;
  const circle=shape&&!Array.isArray(shape)?shape:null;
  const center:[number,number]=circle?[Number(circle.lat),Number(circle.lng)]:points?.length
    ?[points.reduce((sum,[lat])=>sum+lat,0)/points.length,points.reduce((sum,[,lng])=>sum+lng,0)/points.length]:[0,0];
  const vehicles=(record.assigned_vehicles??[]).map(vehicle=>vehicle.name).filter((name):name is string=>!!name);
  return{
    id:String(record.id),
    name:text(record.name),
    type:record.is_poi?'poi':String(record.access_type)==='2'?'restricted':'allowed',
    shape:String(record.zone_type)==='1'||circle?'Circle':'Polygon',
    // fms-fleet stores a circle's radius in kilometres.
    radius:circle?.radius?Math.round(Number(circle.radius)*1000):undefined,
    assigned:vehicles.length?vehicles.join(', '):NOT_AVAILABLE,
    visitsToday:null,visitsWeek:null,inside:null,violations:null,avgDwell:NOT_AVAILABLE,
    link:record.is_poi?'POI':NOT_AVAILABLE,
    lat:center[0],lng:center[1],points,
    description:text(record.description),
    active:record.status===1,
  };
}
