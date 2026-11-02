import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { FleetDashboardApiService } from './fleet-dashboard-api.service';
import { ViolationsApiService, ViolationFilters, violationDateRange } from './violations-api.service';
import { MaintenanceApiService } from './maintenance-api.service';
import { JobsApiService } from './jobs-api.service';

@Injectable({ providedIn: 'root' })
export class SidebarBadgeService {
  private readonly dashboardApi = inject(FleetDashboardApiService);
  private readonly violationsApi = inject(ViolationsApiService);
  private readonly maintenanceApi = inject(MaintenanceApiService);
  private readonly jobsApi = inject(JobsApiService);

  readonly jobsCount = signal<number>(0);
  readonly maintenanceCount = signal<number>(0);
  readonly violationsCount = signal<number>(0);
  /** The DashCam API keeps no review state, so there is no unreviewed count to badge. */
  readonly dashcamCount = signal<number>(0);

  readonly badgeCounts = signal<Record<string, number>>({});

  constructor() {
    this.loadCounts();
    // Reloads after work orders are raised or deleted on the Maintenance page.
    effect(() => {
      this.maintenanceApi.version();
      untracked(() => this.loadMaintenanceCount());
    });
    // Reloads after a job is created on the Jobs page.
    effect(() => {
      this.jobsApi.version();
      untracked(() => this.loadJobsCount());
    });
  }

  /** Open jobs: pending (1) and in progress (2). */
  private loadJobsCount(): void {
    this.jobsApi.list().subscribe({
      next: (jobs) => {
        const open = jobs.filter((job) => job.job_status === '1' || job.job_status === '2').length;
        this.jobsCount.set(open);
        this.badgeCounts.update((prev) => ({ ...prev, jobs: open }));
      },
      error: () => undefined,
    });
  }

  /** Active work orders, from the same analytics cards as the Maintenance header. */
  private loadMaintenanceCount(): void {
    this.maintenanceApi.summary().subscribe({
      next: ({ active }) => {
        this.maintenanceCount.set(active);
        this.badgeCounts.update((prev) => ({ ...prev, maintenance: active }));
      },
      error: () => undefined,
    });
  }

  private loadCounts(): void {
    // Count today's violations using the same local-day range as the All Violations page.
    const { start_datetime, end_datetime } = violationDateRange('today');
    const filters: ViolationFilters = {
      offset: 0,
      limit: 0,
      order_by: '',
      order: '',
      search_text: '',
      violation_type: '',
      driver_id: '',
      start_datetime,
      end_datetime,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      group: '0',
    };
    // Publish synchronous badges before subscribing so a cached response
    // cannot be overwritten by the initial zero-count state.
    this.badgeCounts.set({
      jobs: this.jobsCount(),
      maintenance: this.maintenanceCount(),
      violations: 0,
      dashcam: this.dashcamCount(),
    });

    this.violationsApi.getViolations(filters).subscribe({
      next: (response) => {
        const total = response.data?.count ?? 0;
        this.violationsCount.set(total);
        this.badgeCounts.update((prev) => ({ ...prev, violations: total, dashcam: this.dashcamCount(), jobs: this.jobsCount(), maintenance: this.maintenanceCount() }));
      },
      error: () => {
        // Fallback: clear violations badge on API failure
        this.violationsCount.set(0);
        this.badgeCounts.update((prev) => ({ ...prev, violations: 0 }));
      },
    });
  }
}