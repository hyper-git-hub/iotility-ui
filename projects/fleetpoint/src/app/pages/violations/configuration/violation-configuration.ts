import { Component,signal } from '@angular/core';
import { Dropdown,DropdownOption } from '@iotility/shared-ui';
@Component({selector:'app-violation-configuration',imports:[Dropdown],templateUrl:'./violation-configuration.html',styleUrl:'./violation-configuration.css'})
export class ViolationConfiguration {
  protected readonly fleet=signal('London Delivery Fleet');
  protected readonly fleetOptions:DropdownOption[]=['London Delivery Fleet','Northern Distribution','Midlands Operations'].map(label=>({id:label,label}));
  protected readonly speedRules=[{label:'Alert threshold',value:65,unit:'mph',description:'Approaching limit — driver notified',tone:'warning'},{label:'Violation threshold',value:72,unit:'mph',description:'Limit exceeded — violation created',tone:'danger'},{label:'Critical threshold',value:85,unit:'mph',description:'Immediate fleet-manager alert',tone:'critical'}];
  protected readonly behaviourRules=[{label:'Harsh Braking',value:'0.45 g',description:'Deceleration threshold'},{label:'Harsh Acceleration',value:'0.40 g',description:'Acceleration threshold'},{label:'Harsh Cornering',value:'0.38 g',description:'Lateral g-force threshold'},{label:'Idling Limit',value:'10 min',description:'Engine on while stationary'}];
  protected readonly types=signal([{label:'Speeding',enabled:true},{label:'Harsh Braking',enabled:true},{label:'Harsh Acceleration',enabled:true},{label:'Harsh Cornering',enabled:true},{label:'Extended Idling',enabled:true},{label:'Mobile Phone Use',enabled:true},{label:'Seatbelt',enabled:true},{label:'Geozone Violations',enabled:false}]);
  protected selectFleet(option:DropdownOption):void{this.fleet.set(option.id);}
  protected toggle(index:number):void{this.types.update(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,enabled:!item.enabled}:item));}
}
