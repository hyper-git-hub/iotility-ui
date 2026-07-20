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
import { finalize } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { DriverApiService, DriverManager } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-manager-form',
  imports: [BlockingLoader, DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './manager-form.html',
  styleUrl: './manager-form.css',
})
export class ManagerForm implements OnChanges {
  readonly open = input(false);
  readonly manager = input<DriverManager | null>(null);
  readonly cancelled = output<void>();
  readonly saved = output<void>();
  protected readonly editing = computed(() => !!this.manager());
  protected readonly loading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreview = signal('');
  protected readonly maritalOptions: DropdownOption[] = [
    { id: '1', label: 'Single' },
    { id: '2', label: 'Married' },
    { id: '3', label: 'Divorced' },
  ];
  protected readonly genderOptions: DropdownOption[] = [
    { id: '1', label: 'Male' },
    { id: '2', label: 'Female' },
    { id: '3', label: 'Others' },
  ];
  protected readonly statusOptions: DropdownOption[] = [
    { id: '1', label: 'Active' },
    { id: '2', label: 'Inactive' },
  ];
  protected readonly form;
  constructor(
    private readonly fb: FormBuilder,
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {
    const r = Validators.required;
    this.form = this.fb.nonNullable.group({
      name: ['', [r, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      employee_id: ['', [r, Validators.minLength(3), Validators.maxLength(18)]],
      date_of_birth: ['', r],
      date_joined: ['', r],
      salary: ['', [r, Validators.min(0)]],
      marital_status: ['', r],
      gender: ['', r],
      phone: ['+974', [r, Validators.pattern(/^\+?[0-9]{7,15}$/)]],
      status: ['1', r],
    });
  }
  ngOnChanges(c: SimpleChanges): void {
    if (c['open']?.currentValue) this.prepare();
  }
  protected selectMarital(o: DropdownOption): void {
    this.form.controls.marital_status.setValue(o.id);
  }
  protected selectGender(o: DropdownOption): void {
    this.form.controls.gender.setValue(o.id);
  }
  protected selectStatus(o: DropdownOption): void {
    this.form.controls.status.setValue(o.id);
  }
  protected label(opts: DropdownOption[], id: string, f: string): string {
    return opts.find((o) => o.id === id)?.label || f;
  }
  protected chooseImage(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    if (file && file.size > 1_000_000) {
      this.error.set('Picture must be 1 MB or smaller.');
      return;
    }
    this.imageFile.set(file);
    if (file) this.imagePreview.set(URL.createObjectURL(file));
  }
  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const p = new FormData();
    Object.entries(raw).forEach(([k, v]) => p.append(k, String(v)));
    if (!this.editing()) p.append('rfid_tag', '');
    const image = this.imageFile();
    if (image) p.append('image', image, image.name);
    const request = this.editing()
      ? this.api.updateManager(this.manager()!.id, p)
      : this.api.createManager(p);
    this.loading.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async () => {
        const a = this.editing() ? 'updated' : 'added';
        await this.feedback.open({
          type: 'success',
          title: `Manager ${a}`,
          message: `${raw.name} was ${a} successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.saved.emit();
        this.reset();
      },
      error: (r) => {
        const m =
          r.error?.message || `Manager could not be ${this.editing() ? 'updated' : 'created'}.`;
        this.error.set(m);
        void this.feedback.open({
          type: 'error',
          title: `Unable to ${this.editing() ? 'update' : 'add'} manager`,
          message: m,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
  protected cancel(): void {
    if (!this.loading()) {
      this.reset();
      this.cancelled.emit();
    }
  }
  private prepare(): void {
    this.reset();
    const m = this.manager();
    if (m) {
      this.form.patchValue({
        name: m.name,
        employee_id: m.employee_id,
        date_of_birth: m.date_of_birth?.slice(0, 10) || '',
        date_joined: m.date_joined?.slice(0, 10) || '',
        salary: m.salary,
        marital_status: m.marital_status,
        gender: m.gender,
        phone: m.phone || '+974',
        status: m.status || '1',
      });
      this.imagePreview.set(m.image || '');
    }
  }
  private reset(): void {
    this.form.reset({ phone: '+974', status: '1' });
    this.submitted.set(false);
    this.error.set('');
    this.imageFile.set(null);
    this.imagePreview.set('');
  }
}
