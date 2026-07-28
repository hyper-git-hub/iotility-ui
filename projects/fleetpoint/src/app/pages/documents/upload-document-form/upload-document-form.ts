import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';

export interface UploadDocumentValue {
  type:string;linkedTo:string;fileName:string;issueDate:string;expiryDate:string;
  issuedBy:string;documentNumber:string;
}

@Component({
  selector:'app-upload-document-form',
  imports:[DateTimePicker,Dropdown,Modal,ReactiveFormsModule],
  templateUrl:'./upload-document-form.html',
  styleUrl:'./upload-document-form.css',
})
export class UploadDocumentForm {
  readonly open=input(false);
  readonly cancelled=output<void>();
  readonly created=output<UploadDocumentValue>();
  protected readonly submitted=signal(false);
  protected readonly fileName=signal('');
  protected readonly typeOptions:DropdownOption[]=[
    'MOT Certificate','Vehicle Insurance','Road Tax','V5C Registration','Driving Licence','CPC Card',
    'Medical Certificate','Operator Licence','Fleet Insurance Policy','FORS Certificate',
  ].map(label=>({id:label,label}));
  protected readonly linkedOptions:DropdownOption[]=[
    'LogisticsPro','LP-7734','LP-4821','LP-9901','LP-3312','Mohammed Al-Rashid','James Wilson','Aisha Khan',
  ].map(label=>({id:label,label}));
  protected readonly form;
  constructor(formBuilder:FormBuilder){
    this.form=formBuilder.nonNullable.group({
      type:['',Validators.required],linkedTo:['',Validators.required],issueDate:[''],expiryDate:[''],
      issuedBy:[''],documentNumber:[''],
    });
  }
  protected select(control:'type'|'linkedTo',option:DropdownOption):void{
    this.form.controls[control].setValue(option.id);this.form.controls[control].markAsTouched();
  }
  protected label(options:DropdownOption[],value:string,fallback:string):string{
    return options.find(option=>option.id===value)?.label??fallback;
  }
  protected pickFile(event:Event):void{this.fileName.set((event.target as HTMLInputElement).files?.[0]?.name??'');}
  protected invalid(control:'type'|'linkedTo'):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  protected submit():void{
    this.submitted.set(true);this.form.markAllAsTouched();
    if(this.form.invalid||!this.fileName())return;
    this.created.emit({...this.form.getRawValue(),fileName:this.fileName()});this.reset();
  }
  protected cancel():void{this.reset();this.cancelled.emit();}
  private reset():void{
    this.form.reset({type:'',linkedTo:'',issueDate:'',expiryDate:'',issuedBy:'',documentNumber:''});
    this.fileName.set('');this.submitted.set(false);
  }
}
