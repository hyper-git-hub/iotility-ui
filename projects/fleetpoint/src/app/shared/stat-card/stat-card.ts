import { Component, input } from '@angular/core';

export type StatCardTone = 'brand' | 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-stat-card',
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<StatCardTone>('brand');
  readonly animatedBorder = input(false);
  readonly compact = input(false);
  readonly accent = input('');
}
