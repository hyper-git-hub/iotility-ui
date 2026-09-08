import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { LiveTrackingApiService } from './live-tracking-api.service';

const hasSessionToken = () =>
  Boolean(localStorage.getItem('userMS-token') || localStorage.getItem('token'));

@Injectable({ providedIn: 'root' })
export class FleetStatusService {
  readonly onlineCount = signal(0);
  readonly totalCount = signal(0);
  readonly hasOnlineVehicles = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(LiveTrackingApiService);

  constructor() {
    this.refresh();
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  update(total: number, online: number): void {
    this.totalCount.set(total);
    this.onlineCount.set(online);
    this.hasOnlineVehicles.set(online > 0);
  }

  private refresh(): void {
    // Stop calling the backend once the session is gone (e.g. the same account
    // was signed in elsewhere and the 401 interceptor cleared the token).
    if (!hasSessionToken()) {
      this.update(0, 0);
      return;
    }
    this.api.getVehicles().subscribe({
      next: (response) => {
        const vehicles = response.data?.data ?? [];
        this.update(vehicles.length, vehicles.filter((vehicle) => vehicle.online_status).length);
      },
    });
  }
}
