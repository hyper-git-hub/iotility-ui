import { Component, input } from '@angular/core';
import { Skeleton } from './skeleton';

@Component({
  selector: 'ui-stat-card-skeleton',
  imports: [Skeleton],
  templateUrl: './stat-card-skeleton.html',
  styleUrl: './stat-card-skeleton.css',
})
export class StatCardSkeleton {
  readonly compact = input(false);
  readonly valueWidth = input('3.5rem');
  readonly labelWidth = input('6.5rem');
}
