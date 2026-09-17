import { inject, Injectable, signal } from '@angular/core';
import { FleetDashboardApiService } from './fleet-dashboard-api.service';
import { ViolationsApiService, ViolationFilters } from './violations-api.service';
import { WORK_ORDERS } from '../../pages/maintenance/maintenance.data';
import { DASHCAM_EVENTS } from '../../pages/dashcam/dashcam.data';
import { jobsData } from '../../pages/jobs/jobs.data';

@Injectable({ providedIn: 'root' })
export class SidebarBadgeService {
  private readonly dashboardApi = inject(FleetDashboardApiService);
  private readonly violationsApi = inject(ViolationsApiService);

  readonly jobsCount = signal<number>(0);
  readonly maintenanceCount = signal<number>(0);
  readonly violationsCount = signal<number>(0);
  readonly dashcamCount = signal<number>(0);

  readonly badgeCounts = signal<Record<string, number>>({});

  constructor() {
    this.loadCounts();
  }

  private loadCounts(): void {
    // Jobs: count pending and in-progress jobs
    const pendingJobs = jobsData.filter(
      (job) => job.status === 'Pending' || job.status === 'In Progress' || job.status === 'Assigned',
    ).length;
    this.jobsCount.set(pendingJobs);

    // Maintenance: count active (non-completed, non-cancelled) work orders
    const activeWorkOrders = WORK_ORDERS.filter(
      (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
    ).length;
    this.maintenanceCount.set(activeWorkOrders);

    // Violations: fetch default month-range count (empty dates => API default month view,
    // matching the Violations page's default filter, per design requirement).
    // Update badgeCounts after the response arrives so the sidebar never shows a stale 0.
    const filters: ViolationFilters = {
      offset: 0,
      limit: 0,
      order_by: '',
      order: '',
      search_text: '',
      violation_type: '',
      driver_id: '',
      start_datetime: '',
      end_datetime: '',
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      group: '0',
    };
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

    // DashCam: count unreviewed events as "live" camera count
    const unreviewedEvents = DASHCAM_EVENTS.filter(
      (event) => event.review === 'Unreviewed',
    ).length;
    this.dashcamCount.set(unreviewedEvents);

    // Jobs + maintenance are synchronous (static data), publish immediately
    this.badgeCounts.set({
      jobs: this.jobsCount(),
      maintenance: this.maintenanceCount(),
      violations: 0,
      dashcam: this.dashcamCount(),
    });
  }
}