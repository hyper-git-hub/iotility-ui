import { Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption, SmoothHeight } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';
import { CreateGeozonePayload } from '../../../shared/services/geozones-api.service';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { GeozoneDrawingMap,GeozoneGeometry } from './geozone-drawing-map';

export interface GeozoneFormValue {
  type:string; name:string; description:string; shape:string; radius:number; geometry:string;
  alertOnEntry:boolean; alertOnExit:boolean; speedLimit:number|null; maxDwell:number|null;
  curfewStart:string; curfewEnd:string; assignment:string; assignedTarget:string; poi:string; route:string;
  /** Vehicle ids the assignment resolves to. */
  vehicles:number[];
}

/** The geo-zone API keeps access type, POI flag, shape and vehicles; rules, curfew and links aren't sent. */
export function toCreateGeozonePayload(value:GeozoneFormValue):CreateGeozonePayload{
  const geometry:GeozoneGeometry=JSON.parse(value.geometry);
  const center=geometry.shape==='circle'?geometry.center:undefined;
  return{
    name:value.name.trim(),
    description:value.description.trim(),
    access_type:value.type==='restricted'?2:1,
    is_poi:value.type==='poi',
    status:1,
    vehicle:value.vehicles,
    zone_type:center?1:2,
    // fms-fleet takes a circle's radius in kilometres.
    territory:JSON.stringify(center
      ?{lat:center.latitude,lng:center.longitude,radius:(geometry.radius??value.radius)/1000}
      :(geometry.points??[]).map(point=>({lat:point.latitude,lng:point.longitude}))),
  };
}

@Component({
  selector:'app-geozone-form',
  imports:[DateTimePicker,Dropdown,GeozoneDrawingMap,Modal,ReactiveFormsModule,SmoothHeight,Stepper],
  templateUrl:'./geozone-form.html',
  styleUrl:'./geozone-form.css',
})
export class GeozoneForm {
  readonly open=input(false);
  readonly saving=input(false);
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
    {id:'vehicle',label:'Specific vehicle'},
  ];
  /** Fleets with their assigned vehicles; a geo-zone is assigned to vehicles. */
  private readonly fleets=toSignal(inject(RoutesApiService).fleets(),{initialValue:[]});
  protected readonly fleetOptions=computed<DropdownOption[]>(()=>this.fleets().map(fleet=>({id:String(fleet.id),label:fleet.name})));
  protected readonly vehicleOptions=computed<DropdownOption[]>(()=>this.fleets().flatMap(fleet=>fleet.vehicles.map(vehicle=>({id:String(vehicle.id),label:vehicle.name}))));
  /** The geo-zone API has no POI or route link. */
  protected readonly poiOptions:DropdownOption[]=[{id:'',label:'No POI link'}];
  protected readonly routeOptions:DropdownOption[]=[{id:'',label:'No route link'}];
  protected readonly form;

  constructor(formBuilder:FormBuilder){
    this.form=formBuilder.nonNullable.group({
      type:['allowed',Validators.required],name:['',Validators.required],description:['',Validators.required],
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
  protected assignmentTargets():DropdownOption[]{return this.form.controls.assignment.value==='fleet'?this.fleetOptions():this.vehicleOptions();}
  protected goToStep(index:number):void{this.activeStep.set(index);}
  protected next():void{this.submitted.set(true);if(!this.stepValid())return;this.submitted.set(false);this.activeStep.update(step=>Math.min(3,step+1));}
  protected back():void{if(this.activeStep()===0){this.cancel();return;}this.submitted.set(false);this.activeStep.update(step=>step-1);}
  protected submit():void{this.submitted.set(true);if(this.saving()||this.form.invalid||!this.assignmentValid())return;this.created.emit({...this.form.getRawValue(),vehicles:this.assignedVehicles()});}
  protected cancel():void{this.reset();this.cancelled.emit();}
  protected invalid(control:'name'|'description'|'radius'):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  private stepValid():boolean{
    if(this.activeStep()===1){this.form.controls.name.markAsTouched();this.form.controls.description.markAsTouched();this.form.controls.radius.markAsTouched();this.form.controls.geometry.markAsTouched();return !this.form.controls.name.invalid&&!this.form.controls.description.invalid&&!this.form.controls.radius.invalid&&!this.form.controls.geometry.invalid;}
    return this.activeStep()!==3||this.assignmentValid();
  }
  private assignmentValid():boolean{return this.form.controls.assignment.value==='all'||!!this.form.controls.assignedTarget.value;}
  private assignedVehicles():number[]{
    const {assignment,assignedTarget}=this.form.getRawValue();
    if(assignment==='vehicle')return [Number(assignedTarget)];
    const fleets=assignment==='fleet'?this.fleets().filter(fleet=>String(fleet.id)===assignedTarget):this.fleets();
    return [...new Set(fleets.flatMap(fleet=>fleet.vehicles.map(vehicle=>vehicle.id)))];
  }
  private reset():void{
    this.form.reset({type:'allowed',name:'',description:'',shape:'circle',radius:250,geometry:'',alertOnEntry:false,alertOnExit:true,speedLimit:null,maxDwell:null,curfewStart:'',curfewEnd:'',assignment:'all',assignedTarget:'',poi:'',route:''});
    this.activeStep.set(0);this.submitted.set(false);
  }
}
