import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';

export interface WorkshopFormValue { name:string;type:string;address:string;phone:string;capacity:number;specialisations:string; }
@Component({selector:'app-workshop-form',imports:[Dropdown,Modal,ReactiveFormsModule],templateUrl:'./workshop-form.html',styleUrl:'./workshop-form.css'})
export class WorkshopForm {
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<WorkshopFormValue>();protected readonly submitted=signal(false);
  protected readonly typeOptions:DropdownOption[]=[{id:'Internal',label:'Internal'},{id:'Vendor',label:'Vendor'}];
  protected readonly form;
  constructor(formBuilder:FormBuilder){this.form=formBuilder.nonNullable.group({name:['',Validators.required],type:['Internal',Validators.required],address:['',Validators.required],phone:[''],capacity:[0,[Validators.required,Validators.min(1)]],specialisations:['']});}
  protected select(option:DropdownOption):void{this.form.controls.type.setValue(option.id);}
  protected invalid(control:keyof typeof this.form.controls):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  protected submit():void{this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid)return;this.created.emit(this.form.getRawValue());this.reset();}
  protected cancel():void{this.reset();this.cancelled.emit();}
  private reset():void{this.form.reset({name:'',type:'Internal',address:'',phone:'',capacity:0,specialisations:''});this.submitted.set(false);}
}
