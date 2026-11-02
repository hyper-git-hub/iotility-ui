import { Component, DestroyRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { catchError, of } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { DriverApiService } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { JobsApiService } from '../../../shared/services/jobs-api.service';
import { MaintenanceApiService } from '../../../shared/services/maintenance-api.service';
import { toUtcDateTime } from '../jobs.data';

/** Creates a job the way hypernym-fms-fe does: name, driver, dates, job type and one pickup → dropoff task. */
@Component({
  selector: 'app-job-form',
  imports: [DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './job-form.html',
  styleUrl: './job-form.css',
})
export class JobForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<void>();
  private readonly api = inject(JobsApiService);
  private readonly driverApi = inject(DriverApiService);
  private readonly maintenanceApi = inject(MaintenanceApiService);
  private readonly feedback = inject(FeedbackDialogBridgeService);
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  private readonly destroyRef = inject(DestroyRef);
  private saving = false;
  protected readonly submitted = signal(false);
  /** fms-driver job_type ids. */
  protected readonly typeOptions: DropdownOption[] = [
    { id: '1', label: 'Ad-Hoc' },
    { id: '2', label: 'Scheduled' },
  ];
  /** Kept for the layout; the API has no job priority, so it isn't sent. */
  protected readonly priorityOptions: DropdownOption[] = [
    { id: 'Normal', label: 'Normal' },
    { id: 'High', label: 'High' },
    { id: 'Low', label: 'Low' },
  ];
  protected readonly driverOptions = signal<DropdownOption[]>([]);
  /** A job's vehicle comes from the driver's allocation, so this isn't sent either. */
  protected readonly vehicleOptions = signal<DropdownOption[]>([]);
  protected readonly locationOptions = signal<DropdownOption[]>([]);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    type: ['2', Validators.required],
    priority: ['Normal', Validators.required],
    driver: ['', Validators.required],
    vehicle: [''],
    pickup: ['', Validators.required],
    dropoff: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    notes: [''],
  });

  constructor() {
    // Lookups load the first time the modal opens rather than with the page.
    let fetched = false;
    effect(() => {
      if (!this.open() || fetched) return;
      fetched = true;
      untracked(() => {
        this.driverApi.getActiveDrivers().pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)).subscribe((response) =>
          this.driverOptions.set((response?.data?.data ?? []).map((driver) => ({ id: String(driver.id), label: driver.name }))),
        );
        this.maintenanceApi.vehicles().pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef)).subscribe((vehicles) =>
          this.vehicleOptions.set(vehicles.map((vehicle) => ({ id: String(vehicle.id), label: vehicle.name }))),
        );
        this.api.locations().pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef)).subscribe((locations) =>
          this.locationOptions.set(locations.map((location) => ({ id: String(location.id), label: location.address }))),
        );
      });
    });
  }

  protected select(control: 'type' | 'priority' | 'driver' | 'vehicle' | 'pickup' | 'dropoff', option: DropdownOption): void {
    this.form.controls[control].setValue(option.id);this.form.controls[control].markAsDirty();
    this.form.controls[control].markAsTouched();
  }
  protected label(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label ?? fallback;
  }
  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.endTime.value <= this.form.controls.startTime.value || this.saving) return;
    const value = this.form.getRawValue();
    this.saving = true;
    const request = this.api
      .create({
        job_name: value.name.trim(),
        driver: Number(value.driver),
        start_date: toUtcDateTime(value.startTime),
        end_date: toUtcDateTime(value.endTime),
        job_type: Number(value.type),
        tasks: [{ priority: 1, pick_up: Number(value.pickup), drop_off: Number(value.dropoff) }],
      });
    void this.flow
      .submit(this.modal(), request, {
        loading: 'Creating job...',
        success: { title: 'Job created', message: `${value.name.trim()} was created successfully.` },
        failure: { title: 'Unable to create job', message: 'The job could not be created. Please try again.' },
      })
      .then((response) => {
        this.saving = false;
        if (!response) return;
        this.reset();
        this.created.emit();
      });
  }
  protected async cancel(): Promise<void> {
    if (this.saving) return;
    if (!(await this.flow.close(this.modal(), this.form.dirty))) return;
    this.reset();
    this.cancelled.emit();
  }
  protected invalid(name: keyof typeof this.form.controls): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }
  protected invalidRange(): boolean {
    return this.submitted() && !!this.form.controls.startTime.value && !!this.form.controls.endTime.value
      && this.form.controls.endTime.value <= this.form.controls.startTime.value;
  }
  private reset(): void {
    this.form.reset({ name: '', type: '2', priority: 'Normal', driver: '', vehicle: '', pickup: '', dropoff: '', startTime: '', endTime: '', notes: '' });
    this.submitted.set(false);
  }
}
