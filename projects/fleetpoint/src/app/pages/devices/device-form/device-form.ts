import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
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
    this.created.emit(this.form.getRawValue());
    this.reset();
  }

  protected cancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.form.reset({ imei: '', serial: '', model: '', manufacturer: '', category: 'gps-tracker' });
    this.submitted.set(false);
  }
}
