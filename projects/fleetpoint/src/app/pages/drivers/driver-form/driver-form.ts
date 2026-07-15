import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BlockingLoader, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { DriverApiService, DriverGroup, DriverRecord } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-driver-form',
  imports: [BlockingLoader, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './driver-form.html',
  styleUrl: './driver-form.css',
})
export class DriverForm implements OnChanges {
  readonly open = input(false);
  readonly groups = input<DriverGroup[]>([]);
  readonly driver = input<DriverRecord | null>(null);
  readonly cancelled = output<void>();
  readonly created = output<void>();
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal('');
  protected readonly editing = computed(() => !!this.driver());
  protected readonly genderOptions: DropdownOption[] = [{ id: '1', label: 'Male' }, { id: '2', label: 'Female' }, { id: '3', label: 'Others' }];
  protected readonly maritalOptions: DropdownOption[] = [{ id: '1', label: 'Single' }, { id: '2', label: 'Married' }, { id: '3', label: 'Divorced' }];
  protected readonly statusOptions: DropdownOption[] = [{ id: '1', label: 'Active' }, { id: '2', label: 'Inactive' }];
  protected readonly groupOptions = computed<DropdownOption[]>(() => [{ id: '', label: 'No group' }, ...this.groups().map((group) => ({ id: String(group.id), label: group.name }))]);
  protected readonly form;

  constructor(private readonly fb: FormBuilder, private readonly api: DriverApiService, private readonly feedback: FeedbackDialogBridgeService) {
    const required = Validators.required;
    this.form = this.fb.nonNullable.group({
      name: ['', required], employee_id: ['', required], dob: ['', required], data_joined: ['', required], salary: ['', [required, Validators.min(0)]],
      marital_status: ['', required], gender: ['', required], phone: ['+974', [required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      licence_number: ['', [required, Validators.minLength(9), Validators.maxLength(20)]], licence_expiry_date: ['', required], email: ['', [required, Validators.email]],
      password: ['', [required, Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/)]],
      group: [''], poi: [false], status: ['1', required],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) this.prepareForm();
    else if (changes['groups'] && this.open() && this.driver()) this.patchGroup();
  }

  protected selectGender(option: DropdownOption): void { this.form.controls.gender.setValue(option.id); }
  protected selectMarital(option: DropdownOption): void { this.form.controls.marital_status.setValue(option.id); }
  protected selectGroup(option: DropdownOption): void { this.form.controls.group.setValue(option.id); }
  protected selectStatus(option: DropdownOption): void { this.form.controls.status.setValue(option.id); }
  protected togglePassword(): void { this.showPassword.update((value) => !value); }
  protected optionLabel(options: DropdownOption[], id: string, fallback: string): string { return options.find((option) => option.id === id)?.label || fallback; }
  protected chooseImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile.set(file);
    if (file) this.imagePreview.set(URL.createObjectURL(file));
  }

  protected submit(): void {
    this.submitted.set(true); this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const payload = new FormData();
    Object.entries(raw).forEach(([key, value]) => {
      if (key !== 'password' || !this.editing()) payload.append(key, String(value ?? ''));
    });
    if (!this.editing()) payload.append('rfid_tag', '');
    const image = this.imageFile();
    if (image) payload.append('image', image, image.name);
    this.loading.set(true); this.error.set('');
    const request = this.editing() ? this.api.updateDriver(this.driver()!.id, payload) : this.api.createDriver(payload);
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async () => {
        const action = this.editing() ? 'updated' : 'added';
        await this.feedback.open({ type: 'success', title: `Driver ${action}`, message: `${raw.name} was ${action} successfully.`, confirmText: 'Done', showCancel: false });
        this.created.emit(); this.reset();
      },
      error: (response) => {
        const message = response.error?.message || `Driver could not be ${this.editing() ? 'updated' : 'created'}.`;
        this.error.set(message);
        void this.feedback.open({ type: 'error', title: `Unable to ${this.editing() ? 'update' : 'add'} driver`, message, confirmText: 'Close', showCancel: false });
      },
    });
  }
  protected cancel(): void { if (this.loading()) return; this.reset(); this.cancelled.emit(); }

  private reset(): void {
    this.form.reset({ phone: '+974', poi: false, status: '1' }); this.submitted.set(false); this.error.set(''); this.showPassword.set(false); this.imageFile.set(null); this.imagePreview.set('');
  }

  private prepareForm(): void {
    this.reset();
    const password = this.form.controls.password;
    if (this.editing()) {
      password.clearValidators(); password.updateValueAndValidity();
      const driver = this.driver()!;
      this.form.patchValue({
        name: driver.name, employee_id: driver.employee_id, dob: driver.dob?.slice(0, 10) || '', data_joined: driver.data_joined?.slice(0, 10) || '',
        salary: driver.salary || '', marital_status: driver.marital_status || '', gender: driver.gender || '', phone: driver.phone || '+974',
        licence_number: driver.licence_number || '', licence_expiry_date: driver.licence_expiry_date?.slice(0, 10) || '', email: driver.email || '',
        poi: !!driver.poi, status: driver.status || '1',
      });
      this.imagePreview.set(driver.image || ''); this.patchGroup();
    } else {
      password.setValidators([Validators.required, Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/)]);
      password.updateValueAndValidity();
    }
  }

  private patchGroup(): void {
    const groupName = this.driver()?.group;
    this.form.controls.group.setValue(groupName ? String(this.groups().find((group) => group.name === groupName)?.id ?? '') : '');
  }
}
