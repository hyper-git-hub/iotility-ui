import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption, SmoothHeight } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';
import { GeozoneDrawingMap,GeozoneGeometry } from './geozone-drawing-map';

export interface GeozoneFormValue {
  type:string; name:string; description:string; shape:string; radius:number; geometry:string;
  alertOnEntry:boolean; alertOnExit:boolean; speedLimit:number|null; maxDwell:number|null;
  curfewStart:string; curfewEnd:string; assignment:string; assignedTarget:string; poi:string; route:string;
}

@Component({
  selector:'app-geozone-form',
  imports:[DateTimePicker,Dropdown,GeozoneDrawingMap,Modal,ReactiveFormsModule,SmoothHeight,Stepper],
  templateUrl:'./geozone-form.html',
  styleUrl:'./geozone-form.css',
})
export class GeozoneForm {
  readonly open=input(false);
  readonly cancelled=output<void>();
  readonly created=output<GeozoneFormValue>();
  protected readonly activeStep=signal(0);
  protected readonly submitted=signal(false);
  protected readonly steps:StepperStep[]=[
    {id:'type',label:'Zone Type',description:'Choose behaviour'},
    {id:'details',label:'Details',description:'Name and shape'},
    {id:'rules',label:'Rules',description:'Alerts and limits'},
    {id:'assignment',label:'Assignment',description:'Vehicles and links'},
  ];
  protected readonly zoneTypes=[
    {id:'allowed',label:'Allowed Zone',description:'Vehicles should remain inside',icon:'check'},
    {id:'restricted',label:'Restricted Zone',description:'Violation when a vehicle enters',icon:'shield'},
    {id:'speed',label:'Speed Zone',description:'Apply a local speed limit',icon:'bolt'},
    {id:'curfew',label:'Curfew Zone',description:'Rules active during set hours',icon:'clock'},
    {id:'poi',label:'POI Zone',description:'Track visits and dwell time',icon:'pin'},
    {id:'corridor',label:'Corridor',description:'Monitor route deviation',icon:'route'},
  ];
  protected readonly assignmentOptions:DropdownOption[]=[
    {id:'all',label:'All vehicles'},{id:'fleet',label:'Specific fleet'},
    {id:'vehicle',label:'Specific vehicle'},{id:'driver',label:'Specific driver'},
  ];
  protected readonly fleetOptions:DropdownOption[]=[
    {id:'london',label:'London Delivery Fleet'},{id:'midlands',label:'Midlands Operations'},{id:'north',label:'Northern Distribution'},
  ];
  protected readonly vehicleOptions:DropdownOption[]=[
    {id:'LP-4821',label:'LP-4821'},{id:'LP-7734',label:'LP-7734'},{id:'LP-9901',label:'LP-9901'},
  ];
  protected readonly driverOptions:DropdownOption[]=[
    {id:'james',label:'James Wilson'},{id:'mohammed',label:'Mohammed Al-Rashid'},{id:'aisha',label:'Aisha Khan'},
  ];
  protected readonly poiOptions:DropdownOption[]=[
    {id:'',label:'No POI link'},{id:'stratford',label:'Stratford Logistics Park — HQ'},
    {id:'amazon',label:'Amazon BHX2 Fulfilment Centre'},{id:'tesco',label:'Tesco RDC — Daventry'},
  ];
  protected readonly routeOptions:DropdownOption[]=[
    {id:'',label:'No route link'},{id:'london-birmingham',label:'London → Birmingham Express'},
    {id:'cold-chain',label:'Cold Chain — London to Tilbury'},{id:'manchester',label:'Manchester Urban Van Loop'},
  ];
  protected readonly form;

  constructor(formBuilder:FormBuilder){
    this.form=formBuilder.nonNullable.group({
      type:['allowed',Validators.required],name:['',Validators.required],description:[''],
      shape:formBuilder.control<'circle'|'polygon'>('circle',{nonNullable:true,validators:[Validators.required]}),
      radius:[250,[Validators.required,Validators.min(10)]],geometry:['',Validators.required],
      alertOnEntry:[false],alertOnExit:[true],speedLimit:formBuilder.control<number|null>(null),
      maxDwell:formBuilder.control<number|null>(null),curfewStart:[''],curfewEnd:[''],
      assignment:['all',Validators.required],assignedTarget:[''],poi:[''],route:[''],
    });
  }
  protected chooseType(type:string):void{this.form.controls.type.setValue(type);}
  protected chooseShape(shape:'circle'|'polygon'):void{this.form.controls.shape.setValue(shape);this.form.controls.geometry.setValue('');}
  protected setGeometry(geometry:GeozoneGeometry):void{
    this.form.controls.geometry.setValue(JSON.stringify(geometry));
    if(geometry.radius)this.form.controls.radius.setValue(geometry.radius);
    this.form.controls.geometry.markAsTouched();
  }
  protected clearGeometry():void{this.form.controls.geometry.setValue('');}
  protected select(control:'assignment'|'assignedTarget'|'poi'|'route',option:DropdownOption):void{
    this.form.controls[control].setValue(option.id);
    if(control==='assignment')this.form.controls.assignedTarget.setValue('');
  }
  protected label(options:DropdownOption[],value:string,fallback:string):string{return options.find(option=>option.id===value)?.label??fallback;}
  protected assignmentTargets():DropdownOption[]{return this.form.controls.assignment.value==='fleet'?this.fleetOptions:this.form.controls.assignment.value==='driver'?this.driverOptions:this.vehicleOptions;}
  protected goToStep(index:number):void{this.activeStep.set(index);}
  protected next():void{this.submitted.set(true);if(!this.stepValid())return;this.submitted.set(false);this.activeStep.update(step=>Math.min(3,step+1));}
  protected back():void{if(this.activeStep()===0){this.cancel();return;}this.submitted.set(false);this.activeStep.update(step=>step-1);}
  protected submit():void{this.submitted.set(true);if(this.form.invalid||!this.assignmentValid())return;this.created.emit(this.form.getRawValue());this.reset();}
  protected cancel():void{this.reset();this.cancelled.emit();}
  protected invalid(control:'name'|'radius'):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  private stepValid():boolean{
    if(this.activeStep()===1){this.form.controls.name.markAsTouched();this.form.controls.radius.markAsTouched();this.form.controls.geometry.markAsTouched();return !this.form.controls.name.invalid&&!this.form.controls.radius.invalid&&!this.form.controls.geometry.invalid;}
    return this.activeStep()!==3||this.assignmentValid();
  }
  private assignmentValid():boolean{return this.form.controls.assignment.value==='all'||!!this.form.controls.assignedTarget.value;}
  private reset():void{
    this.form.reset({type:'allowed',name:'',description:'',shape:'circle',radius:250,geometry:'',alertOnEntry:false,alertOnExit:true,speedLimit:null,maxDwell:null,curfewStart:'',curfewEnd:'',assignment:'all',assignedTarget:'',poi:'',route:''});
    this.activeStep.set(0);this.submitted.set(false);
  }
}
