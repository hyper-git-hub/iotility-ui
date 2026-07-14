import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../shared/modal/modal';

export interface FleetFormValue {
  name: string;
  description: string;
  depotLocation: string;
  color: string;
}

@Component({
  selector: 'app-fleet-form',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './fleet-form.html',
  styleUrl: './fleet-form.css',
})
export class FleetForm {
  readonly open = input(false);
  readonly cancelled = output<void>();
  readonly created = output<FleetFormValue>();
  protected readonly submitted = signal(false);
  protected readonly selectedColor = signal('var(--color-brand-500)');
  protected readonly colors = [
    'var(--color-brand-500)',
    'var(--color-info)',
    'var(--color-warning)',
    'var(--color-success)',
    'var(--color-danger)',
    'var(--color-brand-400)',
    'var(--color-brand-700)',
  ];
  protected readonly form;

  constructor(formBuilder: FormBuilder) {
    this.form = formBuilder.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', Validators.required],
      depotLocation: ['', Validators.required],
    });
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.created.emit({ ...this.form.getRawValue(), color: this.selectedColor() });
    this.form.reset();
    this.selectedColor.set('var(--color-brand-500)');
    this.submitted.set(false);
  }

  protected cancel(): void {
    this.form.reset();
    this.submitted.set(false);
    this.cancelled.emit();
  }
}
