import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';

export interface ManualViolationValue {
  driver: string;
  category: string;
  type: string;
  severity: string;
  description: string;
  fineAmount: number;
  fineDueDate: string;
}

@Component({
  selector: 'app-manual-violation-form',
  imports: [DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './manual-violation-form.html',
  styleUrl: './manual-violation-form.css',
})
export class ManualViolationForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<ManualViolationValue>();
  protected readonly submitted = signal(false);
  protected readonly driverOptions: DropdownOption[] = [
    'James Hartley', 'Thomas Griffiths', 'Oliver Pemberton', 'Priya Sharma',
    'Aisha Okonkwo', 'Sarah Whitfield', 'Connor McBride', 'Mohammed Al-Rashid',
  ].map((label) => ({ id: label, label }));
  protected readonly categoryOptions: DropdownOption[] = [
    'Speeding', 'Behaviour', 'Safety', 'Compliance', 'Geozone',
  ].map((label) => ({ id: label, label }));
  protected readonly severityOptions: DropdownOption[] = [
    'Critical', 'High', 'Medium', 'Low',
  ].map((label) => ({ id: label, label }));
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      driver: ['', Validators.required],
      category: ['Speeding', Validators.required],
      type: ['', Validators.required],
      severity: ['Critical', Validators.required],
      description: ['', Validators.required],
      fineAmount: [0, Validators.min(0)],
      fineDueDate: [''],
    });
  }

  protected select(control: 'driver' | 'category' | 'severity', option: DropdownOption): void {
    this.form.controls[control].setValue(option.id);
    this.form.controls[control].markAsTouched();
  }
  protected label(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label ?? fallback;
  }
  protected invalid(control: keyof typeof this.form.controls): boolean {
    return this.submitted() && this.form.controls[control].invalid;
  }
  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.created.emit(this.form.getRawValue());
    this.reset();
  }
  protected cancel(): void {
    this.reset();
    this.cancelled.emit();
  }
  private reset(): void {
    this.form.reset({ driver: '', category: 'Speeding', type: '', severity: 'Critical', description: '', fineAmount: 0, fineDueDate: '' });
    this.submitted.set(false);
  }
}
