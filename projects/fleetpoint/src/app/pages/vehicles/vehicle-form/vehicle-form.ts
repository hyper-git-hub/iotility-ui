import {
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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
import { FeatureAccessService } from '../../../shared/services/feature-access.service';

const DASHCAM_DEVICE_TYPES = new Set(['ConcoxDC', 'Howen DC', 'BSJ Single Channel']);

function evenWheelCount(control: AbstractControl): ValidationErrors | null {
  const value = Number(control.value);
  return Number.isFinite(value) && value % 2 === 0 ? null : { evenWheelCount: true };
}

function maximumTwoDecimals(control: AbstractControl): ValidationErrors | null {
  return /^\d+(\.\d{1,2})?$/.test(String(control.value)) ? null : { maximumTwoDecimals: true };
}

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
  protected readonly imagePreview = signal('assets/fleetpoint/vehicle.svg');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly fleets = signal<InventoryOption[]>([]);
  protected readonly categories = signal<InventoryOption[]>([]);
  protected readonly vehicleTypes = signal<InventoryOption[]>([]);
  protected readonly devices = signal<DeviceOption[]>([]);
  protected readonly cameraDevices = signal<DeviceOption[]>([]);
  protected readonly customerType = this.getCustomerType();
  protected readonly isUkCustomer = this.getCustomerGroup() === 'UK';
  protected readonly purchaseOptions: DropdownOption[] = [
    { id: '1', label: 'Leased' },
    { id: '2', label: 'Owned' },
  ];
  protected readonly engineOptions: DropdownOption[] = [
    { id: '1', label: 'Petrol' },
    { id: '2', label: 'Diesel' },
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
  protected readonly cameraDeviceDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'Select secondary device' },
    ...this.cameraDevices().map((item) => ({ id: String(item.id), label: item.device_id })),
  ]);
  protected readonly steps: StepperStep[] = [
    { id: 'identity', label: 'Vehicle Details' },
    { id: 'allocation', label: 'Ownership & Allocation' },
    { id: 'monitoring', label: 'Violations & Review' },
  ];
  protected readonly progress = computed(() =>
    Math.round(((this.activeStep() + 1) / this.steps.length) * 100),
  );
  protected readonly form;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly api: VehicleInventoryApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly features: FeatureAccessService,
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
        [required, Validators.min(1990), Validators.max(new Date().getFullYear())],
      ],
      color: ['', required],
      odo_reading: [0, [required, Validators.min(0)]],
      engine_capacity: [0, [required, Validators.min(0)]],
      wheels: [4, [required, Validators.min(2), evenWheelCount]],
      fuel_tank_capacity: [0, [required, Validators.min(0), maximumTwoDecimals]],
      purchase_type: ['2', required],
      engine_type: ['', required],
      type: ['', required],
      device: ['', required],
      camera_device: [''],
      date_commissioned: ['', required],
      fleet: [''],
      category: [''],
      speed: [false],
      speed_threshold: [0],
      harsh_acceleration: [false],
      harsh_braking: [false],
      sharp_turning: [false],
      geo_zone: [false],
      fuel_sensor: [false],
      status: [true],
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
    this.activeStep.update((step) => Math.max(step - 1, 0));
  }
  protected goToStep(index: number): void {
    if (index <= this.activeStep()) this.activeStep.set(index);
  }
  protected selectPurchase(option: DropdownOption): void {
    this.form.controls.purchase_type.setValue(option.id);
  }
  protected selectEngineType(option: DropdownOption): void {
    this.form.controls.engine_type.setValue(option.id);
  }
  protected selectVehicleType(option: DropdownOption): void {
    this.form.controls.type.setValue(option.id);
  }
  protected selectDevice(option: DropdownOption): void {
    this.form.controls.device.setValue(option.id);
    const selected = this.devices().find((device) => String(device.id) === option.id);
    if (selected && this.isRestrictedPrimaryDevice(selected)) {
      this.form.controls.camera_device.setValue('');
    }
  }
  protected selectCameraDevice(option: DropdownOption): void {
    this.form.controls.camera_device.setValue(option.id);
  }
  protected canShowSecondaryDevice(): boolean {
    return this.features.has(151) && this.customerType === '2';
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
    this.imagePreview.set('assets/fleetpoint/vehicle.svg');
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
      speed_threshold: raw.speed
        ? this.isUkCustomer
          ? Math.round(Number(raw.speed_threshold) * 1.60934)
          : raw.speed_threshold
        : 0,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    delete values['category'];
    delete values['speed'];
    if (!this.canShowSecondaryDevice()) delete values['camera_device'];
    Object.entries(values).forEach(([key, value]) => payload.append(key, String(value ?? '')));
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
        const availableFleets = fleets.data?.data ?? [];
        const vehicle = this.vehicle();
        this.fleets.set(
          vehicle?.fleet &&
            !availableFleets.some((fleet) => String(fleet.id) === String(vehicle.fleet))
            ? [
                {
                  id: Number(vehicle.fleet),
                  name: vehicle.fleet_name || `Fleet ${vehicle.fleet}`,
                },
                ...availableFleets,
              ]
            : availableFleets,
        );
        this.categories.set(categories.data?.data ?? []);
        this.vehicleTypes.set(types.data?.data ?? []);
        const available = devices.data?.data ?? [];
        const primaryDevices =
          this.customerType === '1'
            ? available
            : available.filter((device) => !DASHCAM_DEVICE_TYPES.has(device.type || ''));
        const secondaryDevices = available.filter((device) =>
          DASHCAM_DEVICE_TYPES.has(device.type || ''),
        );
        this.devices.set(
          vehicle?.device &&
            !primaryDevices.some((device) => String(device.id) === String(vehicle.device))
            ? [
                {
                  id: Number(vehicle.device),
                  device_id: vehicle.device_id || String(vehicle.device),
                },
                ...primaryDevices,
              ]
            : primaryDevices,
        );
        this.cameraDevices.set(
          vehicle?.camera_device_id &&
            !secondaryDevices.some(
              (device) => String(device.id) === String(vehicle.camera_device_id),
            )
            ? [
                {
                  id: Number(vehicle.camera_device_id),
                  device_id: String(vehicle.camera_device || vehicle.camera_device_id),
                  type: vehicle.camera_device_type || undefined,
                },
                ...secondaryDevices,
              ]
            : secondaryDevices,
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
            'engine_type',
          ]
        : ['type', 'device', 'date_commissioned'];
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
      engine_type: '',
      speed: false,
      speed_threshold: 0,
      harsh_acceleration: false,
      harsh_braking: false,
      sharp_turning: false,
      geo_zone: false,
      fuel_sensor: false,
      status: true,
    });
    this.activeStep.set(0);
    this.submitted.set(false);
    this.error.set('');
    this.imageFile.set(null);
    this.imagePreview.set('assets/fleetpoint/vehicle.svg');
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
      engine_type: String(vehicle.engine_type || ''),
      type: String(vehicle.type || ''),
      device: String(vehicle.device || ''),
      date_commissioned: vehicle.date_commissioned?.slice(0, 10) || '',
      fleet: String(vehicle.fleet ?? ''),
      category: String(vehicle.fleet_category ?? ''),
      speed: threshold > 0,
      speed_threshold:
        this.isUkCustomer && threshold > 0 ? Math.round(threshold / 1.60934) : threshold,
      harsh_acceleration: !!vehicle.harsh_acceleration,
      harsh_braking: !!vehicle.harsh_braking,
      sharp_turning: !!vehicle.sharp_turning,
      geo_zone: !!vehicle.geo_zone,
      fuel_sensor: !!vehicle.fuel_sensor,
      camera_device: String(vehicle.camera_device_id ?? ''),
      status: vehicle.status === 1,
    });
    this.imagePreview.set(vehicle.image || 'assets/fleetpoint/vehicle.svg');
  }

  private isRestrictedPrimaryDevice(device: DeviceOption): boolean {
    return device.type === 'ConcoxDC' || device.type === 'Howen DC';
  }

  private storedUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') ?? 'null');
    } catch {
      return null;
    }
  }

  private getCustomerType(): string {
    const customer = this.storedUser()?.customer;
    return String(customer?.customer_type ?? customer?.device_support ?? '');
  }

  private getCustomerGroup(): string {
    return String(this.storedUser()?.customer?.groups?.[0]?.name ?? '');
  }
}
