import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';

export interface WorkOrderFormValue {
  vehicle:string;priority:string;type:string;workshop:string;service:string;
  description:string;estimatedCost:number;targetDate:string;
}

@Component({selector:'app-work-order-form',imports:[DateTimePicker,Dropdown,Modal,ReactiveFormsModule],templateUrl:'./work-order-form.html',styleUrl:'./work-order-form.css'})
export class WorkOrderForm {
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<WorkOrderFormValue>();
  protected readonly submitted=signal(false);
  protected readonly vehicleOptions:DropdownOption[]=['LP-4821','LP-6612','LP-3312','LP-5531','LP-2201','LP-2244','LP-9901','LP-7734','LP-0392'].map(label=>({id:label,label}));
  protected readonly priorityOptions:DropdownOption[]=['Critical','High','Normal','Low'].map(label=>({id:label,label}));
  protected readonly typeOptions:DropdownOption[]=['Scheduled','Corrective','Predictive','Driver Reported'].map(label=>({id:label,label}));
  protected readonly workshopOptions:DropdownOption[]=[{id:'',label:'Unassigned'},...['Volvo Truck Centre','Stratford Workshop','Manchester Fleet Care','Aston Fleet Services'].map(label=>({id:label,label}))];
  protected readonly form;
  constructor(formBuilder:FormBuilder){this.form=formBuilder.nonNullable.group({vehicle:['',Validators.required],priority:['Normal',Validators.required],type:['Scheduled',Validators.required],workshop:[''],service:['',Validators.required],description:[''],estimatedCost:[0,[Validators.required,Validators.min(0)]],targetDate:['',Validators.required]});}
  protected select(control:'vehicle'|'priority'|'type'|'workshop',option:DropdownOption):void{this.form.controls[control].setValue(option.id);this.form.controls[control].markAsTouched();}
  protected label(options:DropdownOption[],value:string,fallback:string):string{return options.find(option=>option.id===value)?.label??fallback;}
  protected invalid(control:keyof typeof this.form.controls):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  protected submit():void{this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid)return;this.created.emit(this.form.getRawValue());this.reset();}
  protected cancel():void{this.reset();this.cancelled.emit();}
  private reset():void{this.form.reset({vehicle:'',priority:'Normal',type:'Scheduled',workshop:'',service:'',description:'',estimatedCost:0,targetDate:''});this.submitted.set(false);}
}
