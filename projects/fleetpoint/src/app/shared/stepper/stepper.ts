import { Component, input, output } from '@angular/core';

export interface StepperStep {
  id: string;
  label: string;
  description?: string;
}

@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.html',
  styleUrl: './stepper.css',
})
export class Stepper {
  readonly steps = input.required<StepperStep[]>();
  readonly activeIndex = input(0);
  readonly stepSelected = output<number>();

  protected select(index: number): void {
    if (index <= this.activeIndex()) this.stepSelected.emit(index);
  }
}
