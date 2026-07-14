import { Component, computed, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../shared/modal/modal';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';
import { SmoothHeight } from '@iotility/shared-ui';

export interface VehicleFormValue {
  registration: string;
  makeModel: string;
  fleet: string;
  driver: string;
  location: string;
  fuel: number;
  mileage: number;
  vin: string;
  fuelCapacity: number;
  engineType: string;
  weightCapacity: string;
  engineSize: number;
  purchaseType: string;
  imei: string;
  deviceType: string;
}

interface DriverOption { id: string; name: string; initials: string; location: string; }

@Component({
  selector: 'app-vehicle-form',
  imports: [Modal, ReactiveFormsModule, Stepper, SmoothHeight],
  templateUrl: './vehicle-form.html',
  styleUrl: './vehicle-form.css',
})
export class VehicleForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<VehicleFormValue>();
  protected readonly submitted = signal(false);
  protected readonly activeStep = signal(0);
  protected readonly selectedDriver = signal('');
  protected readonly driverSearch = signal('');
  protected readonly documents = signal<string[]>([]);
  protected readonly steps: StepperStep[] = [
    { id: 'details', label: 'Vehicle Details' },
    { id: 'devices', label: 'Devices & Documents' },
    { id: 'driver', label: 'Assign Driver' },
  ];
  protected readonly drivers: DriverOption[] = [
    { id: 'driver-1', name: 'Aisha Okonkwo', initials: 'AO', location: 'Birmingham' },
    { id: 'driver-2', name: 'Oliver Pemberton', initials: 'OP', location: 'London' },
    { id: 'driver-3', name: 'Sarah Whitfield', initials: 'SW', location: 'Manchester' },
    { id: 'driver-4', name: 'Haris Khan', initials: 'HK', location: 'Leeds' },
    { id: 'driver-5', name: 'Omar Ali', initials: 'OA', location: 'London' },
    { id: 'driver-6', name: 'Ayesha Khan', initials: 'AK', location: 'Birmingham' },
  ];
  protected readonly filteredDrivers = computed(() => {
    const query = this.driverSearch().trim().toLowerCase();
    return query ? this.drivers.filter(({ name, location }) => `${name} ${location}`.toLowerCase().includes(query)) : this.drivers;
  });
  protected readonly progress = computed(() => Math.round(((this.activeStep() + 1) / this.steps.length) * 100));
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      fleet: ['London HGV', Validators.required],
      vin: ['', Validators.required],
      registration: ['', Validators.required],
      vehicleType: ['Volvo FH', Validators.required],
      fuelCapacity: [400, [Validators.required, Validators.min(1)]],
      engineType: ['Diesel', Validators.required],
      weightCapacity: ['12,000 kg', Validators.required],
      engineSize: [13000, [Validators.required, Validators.min(1)]],
      purchaseType: ['Leased', Validators.required],
      location: ['', Validators.required],
      fuel: [100, [Validators.required, Validators.min(0), Validators.max(100)]],
      mileage: [0, [Validators.required, Validators.min(0)]],
      imei: ['', Validators.required],
      deviceType: ['Dashcam', Validators.required],
    });
  }

  protected next(): void {
    this.submitted.set(true);
    if (this.activeStep() === 0 && this.detailsInvalid()) return;
    if (this.activeStep() === 1 && (this.form.controls.imei.invalid || this.form.controls.deviceType.invalid)) return;
    this.submitted.set(false);
    this.activeStep.update((step) => Math.min(step + 1, this.steps.length - 1));
  }
  protected back(): void { this.activeStep.update((step) => Math.max(step - 1, 0)); }
  protected goToStep(index: number): void { this.activeStep.set(index); }
  protected selectDriver(driver: DriverOption): void { this.selectedDriver.set(driver.id); }
  protected updateDriverSearch(event: Event): void { this.driverSearch.set((event.target as HTMLInputElement).value); }
  protected addDocuments(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.documents.update((current) => [...current, ...files.map(({ name }) => name)]);
  }
  protected submit(): void {
    const raw = this.form.getRawValue();
    const driver = this.drivers.find(({ id }) => id === this.selectedDriver())?.name ?? 'Unassigned';
    this.created.emit({ ...raw, makeModel: raw.vehicleType, driver });
    this.reset();
  }
  protected cancel(): void { this.reset(); this.cancelled.emit(); }
  private detailsInvalid(): boolean {
    const controls = this.form.controls;
    const details = [controls.fleet, controls.vin, controls.registration, controls.vehicleType, controls.fuelCapacity, controls.engineType, controls.weightCapacity, controls.engineSize, controls.purchaseType, controls.location, controls.fuel, controls.mileage];
    details.forEach((control) => control.markAsTouched());
    return details.some((control) => control.invalid);
  }
  private reset(): void {
    this.form.reset({ fleet: 'London HGV', vehicleType: 'Volvo FH', fuelCapacity: 400, engineType: 'Diesel', weightCapacity: '12,000 kg', engineSize: 13000, purchaseType: 'Leased', fuel: 100, mileage: 0, deviceType: 'Dashcam' });
    this.activeStep.set(0); this.selectedDriver.set(''); this.driverSearch.set(''); this.documents.set([]); this.submitted.set(false);
  }
}
