import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface PredictionCard {
  vehicle:string;component:string;urgency:'Critical'|'High'|'Medium';confidence:number;
  failure:string;remaining:string;cost:string;reasoning:string;action:string;raised:boolean;
  mileage:string;driverScore:number;faults:string[];serviceAge:string;
}

@Component({selector:'app-maintenance-predictions',templateUrl:'./maintenance-predictions.html',styleUrl:'./maintenance-predictions.css'})
export class MaintenancePredictions {
  constructor(private readonly router:Router){}
  protected readonly predictions:PredictionCard[]=[
    {vehicle:'LP-9901',component:'Brake System',urgency:'Critical',confidence:91,failure:'02 Jun 2026',remaining:'12 days',cost:'£420',reasoning:'Brake pads at 18% remaining. Driver braking events are above fleet average. CAN bus wheel-speed sensor fault C0035 detected.',action:'Replace brake pads immediately. Inspect rotors and investigate the C0035 fault.',raised:true,mileage:'28,400 mi since service',driverScore:72,faults:['C0035'],serviceAge:'142 days since service'},
    {vehicle:'LP-7734',component:'Engine',urgency:'Critical',confidence:84,failure:'08 Jun 2026',remaining:'18 days',cost:'£1,800',reasoning:'CAN bus faults P0171 and P0300 are active. Coolant temperature is above normal range and oil pressure is low.',action:'Urgently investigate engine fault codes and fuel injectors. Do not dispatch until inspected.',raised:true,mileage:'42,800 mi since service',driverScore:91,faults:['P0171','P0300'],serviceAge:'198 days since service'},
    {vehicle:'LP-0392',component:'Reefer Unit + Temperature Sensor',urgency:'Critical',confidence:96,failure:'28 May 2026',remaining:'7 days',cost:'£890',reasoning:'Temperature sensor exceeds the cold-chain limit. CAN bus code B1234 is active and the reefer compressor is drawing excess current.',action:'Cold-chain risk: replace the temperature sensor and complete a full reefer-unit inspection.',raised:true,mileage:'12,400 mi since service',driverScore:83,faults:['B1234'],serviceAge:'45 days since service'},
    {vehicle:'LP-5531',component:'Tyres + Wheel Alignment',urgency:'High',confidence:78,failure:'15 Jun 2026',remaining:'25 days',cost:'£420',reasoning:'Driver reported steering vibration. Front nearside tyre pressure is low and abnormal wear suggests a wheel-alignment issue.',action:'Replace the front nearside tyre, complete wheel alignment and inspect the steering rack.',raised:true,mileage:'18,400 mi since service',driverScore:89,faults:['C1234'],serviceAge:'88 days since service'},
    {vehicle:'LP-4821',component:'Tyres',urgency:'Medium',confidence:72,failure:'10 Jul 2026',remaining:'50 days',cost:'£580',reasoning:'Rear tyre tread is approaching the minimum limit based on mileage rate. Tyre pressure is slightly low and driving behaviour may accelerate wear.',action:'Monitor tyre pressure weekly and schedule tyre replacement within 50 days.',raised:false,mileage:'8,200 mi since service',driverScore:94,faults:[],serviceAge:'3 days since service'},
  ];
  protected viewVehicle():void{void this.router.navigateByUrl('/fleetpoint/vehicles/vehicle-detail');}
}
