import { Component, OnChanges, SimpleChanges, computed, input, output, signal, inject, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import {
  FleetInventoryApiService,
  FleetInventoryRecord,
} from '../../../shared/services/fleet-inventory-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { Modal } from '../../../shared/modal/modal';

@Component({
  selector: 'app-fleet-form',
  imports: [Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './fleet-form.html',
  styleUrl: './fleet-form.css',
})
export class FleetForm implements OnChanges {
  readonly open = input(false);
  readonly fleet = input<FleetInventoryRecord | null>(null);
  readonly cancelled = output<void>();
  readonly saved = output<void>();
  protected readonly submitted = signal(false);
  /** True from submit until the form flow finishes (fold away, request, feedback). */
  protected readonly loading = signal(false);
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  protected readonly optionsLoading = signal(false);
  protected readonly vehicleOptions = signal<DropdownOption[]>([]);
  protected readonly editing = computed(() => !!this.fleet());
  protected readonly form;

  constructor(
    formBuilder: FormBuilder,
    private readonly api: FleetInventoryApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {
    this.form = formBuilder.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      vehicle: formBuilder.nonNullable.control<string[]>([], Validators.required),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.loadVehicles();
      this.patchFleet();
    }
  }

  protected selectVehicles(ids: string[]): void {
    this.form.controls.vehicle.setValue(ids);
    this.form.controls.vehicle.markAsTouched();
  }

  protected vehiclesLabel(): string {
    const count = this.form.controls.vehicle.value.length;
    return count ? `${count} vehicle${count === 1 ? '' : 's'} selected` : 'Select Vehicles';
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.vehicle.value.length) return;
    const value = this.form.getRawValue();
    const payload = { name: value.name.trim(), vehicle: value.vehicle.map(Number) };
    const fleet = this.fleet();
    const request = fleet ? this.api.updateFleet(fleet.id, payload) : this.api.createFleet(payload);
    this.loading.set(true);
    void this.flow
      .submit(this.modal(), request, {
        loading: fleet ? 'Updating fleet...' : 'Creating fleet...',
        success: {
          title: fleet ? 'Fleet updated' : 'Fleet created',
          message: (response) => response.message || `The fleet was ${fleet ? 'updated' : 'created'} successfully.`,
        },
        failure: { title: 'Unable to save fleet', message: 'The fleet could not be saved.' },
      })
      .then((response) => {
        this.loading.set(false);
        if (!response) return;
        this.reset();
        this.saved.emit();
      });
  }
  protected async cancel(): Promise<void> {
    if (this.loading()) return;
    if (!(await this.flow.close(this.modal(), this.form.dirty))) return;
    this.reset();
    this.cancelled.emit();
  }

  private loadVehicles(): void {
    this.optionsLoading.set(true);
    this.api
      .getVehicleOptions()
      .pipe(finalize(() => this.optionsLoading.set(false)))
      .subscribe({
        next: (response) =>
          this.vehicleOptions.set(
            (response.data?.data ?? [])
              .filter((vehicle) => {
                const assignedIds = new Set(
                  (this.fleet()?.assigned_vehicles ?? []).map((assigned) => assigned.id),
                );
                return (
                  vehicle.status === 1 || vehicle.status === '1' || assignedIds.has(vehicle.id)
                );
              })
              .map((vehicle) => ({
                id: String(vehicle.id),
                label: vehicle.name || vehicle.registration || `Vehicle ${vehicle.id}`,
              })),
          ),
        error: (response) => {
          const message = response.error?.message || 'Vehicles could not be loaded.';
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load vehicles',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }

  private patchFleet(): void {
    const fleet = this.fleet();
    this.form.reset({
      name: fleet?.name ?? '',
      vehicle: (fleet?.assigned_vehicles ?? []).map((vehicle) => String(vehicle.id)),
    });
    this.submitted.set(false);
  }

  private reset(): void {
    this.form.reset({ name: '', vehicle: [] });
    this.submitted.set(false);
  }
}
