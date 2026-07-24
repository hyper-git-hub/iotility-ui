import { Component, signal } from '@angular/core';
import { WorkshopForm, WorkshopFormValue } from '../workshop-form/workshop-form';

interface WorkshopCard { name:string;city:string;type:'Internal'|'Vendor';used:number;capacity:number;address:string;phone:string;specialisations:string[]; }

@Component({selector:'app-maintenance-workshops',imports:[WorkshopForm],templateUrl:'./maintenance-workshops.html',styleUrl:'./maintenance-workshops.css'})
export class MaintenanceWorkshops {
  protected readonly formOpen=signal(false);
  protected readonly workshops:WorkshopCard[]=[
    {name:'Stratford Internal Workshop',city:'London',type:'Internal',used:3,capacity:6,address:'Stratford Logistics Park, London E15 2NW',phone:'+44 20 7946 0100',specialisations:['HGV Service','Tyres','Brake Systems','Electrical']},
    {name:'Volvo Truck Centre — Dartford',city:'Kent',type:'Vendor',used:7,capacity:12,address:'Volvo Truck Centre, Thames Road, Dartford DA1 5NL',phone:'+44 1322 287000',specialisations:['Volvo FH','Volvo FM','Warranty Work','Engine Diagnostics']},
    {name:'DAF Trucks Manchester',city:'Manchester',type:'Vendor',used:4,capacity:8,address:'DAF Trucks, Trafford Park, Manchester M17 1EH',phone:'+44 161 872 3000',specialisations:['DAF XF','DAF CF','Transmission','Tachograph']},
    {name:'Mercedes-Benz Vans Birmingham',city:'Birmingham',type:'Vendor',used:5,capacity:10,address:'Mercedes-Benz Vans, Aston, Birmingham B6 7SY',phone:'+44 121 523 4000',specialisations:['Sprinter','Vito','Transit Van','Electric Vans']},
  ];
  protected readonly internalCount=this.workshops.filter(item=>item.type==='Internal').length;
  protected percentage(item:WorkshopCard):number{return Math.round(item.used/item.capacity*100);}
  protected create(_:WorkshopFormValue):void{this.formOpen.set(false);}
}
