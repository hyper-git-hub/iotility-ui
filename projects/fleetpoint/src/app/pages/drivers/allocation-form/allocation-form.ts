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
import { BlockingLoader, DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import {
  DriverApiService,
  DriverVehicleAllocation,
} from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-allocation-form',
  imports: [BlockingLoader, DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './allocation-form.html',
  styleUrl: './allocation-form.css',
})
export class AllocationForm implements OnChanges {
  readonly open = input(false);
  readonly allocation = input<DriverVehicleAllocation | null>(null);
  readonly presetVehicleId = input<string | number | null>(null);
  readonly presetVehicleLabel = input('');
  readonly lockVehicle = input(false);
  readonly cancelled = output<void>();
  readonly saved = output<void>();
  protected readonly editing = computed(() => !!this.allocation());
  protected readonly loading = signal(false);
  protected readonly optionsLoading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly vehicleOptions = signal<DropdownOption[]>([]);
  protected readonly driverOptions = signal<DropdownOption[]>([]);
  protected readonly form;
  constructor(
    private readonly fb: FormBuilder,
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {
    this.form = this.fb.nonNullable.group({
      vehicle: ['', Validators.required],
      drivers: this.fb.nonNullable.control<string[]>([], Validators.required),
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.reset();
      this.patchAllocation();
      this.loadOptions();
    }
  }
  protected selectVehicle(option: DropdownOption): void {
    if (!this.lockVehicle()) this.form.controls.vehicle.setValue(option.id);
  }
  protected selectDrivers(ids: string[]): void {
    this.form.controls.drivers.setValue(ids);
    this.form.controls.drivers.markAsTouched();
  }
  protected label(options: DropdownOption[], id: string, fallback: string): string {
    return options.find((option) => option.id === id)?.label || fallback;
  }
  protected driversLabel(): string {
    const count = this.form.controls.drivers.value.length;
    return count ? `${count} driver${count === 1 ? '' : 's'} selected` : 'Select drivers';
  }
  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.drivers.value.length) return;
    const value = this.form.getRawValue();
    if (value.end_date < value.start_date) {
      this.error.set('End date must be on or after the start date.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const payload = {
      vehicle: Number(value.vehicle),
      driver: value.drivers.map(Number),
      start_date: value.start_date,
      end_date: value.end_date,
    };
    const current = this.allocation();
    const request = current
      ? this.api.updateDriverVehicleAllocation(
          current.id,
          current.vehicle_id,
          String(current.vehicle_id) !== value.vehicle,
          payload,
        )
      : this.api.createDriverVehicleAllocation(payload);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async (response) => {
        const action = current ? 'updated' : 'added';
        await this.feedback.open({
          type: 'success',
          title: `Allocation ${action}`,
          message: response.message || `The driver allocation was ${action} successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.saved.emit();
        this.reset();
      },
      error: (response) => {
        const message = response.error?.message || 'The allocation could not be saved.';
        this.error.set(message);
        void this.feedback.open({
          type: 'error',
          title: 'Unable to save allocation',
          message,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
  protected cancel(): void {
    if (this.loading()) return;
    this.reset();
    this.cancelled.emit();
  }
  private loadOptions(): void {
    this.optionsLoading.set(true);
    forkJoin({ vehicles: this.api.getAllocationVehicles(), drivers: this.api.getActiveDrivers() })
      .pipe(finalize(() => this.optionsLoading.set(false)))
      .subscribe({
        next: ({ vehicles, drivers }) => {
          const records = vehicles.data ?? [];
          const preset = String(this.presetVehicleId() ?? '');
          const matched = records.find(
            (vehicle) => String(vehicle.id) === preset || String(vehicle.vehicle_id) === preset,
          );
          const options = records.map((vehicle) => ({
            id: String(vehicle.id),
            label: vehicle.registration,
            description: `Vehicle ID ${vehicle.vehicle_id}`,
          }));
          if (preset && matched) this.form.controls.vehicle.setValue(String(matched.id));
          else if (preset && !options.some((option) => option.id === preset))
            options.unshift({
              id: preset,
              label: this.presetVehicleLabel() || `Vehicle ${preset}`,
              description: `Vehicle ID ${preset}`,
            });
          this.vehicleOptions.set(options);
          this.driverOptions.set(
            (drivers.data?.data ?? [])
              .filter((driver) => driver.status === '1')
              .map((driver) => ({
                id: String(driver.id),
                label: driver.name,
                description: driver.employee_id,
              })),
          );
        },
        error: (response) =>
          this.error.set(response.error?.message || 'Vehicles and drivers could not be loaded.'),
      });
  }
  private reset(): void {
    this.form.reset({
      vehicle: String(this.presetVehicleId() ?? ''),
      drivers: [],
      start_date: '',
      end_date: '',
    });
    this.submitted.set(false);
    this.error.set('');
  }
  private patchAllocation(): void {
    const allocation = this.allocation();
    if (allocation)
      this.form.patchValue({
        vehicle: String(allocation.vehicle_id),
        drivers: (allocation.driver ?? []).map(String),
        start_date: allocation.start_date,
        end_date: allocation.end_date,
      });
  }
}
