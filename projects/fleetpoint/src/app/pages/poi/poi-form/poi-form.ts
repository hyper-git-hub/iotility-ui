import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption, SmoothHeight } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';

export interface PoiFormValue {
  type: string; name: string; address: string; radius: number; latitude: string; longitude: string;
  assignment: string; assignedTarget: string; alertOnEntry: boolean; alertOnExit: boolean;
  maxDwell: number | null; geozone: string; notes: string;
}

@Component({
  selector: 'app-poi-form',
  imports: [Dropdown, Modal, ReactiveFormsModule, SmoothHeight, Stepper],
  templateUrl: './poi-form.html',
  styleUrl: './poi-form.css',
})
export class PoiForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<PoiFormValue>();
  protected readonly activeStep = signal(0);
  protected readonly submitted = signal(false);
  protected readonly steps: StepperStep[] = [
    { id: 'type', label: 'POI Type', description: 'Choose category' },
    { id: 'details', label: 'Details', description: 'Name and location' },
    { id: 'rules', label: 'Assignment', description: 'Vehicles and alerts' },
    { id: 'confirm', label: 'Confirm', description: 'Review POI' },
  ];
  protected readonly poiTypes = [
    { id:'depot',label:'Depot',description:'Fleet depot or operational base',icon:'building' },
    { id:'customer',label:'Customer Site',description:'Customer delivery or collection site',icon:'users' },
    { id:'fuel',label:'Fuel Station',description:'Approved refuelling location',icon:'fuel' },
    { id:'rest',label:'Rest Stop',description:'Driver rest and break area',icon:'coffee' },
    { id:'exclusion',label:'Exclusion Zone',description:'Restricted vehicle area',icon:'shield' },
    { id:'unsafe',label:'Unsafe Area',description:'Known operational risk area',icon:'alert' },
    { id:'competitor',label:'Competitor',description:'Competitor site or facility',icon:'bolt' },
    { id:'route',label:'Route',description:'Important route location',icon:'route' },
    { id:'custom',label:'Custom',description:'Any other point of interest',icon:'pin' },
  ];
  protected readonly assignmentOptions: DropdownOption[] = [
    { id:'all',label:'All vehicles' }, { id:'fleet',label:'Specific fleet' }, { id:'vehicle',label:'Specific vehicle' },
  ];
  protected readonly fleetOptions: DropdownOption[] = [
    { id:'north',label:'Northern Distribution' }, { id:'midlands',label:'Midlands Operations' }, { id:'london',label:'London Delivery Fleet' },
  ];
  protected readonly vehicleOptions: DropdownOption[] = [
    { id:'LP-4821',label:'LP-4821' }, { id:'LP-6612',label:'LP-6612' }, { id:'LP-3312',label:'LP-3312' }, { id:'LP-5531',label:'LP-5531' },
  ];
  protected readonly geozoneOptions: DropdownOption[] = [
    { id:'',label:'No geozone' }, { id:'london-lez',label:'London Low Emission Zone' },
    { id:'birmingham-b',label:'Birmingham Depot Zone B' }, { id:'manchester-curfew',label:'Manchester Night Curfew' },
  ];
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      type: ['', Validators.required], name: ['', Validators.required], address: ['', Validators.required],
      radius: [200, [Validators.required, Validators.min(10)]], latitude: ['', Validators.required],
      longitude: ['', Validators.required], assignment: ['all', Validators.required], assignedTarget: [''],
      alertOnEntry: [true], alertOnExit: [true], maxDwell: formBuilder.control<number | null>(null),
      geozone: [''], notes: [''],
    });
  }

  protected chooseType(type: string): void { this.form.controls.type.setValue(type); }
  protected select(control: 'assignment' | 'assignedTarget' | 'geozone', option: DropdownOption): void {
    this.form.controls[control].setValue(option.id);
    if (control === 'assignment') this.form.controls.assignedTarget.setValue('');
  }
  protected optionsLabel(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label ?? fallback;
  }
  protected assignmentTargets(): DropdownOption[] {
    return this.form.controls.assignment.value === 'fleet' ? this.fleetOptions : this.vehicleOptions;
  }
  protected selectedTypeLabel(): string { return this.poiTypes.find((type) => type.id === this.form.controls.type.value)?.label ?? 'Not selected'; }
  protected goToStep(index: number): void { this.activeStep.set(index); }
  protected next(): void {
    this.submitted.set(true);
    if (!this.stepValid()) return;
    this.submitted.set(false);
    this.activeStep.update((step) => Math.min(3, step + 1));
  }
  protected back(): void {
    if (this.activeStep() === 0) { this.cancel(); return; }
    this.submitted.set(false);
    this.activeStep.update((step) => step - 1);
  }
  protected submit(): void {
    if (this.form.invalid || !this.assignmentValid()) return;
    this.created.emit(this.form.getRawValue());
    this.reset();
  }
  protected cancel(): void { this.reset(); this.cancelled.emit(); }
  protected invalid(control: 'name'|'address'|'radius'|'latitude'|'longitude'): boolean {
    return this.submitted() && this.form.controls[control].invalid;
  }
  private stepValid(): boolean {
    if (this.activeStep() === 0) return !!this.form.controls.type.value;
    if (this.activeStep() === 1) {
      this.form.controls.name.markAsTouched();
      this.form.controls.address.markAsTouched();
      this.form.controls.radius.markAsTouched();
      this.form.controls.latitude.markAsTouched();
      this.form.controls.longitude.markAsTouched();
      return !this.form.controls.name.invalid && !this.form.controls.address.invalid && !this.form.controls.radius.invalid && !this.form.controls.latitude.invalid && !this.form.controls.longitude.invalid;
    }
    return this.activeStep() !== 2 || this.assignmentValid();
  }
  private assignmentValid(): boolean {
    return this.form.controls.assignment.value === 'all' || !!this.form.controls.assignedTarget.value;
  }
  private reset(): void {
    this.form.reset({ type:'',name:'',address:'',radius:200,latitude:'',longitude:'',assignment:'all',assignedTarget:'',alertOnEntry:true,alertOnExit:true,maxDwell:null,geozone:'',notes:'' });
    this.activeStep.set(0); this.submitted.set(false);
  }
}
