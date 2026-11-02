import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption, SmoothHeight } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { POI_MARKER_TYPE, PoisApiService } from '../../../shared/services/pois-api.service';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';
import { PoiCoordinates, PoiLocationPicker } from './poi-location-picker';

/** fms-fleet keeps POIs of at least this radius (hypernym-fms-fe enforces the same). */
const POI_RADIUS_MIN = 50;

/**
 * Creates a POI the way hypernym-fms-fe does: name, radius and the map position (POST /api/poi).
 * The API has a single "Marker" type and no address, assignment, alert, dwell, geozone or notes
 * fields, so those steps are kept for the layout but not sent.
 */
@Component({
  selector: 'app-poi-form',
  imports: [Dropdown, Modal, PoiLocationPicker, ReactiveFormsModule, SmoothHeight, Stepper],
  templateUrl: './poi-form.html',
  styleUrl: './poi-form.css',
})
export class PoiForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<void>();
  private readonly api = inject(PoisApiService);
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fleets = toSignal(inject(RoutesApiService).fleets(), { initialValue: [] });
  protected readonly saving = signal(false);
  protected readonly radiusMin = POI_RADIUS_MIN;
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
  protected readonly fleetOptions = computed<DropdownOption[]>(() => this.fleets().map((fleet) => ({ id: String(fleet.id), label: fleet.name })));
  protected readonly vehicleOptions = computed<DropdownOption[]>(() => this.fleets().flatMap((fleet) => fleet.vehicles).map((vehicle) => ({ id: String(vehicle.id), label: vehicle.name })));
  protected readonly geozoneOptions: DropdownOption[] = [{ id:'',label:'No geozone' }];
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      type: ['', Validators.required], name: ['', Validators.required], address: ['', Validators.required],
      radius: [200, [Validators.required, Validators.min(POI_RADIUS_MIN)]], latitude: ['', Validators.required],
      longitude: ['', Validators.required], assignment: ['all', Validators.required], assignedTarget: [''],
      alertOnEntry: [true], alertOnExit: [true], maxDwell: formBuilder.control<number | null>(null),
      geozone: [''], notes: [''],
    });
  }

  protected chooseType(type: string): void { this.form.controls.type.setValue(type); }
  protected setLocation({ latitude, longitude }: PoiCoordinates): void {
    this.form.controls.latitude.setValue(latitude.toFixed(6));
    this.form.controls.longitude.setValue(longitude.toFixed(6));
    this.form.controls.latitude.markAsTouched();
    this.form.controls.longitude.markAsTouched();
  }
  protected select(control: 'assignment' | 'assignedTarget' | 'geozone', option: DropdownOption): void {
    this.form.controls[control].setValue(option.id);this.form.controls[control].markAsDirty();
    if (control === 'assignment') this.form.controls.assignedTarget.setValue('');
  }
  protected optionsLabel(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label ?? fallback;
  }
  protected assignmentTargets(): DropdownOption[] {
    return this.form.controls.assignment.value === 'fleet' ? this.fleetOptions() : this.vehicleOptions();
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
    if (this.form.invalid || !this.assignmentValid() || this.saving()) return;
    const value = this.form.getRawValue();
    this.saving.set(true);
    const request = this.api.create({
      name: value.name.trim(),
      type: POI_MARKER_TYPE,
      radius: Number(value.radius),
      territory: JSON.stringify({ lat: Number(value.latitude), lng: Number(value.longitude) }),
    });
    void this.flow
      .submit(this.modal(), request, {
        loading: 'Creating POI...',
        success: { title: 'POI created', message: `${value.name.trim()} was added to your points of interest.` },
        failure: { title: 'Unable to create POI', message: 'The POI could not be created. Please try again.' },
      })
      .then((response) => {
        this.saving.set(false);
        if (!response) return;
        this.reset();
        this.created.emit();
      });
  }
  protected async cancel(): Promise<void> {
    if (this.saving()) return;
    if (!(await this.flow.close(this.modal(), this.form.dirty))) return;
    this.reset();
    this.cancelled.emit();
  }
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
