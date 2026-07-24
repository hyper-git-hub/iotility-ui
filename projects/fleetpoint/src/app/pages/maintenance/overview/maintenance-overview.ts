import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HealthCard { vehicle:string;score:number;condition:string;engine:number;brakes:number;tyres:number;battery:number;faults:string[]; }
interface OverviewOrder { vehicle:string;service:string;workshop:string;status:string; }
interface OverviewPrediction { vehicle:string;urgency:string;component:string;remaining:string;confidence:string;raised:boolean; }

@Component({selector:'app-maintenance-overview',imports:[RouterLink],templateUrl:'./maintenance-overview.html',styleUrl:'./maintenance-overview.css'})
export class MaintenanceOverview {
  protected readonly health:HealthCard[]=[
    {vehicle:'LP-4821',score:82,condition:'Fair',engine:88,brakes:91,tyres:78,battery:85,faults:[]},
    {vehicle:'LP-3312',score:91,condition:'Good',engine:94,brakes:88,tyres:92,battery:90,faults:[]},
    {vehicle:'LP-7734',score:58,condition:'Poor',engine:62,brakes:71,tyres:55,battery:48,faults:['P0171','P0300']},
    {vehicle:'LP-9901',score:31,condition:'Critical',engine:45,brakes:28,tyres:38,battery:22,faults:['P0562','C0035','U0100']},
    {vehicle:'LP-6612',score:87,condition:'Good',engine:91,brakes:89,tyres:88,battery:86,faults:[]},
    {vehicle:'LP-0392',score:64,condition:'Poor',engine:78,brakes:82,tyres:75,battery:71,faults:['B1234']},
    {vehicle:'LP-2244',score:93,condition:'Good',engine:95,brakes:94,tyres:91,battery:92,faults:[]},
    {vehicle:'LP-5531',score:71,condition:'Fair',engine:79,brakes:74,tyres:62,battery:81,faults:['C1234']},
  ];
  protected readonly orders:OverviewOrder[]=[
    {vehicle:'LP-9901',service:'Full Inspection + Device Fault',workshop:'Volvo Truck Centre — Dartford',status:'In Progress'},
    {vehicle:'LP-7734',service:'Full Service + MOT Prep',workshop:'Stratford Internal Workshop',status:'Raised'},
    {vehicle:'LP-0392',service:'Temperature Sensor Calibration + Reefer Unit',workshop:'Volvo Truck Centre — Dartford',status:'Assigned'},
    {vehicle:'LP-5531',service:'Steering Investigation',workshop:'Mercedes-Benz Vans Birmingham',status:'Diagnosing'},
  ];
  protected readonly predictions:OverviewPrediction[]=[
    {vehicle:'LP-9901',urgency:'Critical',component:'Brake System',remaining:'12d',confidence:'91%',raised:true},
    {vehicle:'LP-7734',urgency:'Critical',component:'Engine',remaining:'18d',confidence:'84%',raised:true},
    {vehicle:'LP-0392',urgency:'Critical',component:'Reefer Unit + Temperature Sensor',remaining:'7d',confidence:'96%',raised:true},
    {vehicle:'LP-5531',urgency:'High',component:'Tyres + Wheel Alignment',remaining:'25d',confidence:'78%',raised:true},
    {vehicle:'LP-4821',urgency:'Medium',component:'Tyres',remaining:'50d',confidence:'72%',raised:false},
  ];
  protected tone(score:number):string{return score>=85?'good':score>=70?'fair':score>=40?'poor':'critical';}
  protected components(item:HealthCard){return [{label:'Engine',value:item.engine},{label:'Brakes',value:item.brakes},{label:'Tyres',value:item.tyres},{label:'Battery',value:item.battery}];}
}
