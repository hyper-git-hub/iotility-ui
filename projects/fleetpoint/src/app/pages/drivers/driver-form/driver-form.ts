import { Component, OnChanges, SimpleChanges, computed, input, output, signal, inject, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import {
  DriverApiService,
  DriverGroup,
  DriverRfidDevice,
  DriverRecord,
} from '../../../shared/services/driver-api.service';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { FeatureAccessService } from '../../../shared/services/feature-access.service';

@Component({
  selector: 'app-driver-form',
  imports: [DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './driver-form.html',
  styleUrl: './driver-form.css',
})
export class DriverForm implements OnChanges {
  readonly open = input(false);
  readonly groups = input<DriverGroup[]>([]);
  readonly driver = input<DriverRecord | null>(null);
  readonly cancelled = output<void>();
  readonly created = output<void>();
  /** True from submit until the form flow finishes (fold away, request, feedback). */
  protected readonly loading = signal(false);
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal('');
  protected readonly imageRemoved = signal(false);
  protected readonly rfidDevices = signal<DriverRfidDevice[]>([]);
  protected readonly editing = computed(() => !!this.driver());
  protected readonly genderOptions: DropdownOption[] = [
    { id: '1', label: 'Male' },
    { id: '2', label: 'Female' },
    { id: '3', label: 'Others' },
  ];
  protected readonly maritalOptions: DropdownOption[] = [
    { id: '1', label: 'Single' },
    { id: '2', label: 'Married' },
    { id: '3', label: 'Divorced' },
  ];
  protected readonly statusOptions: DropdownOption[] = [
    { id: '1', label: 'Active' },
    { id: '2', label: 'Inactive' },
  ];
  protected readonly groupOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'No group' },
    ...this.groups().map((group) => ({ id: String(group.id), label: group.name })),
  ]);
  protected readonly rfidOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'No RFID device' },
    ...this.rfidDevices().map((device) => ({ id: device.device_id, label: device.device_id })),
  ]);
  protected readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly api: DriverApiService,
    private readonly features: FeatureAccessService,
  ) {
    const required = Validators.required;
    this.form = this.fb.nonNullable.group({
      name: ['', required],
      employee_id: ['', required],
      dob: ['', required],
      data_joined: ['', required],
      salary: ['', Validators.min(0)],
      marital_status: [''],
      gender: ['', required],
      phone: ['+974', [required, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      email: ['', [required, Validators.email]],
      password: [
        '',
        [required, Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/)],
      ],
      group: [''],
      rfid_tag: [''],
      beacon_id: ['', Validators.maxLength(300)],
      poi: [false],
      status: ['1', required],
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.prepareForm();
      this.loadRfidDevices();
    } else if (changes['groups'] && this.open() && this.driver()) this.patchGroup();
  }

  protected selectGender(option: DropdownOption): void {
    this.form.controls.gender.setValue(option.id);this.form.controls.gender.markAsDirty();
  }
  protected selectMarital(option: DropdownOption): void {
    this.form.controls.marital_status.setValue(option.id);
  }
  protected selectGroup(option: DropdownOption): void {
    this.form.controls.group.setValue(option.id);this.form.controls.group.markAsDirty();
  }
  protected selectStatus(option: DropdownOption): void {
    this.form.controls.status.setValue(option.id);this.form.controls.status.markAsDirty();
  }
  protected selectRfid(option: DropdownOption): void {
    this.form.controls.rfid_tag.setValue(option.id);
  }
  protected hasFeature(featureId: number): boolean {
    return this.features.has(featureId);
  }
  protected togglePassword(): void {
    this.showPassword.update((value) => !value);
  }
  protected optionLabel(options: DropdownOption[], id: string, fallback: string): string {
    return options.find((option) => option.id === id)?.label || fallback;
  }
  protected chooseImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 1_000_000) {
      this.error.set('Driver picture must be 1 MB or smaller.');
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.imageFile.set(file);
    if (file) {
      this.imagePreview.set(URL.createObjectURL(file));
      this.imageRemoved.set(false);
      this.error.set('');
    }
  }
  protected removeImage(): void {
    this.imageFile.set(null);
    this.imagePreview.set('');
    this.imageRemoved.set(true);
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const birthDate = new Date(`${raw.dob}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayPending =
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (birthdayPending) age--;
    if (!Number.isFinite(age) || age < 18) {
      this.error.set('Driver must be 18 years or older.');
      return;
    }
    const payload = new FormData();
    Object.entries(raw).forEach(([key, value]) => {
      if (key === 'password' && this.editing()) return;
      if (key === 'beacon_id') {
        if (this.hasFeature(4021) && value) payload.append('eye_beacon', String(value));
        return;
      }
      if (key === 'poi' && !this.hasFeature(10)) return;
      payload.append(key, String(value ?? ''));
    });
    if (this.hasFeature(4021)) {
      payload.append('feature_id', '4021');
      payload.append('param_id', '1600');
    } else if (this.hasFeature(121)) {
      payload.append('param_id', '30000');
    }
    const image = this.imageFile();
    if (image) payload.append('image', image, image.name);
    this.loading.set(true);
    this.error.set('');
    const request = this.editing()
      ? this.api.updateDriver(this.driver()!.id, payload, this.imageRemoved())
      : this.api.createDriver(payload);
    const editing = this.editing();
    const action = editing ? 'updated' : 'added';
    void this.flow
      .submit(this.modal(), request, {
        loading: editing ? 'Updating driver...' : 'Creating driver...',
        success: { title: `Driver ${action}`, message: `${raw.name} was ${action} successfully.` },
        failure: { title: `Unable to ${editing ? 'update' : 'add'} driver`, message: `Driver could not be ${editing ? 'updated' : 'created'}.` },
      })
      .then((response) => {
        this.loading.set(false);
        if (!response) return;
        this.created.emit();
        this.reset();
      });
  }
  protected async cancel(): Promise<void> {
    if (this.loading()) return;
    if (!(await this.flow.close(this.modal(), this.form.dirty))) return;
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.form.reset({ phone: '+974', poi: false, status: '1' });
    this.submitted.set(false);
    this.error.set('');
    this.showPassword.set(false);
    this.imageFile.set(null);
    this.imagePreview.set('');
    this.imageRemoved.set(false);
  }

  private prepareForm(): void {
    this.reset();
    const password = this.form.controls.password;
    if (this.editing()) {
      password.clearValidators();
      password.updateValueAndValidity();
      const driver = this.driver()!;
      this.form.patchValue({
        name: driver.name,
        employee_id: driver.employee_id,
        dob: driver.dob?.slice(0, 10) || '',
        data_joined: driver.data_joined?.slice(0, 10) || '',
        salary: driver.salary || '',
        marital_status: driver.marital_status || '',
        gender: driver.gender || '',
        phone: driver.phone || '+974',
        email: driver.email || '',
        rfid_tag: driver.rfid_tag || '',
        beacon_id: driver.eye_beacon || '',
        poi: !!driver.poi,
        status: String(driver.status || '1'),
      });
      this.imagePreview.set(driver.image || '');
      this.patchGroup();
    } else {
      password.setValidators([
        Validators.required,
        Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/),
      ]);
      password.updateValueAndValidity();
    }
  }

  private patchGroup(): void {
    const groupName = this.driver()?.group;
    this.form.controls.group.setValue(
      groupName ? String(this.groups().find((group) => group.name === groupName)?.id ?? '') : '',
    );
  }

  private loadRfidDevices(): void {
    this.api.getAvailableRfidDevices().subscribe({
      next: (response) => {
        const available = response.data?.data ?? [];
        const assigned = this.driver()?.rfid_tag;
        this.rfidDevices.set(
          assigned && !available.some((device) => device.device_id === assigned)
            ? [{ id: 0, device_id: assigned }, ...available]
            : available,
        );
      },
      error: () => this.rfidDevices.set([]),
    });
  }
}
