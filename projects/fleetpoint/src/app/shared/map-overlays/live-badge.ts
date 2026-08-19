import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { Skeleton } from '@iotility/shared-ui';

@Component({
  selector: 'app-live-badge',
  imports: [Skeleton],
  templateUrl: './live-badge.html',
  styleUrl: './live-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveBadge {
  readonly vehicleCount = input.required<number>();
  readonly isLive = input(true);
  readonly loading = input(false);

  private readonly now = signal(Date.now());
  readonly currentTime = computed(() => {
    const date = new Date(this.now());
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  });

  constructor() {
    interval(1_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.now.set(Date.now()));
  }
}
