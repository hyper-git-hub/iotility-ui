import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { MaintenanceApiService } from '../../../shared/services/maintenance-api.service';
import { Modal } from '../../../shared/modal/modal';

@Component({selector:'app-workshop-form',imports:[Dropdown,Modal,ReactiveFormsModule],templateUrl:'./workshop-form.html',styleUrl:'./workshop-form.css'})
export class WorkshopForm {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<void>();
  protected readonly submitted=signal(false);protected readonly saving=signal(false);protected readonly error=signal('');
  protected readonly ownerOptions=signal<DropdownOption[]>([]);
  protected readonly form;
  constructor(formBuilder:FormBuilder){
    this.form=formBuilder.nonNullable.group({name:['',Validators.required],location:['',Validators.required],owner:['',Validators.required]});
    this.api.workshopOwners().pipe(takeUntilDestroyed()).subscribe(owners=>this.ownerOptions.set(owners.map(owner=>({id:owner.guid,label:[owner.first_name,owner.last_name].filter(Boolean).join(' ')||owner.email||owner.guid}))));
  }
  protected select(option:DropdownOption):void{this.form.controls.owner.setValue(option.id);this.form.controls.owner.markAsTouched();}
  protected ownerLabel():string{return this.ownerOptions().find(option=>option.id===this.form.controls.owner.value)?.label??'Select owner...';}
  protected invalid(control:keyof typeof this.form.controls):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  protected submit():void{
    this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid||this.saving())return;
    const value=this.form.getRawValue();
    this.saving.set(true);this.error.set('');
    this.api.createWorkshop({workshop_name:value.name.trim(),location:value.location.trim(),workshop_owner:value.owner}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{this.saving.set(false);if(response.status===1002){this.error.set(response.message||'The workshop could not be added.');return;}this.reset();this.created.emit();},
      error:()=>{this.saving.set(false);this.error.set('The workshop could not be added. Please try again.');},
    });
  }
  protected cancel():void{this.reset();this.cancelled.emit();}
  private reset():void{this.form.reset({name:'',location:'',owner:''});this.submitted.set(false);this.error.set('');}
}
