import {
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BlockingLoader,
  DateTimePicker,
  Dropdown,
  DropdownOption,
  SmoothHeight,
} from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import {
  DeviceOption,
  InventoryOption,
  VehicleInventoryApiService,
  VehicleInventoryRecord,
} from '../../../shared/services/vehicle-inventory-api.service';
import { Stepper, StepperStep } from '../../../shared/stepper/stepper';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

export interface VehicleFormValue {
  registration: string;
  [key: string]: unknown;
}

@Component({
  selector: 'app-vehicle-form',
  imports: [
    BlockingLoader,
    DateTimePicker,
    Dropdown,
    Modal,
    ReactiveFormsModule,
    Stepper,
    SmoothHeight,
  ],
  templateUrl: './vehicle-form.html',
  styleUrl: './vehicle-form.css',
})
export class VehicleForm implements OnChanges {
  readonly open = input(false);
  readonly vehicle = input<VehicleInventoryRecord | null>(null);
  readonly cancelled = output<void>();
  readonly created = output<VehicleFormValue>();
  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);
  protected readonly editing = computed(() => !!this.vehicle());
  protected readonly error = signal('');
  protected readonly activeStep = signal(0);
  protected readonly imagePreview = signal('assets/fleetpoint/def-car.svg');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly fleets = signal<InventoryOption[]>([]);
  protected readonly categories = signal<InventoryOption[]>([]);
  protected readonly vehicleTypes = signal<InventoryOption[]>([]);
  protected readonly devices = signal<DeviceOption[]>([]);
  protected readonly purchaseOptions: DropdownOption[] = [
    { id: '1', label: 'Leased' },
    { id: '2', label: 'Owned' },
  ];
  protected readonly fleetDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'Select fleet' },
    ...this.fleets().map((item) => ({
      id: String(item.id),
      label: item.name || `Fleet ${item.id}`,
    })),
  ]);
  protected readonly categoryDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'Select category' },
    ...this.categories().map((item) => ({
      id: String(item.id),
      label: item.name || `Category ${item.id}`,
    })),
  ]);
  protected readonly vehicleTypeDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'Select vehicle type' },
    ...this.vehicleTypes().map((item) => ({
      id: String(item.id),
      label: item.name || `Vehicle type ${item.id}`,
    })),
  ]);
  protected readonly deviceDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'Select device' },
    ...this.devices().map((item) => ({ id: String(item.id), label: item.device_id })),
  ]);
  protected readonly steps: StepperStep[] = [
    { id: 'identity', label: 'Vehicle Details' },
    { id: 'allocation', label: 'Ownership & Allocation' },
    { id: 'monitoring', label: 'Violations & Review' },
  ];
  protected readonly form;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly api: VehicleInventoryApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {
    const required = Validators.required;
    this.form = this.formBuilder.nonNullable.group({
      registration: ['', required],
      engine_number: ['', required],
      chassis_number: ['', required],
      make: ['', required],
      model: ['', required],
      year: [
        new Date().getFullYear(),
        [required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)],
      ],
      color: ['', required],
      odo_reading: [0, [required, Validators.min(0)]],
      engine_capacity: [0, [required, Validators.min(0)]],
      wheels: [4, [required, Validators.min(2)]],
      fuel_tank_capacity: [0, [required, Validators.min(0)]],
      purchase_type: ['2', required],
      type: ['', required],
      device: ['', required],
      date_commissioned: ['', required],
      owner: ['', required],
      owner_id: ['', required],
      nationality: ['', required],
      registration_date: ['', required],
      expiry_date: ['', required],
      fleet: [''],
      category: [''],
      speed: [false],
      speed_threshold: [0],
      harsh_acceleration: [false],
      harsh_braking: [false],
      sharp_turning: [false],
      status: [true],
      is_immobilization_enabled: [true],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.prepareForm();
      this.loadOptions();
    }
  }
  protected next(): void {
    this.submitted.set(true);
    if (this.stepInvalid(this.activeStep())) return;
    this.submitted.set(false);
    this.activeStep.update((step) => Math.min(step + 1, 2));
  }
  protected back(): void {
    if (this.activeStep() === 0) {
      this.cancel();
      return;
    }
    this.submitted.set(false);
    this.activeStep.update((step) => step - 1);
  }
  protected goToStep(index: number): void {
    if (index <= this.activeStep()) this.activeStep.set(index);
  }
  protected selectPurchase(option: DropdownOption): void {
    this.form.controls.purchase_type.setValue(option.id);
  }
  protected selectVehicleType(option: DropdownOption): void {
    this.form.controls.type.setValue(option.id);
  }
  protected selectDevice(option: DropdownOption): void {
    this.form.controls.device.setValue(option.id);
  }
  protected selectFleet(option: DropdownOption): void {
    this.form.controls.fleet.setValue(option.id);
    this.form.controls.category.setValue('');
    this.api
      .getCategoryOptions(option.id)
      .subscribe({ next: (response) => this.categories.set(response.data?.data ?? []) });
  }
  protected selectCategory(option: DropdownOption): void {
    this.form.controls.category.setValue(option.id);
  }
  protected optionLabel(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label || fallback;
  }
  protected chooseImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile.set(file);
    if (file) this.imagePreview.set(URL.createObjectURL(file));
  }
  protected imageFailed(): void {
    this.imagePreview.set('assets/fleetpoint/def-car.svg');
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.activeStep.set(this.firstInvalidStep());
      return;
    }
    const raw = this.form.getRawValue();
    if (raw.speed && Number(raw.speed_threshold) <= 0) {
      this.error.set('Please provide a valid speed threshold.');
      this.activeStep.set(2);
      return;
    }
    const payload = new FormData();
    const values: Record<string, string | number | boolean> = {
      ...raw,
      name: raw.registration,
      fleet_category: raw.category,
      status: raw.status ? 1 : 2,
      speed_threshold: raw.speed ? raw.speed_threshold : 0,
    };
    delete values['category'];
    delete values['speed'];
    Object.entries(values).forEach(([key, value]) => payload.append(key, String(value ?? '')));
    payload.append('vehicle_devices', JSON.stringify([Number(raw.device)]));
    const image = this.imageFile();
    if (image) payload.append('image', image, image.name);
    this.loading.set(true);
    this.error.set('');
    const request = this.editing()
      ? this.api.updateVehicle(this.vehicle()!.id, payload)
      : this.api.createVehicle(payload);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async () => {
        const action = this.editing() ? 'updated' : 'added';
        await this.feedback.open({
          type: 'success',
          title: `Vehicle ${action}`,
          message: `${raw.registration} was ${action} successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.created.emit(raw as VehicleFormValue);
        this.reset();
      },
      error: (response) => {
        const message =
          response.error?.message ||
          `Vehicle could not be ${this.editing() ? 'updated' : 'created'}.`;
        this.error.set(message);
        void this.feedback.open({
          type: 'error',
          title: `Unable to ${this.editing() ? 'update' : 'add'} vehicle`,
          message,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
  protected cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private loadOptions(): void {
    this.error.set('');
    forkJoin({
      fleets: this.api.getFleetOptions(),
      categories: this.api.getCategoryOptions(),
      types: this.api.getVehicleTypeOptions(),
      devices: this.api.getAvailableDevices(),
    }).subscribe({
      next: ({ fleets, categories, types, devices }) => {
        this.fleets.set(fleets.data?.data ?? []);
        this.categories.set(categories.data?.data ?? []);
        this.vehicleTypes.set(types.data?.data ?? []);
        const available = devices.data?.data ?? [];
        const vehicle = this.vehicle();
        this.devices.set(
          vehicle?.device &&
            !available.some((device) => String(device.id) === String(vehicle.device))
            ? [
                {
                  id: Number(vehicle.device),
                  device_id: vehicle.device_id || String(vehicle.device),
                },
                ...available,
              ]
            : available,
        );
      },
      error: (response) =>
        this.error.set(response.error?.message || 'Vehicle form options could not be loaded.'),
    });
  }
  private stepInvalid(step: number): boolean {
    const names =
      step === 0
        ? [
            'registration',
            'engine_number',
            'chassis_number',
            'make',
            'model',
            'year',
            'color',
            'odo_reading',
            'engine_capacity',
            'wheels',
            'fuel_tank_capacity',
            'purchase_type',
          ]
        : [
            'type',
            'device',
            'date_commissioned',
            'owner',
            'owner_id',
            'nationality',
            'registration_date',
            'expiry_date',
          ];
    const controls = names.map((name) => this.form.get(name)!);
    controls.forEach((control) => control.markAsTouched());
    return controls.some((control) => control.invalid);
  }
  private firstInvalidStep(): number {
    return this.stepInvalid(0) ? 0 : this.stepInvalid(1) ? 1 : 2;
  }
  private reset(): void {
    this.form.reset({
      year: new Date().getFullYear(),
      odo_reading: 0,
      engine_capacity: 0,
      wheels: 4,
      fuel_tank_capacity: 0,
      purchase_type: '2',
      speed: false,
      speed_threshold: 0,
      harsh_acceleration: false,
      harsh_braking: false,
      sharp_turning: false,
      status: true,
      is_immobilization_enabled: true,
    });
    this.activeStep.set(0);
    this.submitted.set(false);
    this.error.set('');
    this.imageFile.set(null);
    this.imagePreview.set('assets/fleetpoint/def-car.svg');
  }

  private prepareForm(): void {
    this.reset();
    const vehicle = this.vehicle();
    if (!vehicle) return;
    const threshold = Number(vehicle.speed_threshold || 0);
    this.form.patchValue({
      registration: vehicle.registration || vehicle.name,
      engine_number: vehicle.engine_number,
      chassis_number: vehicle.chassis_number,
      make: vehicle.make,
      model: vehicle.model,
      year: Number(vehicle.year),
      color: vehicle.color,
      odo_reading: Number(vehicle.odo_reading || 0),
      engine_capacity: Number(vehicle.engine_capacity || 0),
      wheels: Number(vehicle.wheels || 4),
      fuel_tank_capacity: Number(vehicle.fuel_tank_capacity || 0),
      purchase_type: String(vehicle.purchase_type || '2'),
      type: String(vehicle.type || ''),
      device: String(vehicle.device || ''),
      date_commissioned: vehicle.date_commissioned?.slice(0, 10) || '',
      owner: vehicle.owner || '',
      owner_id: vehicle.owner_id,
      nationality: vehicle.nationality,
      registration_date: vehicle.registration_date?.slice(0, 10) || '',
      expiry_date: vehicle.expiry_date?.slice(0, 10) || '',
      fleet: String(vehicle.fleet ?? ''),
      category: String(vehicle.fleet_category ?? ''),
      speed: threshold > 0,
      speed_threshold: threshold,
      harsh_acceleration: !!vehicle.harsh_acceleration,
      harsh_braking: !!vehicle.harsh_braking,
      sharp_turning: !!vehicle.sharp_turning,
      status: vehicle.status === 1,
      is_immobilization_enabled: vehicle.is_immobilization_enabled !== false,
    });
    this.imagePreview.set(vehicle.image || 'assets/fleetpoint/def-car.svg');
  }
}
