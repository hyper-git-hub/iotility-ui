import { Component, input, output, signal, inject, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { DeviceCategory } from '../devices.data';

export interface DeviceFormValue {
  imei: string;
  serial: string;
  model: string;
  manufacturer: string;
  category: DeviceCategory;
}

@Component({
  selector: 'app-device-form',
  imports: [Dropdown, Modal, ReactiveFormsModule],
  templateUrl: './device-form.html',
  styleUrl: './device-form.css',
})
export class DeviceForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  readonly created = output<DeviceFormValue>();
  protected readonly submitted = signal(false);
  protected readonly typeOptions: DropdownOption[] = [
    { id: 'gps-tracker', label: 'GPS Tracker' },
    { id: 'dashcam', label: 'DashCam' },
    { id: 'temp-sensor', label: 'Temperature Sensor' },
    { id: 'fuel-sensor', label: 'Fuel Sensor' },
    { id: 'rfid-reader', label: 'RFID Reader' },
    { id: 'eye-sensor', label: 'Eye/Fatigue Sensor' },
  ];
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      imei: ['', [Validators.required, Validators.pattern(/^\d{15}$/)]],
      serial: ['', Validators.required],
      model: ['', Validators.required],
      manufacturer: ['', Validators.required],
      category: ['gps-tracker' as DeviceCategory, Validators.required],
    });
  }

  protected select(option: DropdownOption): void {
    this.form.controls.category.setValue(option.id as DeviceCategory);
    this.form.controls.category.markAsTouched();
  }

  protected typeLabel(): string {
    return (
      this.typeOptions.find((option) => option.id === this.form.controls.category.value)?.label ??
      ''
    );
  }

  protected invalid(control: 'imei' | 'serial' | 'model' | 'manufacturer'): boolean {
    return this.submitted() && this.form.controls[control].invalid;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    void this.flow.close(this.modal()).then(() => {
      this.created.emit(value);
      this.reset();
    });
  }

  protected async cancel(): Promise<void> {
    if (!(await this.flow.close(this.modal(), this.form.dirty))) return;
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.form.reset({ imei: '', serial: '', model: '', manufacturer: '', category: 'gps-tracker' });
    this.submitted.set(false);
  }
}
