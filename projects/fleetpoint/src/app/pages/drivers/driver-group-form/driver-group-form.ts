import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BlockingLoader, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { DriverApiService, DriverGroup } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-driver-group-form',
  imports: [BlockingLoader, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './driver-group-form.html',
  styleUrl: './driver-group-form.css',
})
export class DriverGroupForm implements OnChanges {
  readonly open = input(false);
  readonly group = input<DriverGroup | null>(null);
  readonly cancelled = output<void>();
  readonly created = output<void>();
  protected readonly loading = signal(false);
  protected readonly optionsLoading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly driverOptions = signal<DropdownOption[]>([]);
  protected readonly editing = computed(() => !!this.group());
  protected readonly form;

  constructor(private readonly fb: FormBuilder, private readonly api: DriverApiService, private readonly feedback: FeedbackDialogBridgeService) {
    this.form = this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      drivers_list: this.fb.nonNullable.control<string[]>([], Validators.required),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) { this.reset(); this.patchGroup(); this.loadDrivers(true); }
  }

  protected loadDrivers(force = false): void {
    if ((!force && this.driverOptions().length) || this.optionsLoading()) return;
    this.optionsLoading.set(true); this.error.set('');
    this.api.getActiveDrivers().pipe(finalize(() => this.optionsLoading.set(false))).subscribe({
      next: (response) => {
        const current = this.group()?.drivers ?? [];
        const active = (response.data?.data ?? []).filter((driver) => driver.status === '1');
        const available = [...current, ...active.filter((driver) => !current.some((item) => item.id === driver.id))];
        this.driverOptions.set(available.map((driver) => ({ id: String(driver.id), label: driver.name, description: driver.employee_id })));
      },
      error: (response) => this.error.set(response.error?.message || 'Drivers could not be loaded.'),
    });
  }
  protected selectionChanged(ids: string[]): void { this.form.controls.drivers_list.setValue(ids); this.form.controls.drivers_list.markAsTouched(); }
  protected selectedLabel(): string {
    const count = this.form.controls.drivers_list.value.length;
    return count ? `${count} driver${count === 1 ? '' : 's'} selected` : 'Select drivers';
  }
  protected submit(): void {
    this.submitted.set(true); this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.drivers_list.value.length) return;
    const raw = this.form.getRawValue();
    this.loading.set(true); this.error.set('');
    const payload = { name: raw.name.trim(), drivers_list: raw.drivers_list.map(Number) };
    const request = this.editing() ? this.api.updateDriverGroup(this.group()!.id, payload) : this.api.createDriverGroup(payload);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async () => {
        const action = this.editing() ? 'updated' : 'added';
        await this.feedback.open({ type: 'success', title: `Driver group ${action}`, message: `${raw.name.trim()} was ${action} successfully.`, confirmText: 'Done', showCancel: false });
        this.created.emit(); this.reset();
      },
      error: (response) => {
        const message = response.error?.message || 'Driver group could not be created.';
        this.error.set(message); void this.feedback.open({ type: 'error', title: 'Unable to add driver group', message, confirmText: 'Close', showCancel: false });
      },
    });
  }
  protected cancel(): void { if (this.loading()) return; this.reset(); this.cancelled.emit(); }
  private reset(): void { this.form.reset({ name: '', drivers_list: [] }); this.submitted.set(false); this.error.set(''); }
  private patchGroup(): void { const group = this.group(); if (group) this.form.patchValue({ name: group.name, drivers_list: group.drivers_list.map(String) }); }
}
