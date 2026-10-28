import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { FleetVehicleOption, MaintenanceApiService } from '../../../shared/services/maintenance-api.service';
import { Modal } from '../../../shared/modal/modal';

/** New work orders start as "Pending by Workshop", as in hypernym-fms-fe. */
const PENDING_BY_WORKSHOP=6;

@Component({selector:'app-work-order-form',imports:[DateTimePicker,Dropdown,Modal,ReactiveFormsModule],templateUrl:'./work-order-form.html',styleUrl:'./work-order-form.css'})
export class WorkOrderForm {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<void>();
  protected readonly currency=this.api.currency;
  protected readonly submitted=signal(false);protected readonly saving=signal(false);protected readonly error=signal('');
  private vehicles:FleetVehicleOption[]=[];
  protected readonly vehicleOptions=signal<DropdownOption[]>([]);
  protected readonly serviceOptions=signal<DropdownOption[]>([]);
  protected readonly workshopOptions=signal<DropdownOption[]>([{id:'',label:'Unassigned'}]);
  protected readonly form;
  constructor(formBuilder:FormBuilder){
    this.form=formBuilder.nonNullable.group({vehicle:['',Validators.required],serviceType:['',Validators.required],workshop:[''],name:['',Validators.required],description:[''],estimatedCost:[null as number|null,Validators.min(0)],nextDate:['']});
    this.api.vehicles().pipe(takeUntilDestroyed()).subscribe(vehicles=>{this.vehicles=vehicles;this.vehicleOptions.set(vehicles.map(vehicle=>({id:String(vehicle.id),label:vehicle.name})));});
    this.api.serviceTypes().pipe(takeUntilDestroyed()).subscribe(types=>this.serviceOptions.set(types.map(type=>({id:String(type.id),label:type.name}))));
    // Workshops can be added or removed while this form stays mounted, so follow the api version.
    effect(()=>{this.api.version();untracked(()=>this.api.workshops().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(response=>this.workshopOptions.set([{id:'',label:'Unassigned'},...(response.data?.data??[]).map(workshop=>({id:String(workshop.id),label:workshop.workshop_name}))])));});
  }
  protected select(control:'vehicle'|'serviceType'|'workshop',option:DropdownOption):void{this.form.controls[control].setValue(option.id);this.form.controls[control].markAsTouched();}
  protected label(options:DropdownOption[],value:string,fallback:string):string{return options.find(option=>option.id===value)?.label??fallback;}
  protected invalid(control:keyof typeof this.form.controls):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  protected submit():void{
    this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid||this.saving())return;
    const value=this.form.getRawValue();
    const vehicle=this.vehicles.find(item=>String(item.id)===value.vehicle);
    if(!vehicle)return;
    this.saving.set(true);this.error.set('');
    this.api.create({
      vehicle:vehicle.id,fleet:vehicle.fleetId,service_type:Number(value.serviceType),name:value.name.trim(),
      workshop:value.workshop?Number(value.workshop):undefined,description:value.description.trim(),
      estimated_cost:value.estimatedCost??undefined,next_maintenance_date:value.nextDate.slice(0,10)||undefined,
      maintenance_status:PENDING_BY_WORKSHOP,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{this.saving.set(false);if(response.status===1002){this.error.set(response.message||'The work order could not be raised.');return;}this.reset();this.created.emit();},
      error:()=>{this.saving.set(false);this.error.set('The work order could not be raised. Please try again.');},
    });
  }
  protected cancel():void{this.reset();this.cancelled.emit();}
  private reset():void{this.form.reset({vehicle:'',serviceType:'',workshop:'',name:'',description:'',estimatedCost:null,nextDate:''});this.submitted.set(false);this.error.set('');}
}
