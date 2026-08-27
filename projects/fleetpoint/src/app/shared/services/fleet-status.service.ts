import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FleetStatusService {
  readonly onlineCount = signal(0);
  readonly totalCount = signal(0);
  readonly hasOnlineVehicles = signal(false);

  update(total: number, online: number): void {
    this.totalCount.set(total);
    this.onlineCount.set(online);
    this.hasOnlineVehicles.set(online > 0);
  }
}
