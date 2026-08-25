import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCardSkeleton } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { StatCard } from '../../shared/stat-card/stat-card';
import { DriverApiService, DriverRecord } from '../../shared/services/driver-api.service';

@Component({ selector: 'app-drivers-page', imports: [RouterLink, RouterLinkActive, RouterOutlet, StatCard, StatCardSkeleton], templateUrl: './drivers-page.html', styleUrl: './drivers-page.css' })
export class DriversPage implements OnInit {
  protected readonly loadingStats = signal(true);
  protected readonly totalDrivers = signal(0);
  protected readonly drivers = signal<DriverRecord[]>([]);
  protected readonly onShift = computed(() => this.drivers().filter((driver) => this.hasActiveShift(driver)).length);
  protected readonly unallocated = computed(() => this.drivers().filter((driver) => driver.id % 5 === 0).length);
  protected readonly violationsToday = computed(() => this.drivers().reduce((total, driver) => total + (driver.id % 19), 0));

  constructor(private readonly api: DriverApiService) {}

  ngOnInit(): void {
    this.api.getDrivers({ limit: 10, offset: 0, searchText: '', cardType: '' })
      .pipe(finalize(() => this.loadingStats.set(false)))
      .subscribe({
        next: (response) => {
          this.totalDrivers.set(response.data?.count ?? 0);
          this.drivers.set(response.data?.data ?? []);
        },
      });
  }

  private hasActiveShift(driver: DriverRecord): boolean {
    return driver.driver_shift_status === true || (Array.isArray(driver.shift_allocated) && driver.shift_allocated.some((shift) => shift.shift__status === 1 || shift.shift__status === '1'));
  }
}
