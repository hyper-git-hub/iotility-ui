import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';

export interface JobFormValue {
  name: string;
  type: string;
  priority: string;
  driver: string;
  vehicle: string;
  pickup: string;
  dropoff: string;
  startTime: string;
  endTime: string;
  notes: string;
}

@Component({
  selector: 'app-job-form',
  imports: [DateTimePicker, Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './job-form.html',
  styleUrl: './job-form.css',
})
export class JobForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<JobFormValue>();
  protected readonly submitted = signal(false);
  protected readonly typeOptions: DropdownOption[] = [
    { id: 'Delivery', label: 'Delivery' },
    { id: 'Collection', label: 'Collection' },
    { id: 'Ad Hoc', label: 'Ad Hoc' },
    { id: 'Inspection', label: 'Inspection' },
    { id: 'Transfer', label: 'Transfer' },
  ];
  protected readonly priorityOptions: DropdownOption[] = [
    { id: 'Normal', label: 'Normal' },
    { id: 'High', label: 'High' },
    { id: 'Low', label: 'Low' },
  ];
  protected readonly driverOptions: DropdownOption[] = [
    { id: 'James Hartley', label: 'James Hartley' },
    { id: 'Thomas Griffiths', label: 'Thomas Griffiths' },
    { id: 'Oliver Pemberton', label: 'Oliver Pemberton' },
    { id: 'Priya Sharma', label: 'Priya Sharma' },
    { id: 'Aisha Okonkwo', label: 'Aisha Okonkwo' },
    { id: 'Sarah Whitfield', label: 'Sarah Whitfield' },
    { id: 'Connor McBride', label: 'Connor McBride' },
    { id: 'Mohammed Al-Rashid', label: 'Mohammed Al-Rashid' },
  ];
  protected readonly vehicleOptions: DropdownOption[] = [
    { id: 'LP-4821', label: 'LP-4821' }, { id: 'LP-6612', label: 'LP-6612' },
    { id: 'LP-3312', label: 'LP-3312' }, { id: 'LP-5531', label: 'LP-5531' },
    { id: 'LP-2201', label: 'LP-2201' }, { id: 'LP-2244', label: 'LP-2244' },
    { id: 'LP-9901', label: 'LP-9901' }, { id: 'LP-3388', label: 'LP-3388' },
  ];
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      name: ['', Validators.required],
      type: ['Delivery', Validators.required],
      priority: ['Normal', Validators.required],
      driver: ['', Validators.required],
      vehicle: [''],
      pickup: ['', Validators.required],
      dropoff: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      notes: [''],
    });
  }

  protected select(control: 'type' | 'priority' | 'driver' | 'vehicle', option: DropdownOption): void {
    this.form.controls[control].setValue(option.id);
    this.form.controls[control].markAsTouched();
  }
  protected label(options: DropdownOption[], value: string, fallback: string): string {
    return options.find((option) => option.id === value)?.label ?? fallback;
  }
  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.endTime.value <= this.form.controls.startTime.value) return;
    this.created.emit(this.form.getRawValue());
    this.reset();
  }
  protected cancel(): void { this.reset(); this.cancelled.emit(); }
  protected invalid(name: keyof typeof this.form.controls): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }
  protected invalidRange(): boolean {
    return this.submitted() && !!this.form.controls.startTime.value && !!this.form.controls.endTime.value
      && this.form.controls.endTime.value <= this.form.controls.startTime.value;
  }
  private reset(): void {
    this.form.reset({ name: '', type: 'Delivery', priority: 'Normal', driver: '', vehicle: '', pickup: '', dropoff: '', startTime: '', endTime: '', notes: '' });
    this.submitted.set(false);
  }
}
