import { Component, input } from '@angular/core';
import { Skeleton } from '@iotility/shared-ui';

export type StatCardTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'priority';

@Component({
  selector: 'app-stat-card',
  imports: [Skeleton],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<StatCardTone>('brand');
  readonly animatedBorder = input(false);
  readonly compact = input(false);
  readonly showIcon = input(true);
  readonly accent = input('');
  /** Swaps only the value for a skeleton, keeping the icon, label and card chrome. */
  readonly loading = input(false);
}
