import { Skeleton, lingerWhileClosing } from '@iotility/shared-ui';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  DataTable,
  DataTableSkeleton,
  DropdownOption,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { Subscription, catchError, of } from 'rxjs';
import { DriverApiService } from '../../shared/services/driver-api.service';
import { JobApiRecord, JobsApiService } from '../../shared/services/jobs-api.service';
import { MaintenanceApiService } from '../../shared/services/maintenance-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { JobForm } from './job-form/job-form';
import { JobRecord, JobStatus, NOT_AVAILABLE, toJobRecord } from './jobs.data';

/** Dispatch calendar: 06:00–20:00 in half-hour slots; grid column 1 is the driver. */
const DISPATCH_START_HOUR = 6;
const DISPATCH_SLOTS = 28;
const DISPATCH_TONE: Record<JobStatus, string> = {
  Pending: 'pending',
  Assigned: 'assigned',
  'In Progress': 'progress',
  Completed: 'completed',
  Failed: 'failed',
};

@Component({
  selector: 'app-jobs-page',
  imports: [DataTable, DataTableSkeleton, FilterBar, JobForm, Skeleton, StatCard],
  templateUrl: './jobs-page.html',
  styleUrl: './jobs-page.css',
})
export class JobsPage {
  private readonly router = inject(Router);
  private readonly api = inject(JobsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  protected readonly search = signal('');
  protected readonly filter = signal('all');
  protected readonly jobTypeFilter = signal('all');
  protected readonly driverFilter = signal('all');
  private readonly appliedStatusFilter = signal('all');
  private readonly appliedJobTypeFilter = signal('all');
  private readonly appliedDriverFilter = signal('all');
  protected readonly selectedJob = signal<JobRecord | null>(null);
  /** Drawer content stays rendered while the drawer animates shut. */
  protected readonly shownJob = lingerWhileClosing(this.selectedJob);
  protected readonly activeView = signal<'list' | 'dispatch'>('list');
  protected readonly jobFormOpen = signal(false);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly notAvailable = NOT_AVAILABLE;
  /** False until the first jobs response; stat cards, the table and the calendar show skeletons. */
  protected readonly loaded = signal(false);
  protected readonly skeletonRows = [0, 1, 2, 3, 4];
  protected readonly today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  protected readonly dispatchHours = Array.from(
    { length: DISPATCH_SLOTS / 2 },
    (_, index) => `${String(index + DISPATCH_START_HOUR).padStart(2, '0')}:00`,
  );

  private readonly records = signal<JobApiRecord[]>([]);
  private readonly vehicleNames = signal<ReadonlyMap<string, string>>(new Map());
  private readonly jobs = computed(() => this.records().map((record) => toJobRecord(record, this.vehicleNames())));
  private readonly drivers = signal<DropdownOption[]>([]);

  protected readonly filterOptions: DropdownOption[] = [
    { id: 'all', label: 'All statuses' },
    { id: 'pending', label: 'Pending' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'high-priority', label: 'High priority' },
  ];
  protected readonly jobTypeOptions: DropdownOption[] = [
    { id: 'all', label: 'All job types' },
    { id: 'ad-hoc', label: 'Ad-Hoc' },
    { id: 'scheduled', label: 'Scheduled' },
  ];
  protected readonly driverOptions = computed<DropdownOption[]>(() => [{ id: 'all', label: 'All drivers' }, ...this.drivers()]);

  protected readonly columns: TableColumn[] = [
    { key: 'job', label: 'Job', type: 'user', secondaryKey: 'jobId' },
    { key: 'driver', label: 'Driver' },
    { key: 'vehicle', label: 'Vehicle', clickable: true, clickableWhenKey: 'vehicleLink' },
    { key: 'type', label: 'Type' },
    { key: 'priority', label: 'Priority', type: 'priority' },
    { key: 'pickup', label: 'Pickup' },
    { key: 'dropoff', label: 'Dropoff' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'tasks', label: 'Tasks', type: 'tasks' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly tableActions: TableAction[] = ['view'];

  protected readonly total = computed(() => this.jobs().length);
  protected readonly pending = computed(() => this.countStatus('Pending'));
  protected readonly inProgress = computed(() => this.countStatus('In Progress'));
  protected readonly completed = computed(() => this.countStatus('Completed'));
  protected readonly failed = computed(() => this.countStatus('Failed'));
  /** The API has no job priority. */
  protected readonly highPriority = NOT_AVAILABLE;

  protected readonly filteredRows = computed<TableRow[]>(() => {
    const query = this.search().trim().toLowerCase();
    return this.jobs()
      .filter((job) => this.matchesFilter(job))
      .filter(
        (job) =>
          !query ||
          [job.id, job.name, job.driver, job.vehicle, job.type, job.pickup, job.dropoff, job.status]
            .join(' ')
            .toLowerCase()
            .includes(query),
      )
      .map((job) => ({
        id: job.id,
        job: job.name,
        jobId: job.id,
        driver: job.driver,
        vehicle: job.vehicle,
        vehicleLink: !!job.vehicleId,
        type: job.type,
        priority: job.priority,
        pickup: job.pickup,
        dropoff: job.dropoff,
        scheduled: job.scheduled,
        status: job.status,
        tasks: job.tasks,
        actions: '',
      }));
  });
  protected readonly rows = computed(() => this.filteredRows());
  protected readonly filteredTotal = computed(() => this.filteredRows().length);

  /** Jobs running at some point today, clipped to the calendar's window. */
  protected readonly dispatchRows = computed(() => {
    const dayStart = new Date();
    dayStart.setHours(DISPATCH_START_HOUR, 0, 0, 0);
    const windowEnd = dayStart.getTime() + DISPATCH_SLOTS * 30 * 60_000;
    const slot = (time: number) => Math.round((time - dayStart.getTime()) / (30 * 60_000));
    return this.jobs()
      .filter((job) => job.start && job.end && job.start.getTime() < windowEnd && job.end.getTime() > dayStart.getTime())
      .map((job) => {
        const from = Math.max(0, slot(job.start!.getTime()));
        const to = Math.min(DISPATCH_SLOTS, Math.max(from + 1, slot(job.end!.getTime())));
        return {
          jobId: job.id,
          initials: initials(job.driver),
          driver: job.driver.split(' ')[0],
          vehicle: job.vehicle,
          title: job.name,
          time: job.scheduled,
          start: from + 2,
          span: to - from,
          tone: DISPATCH_TONE[job.status],
        };
      });
  });

  // Selections stay "pending" until Apply filters commits them, matching the
  // previous Reset/Apply behaviour.
  protected readonly filterDropdowns = computed<FilterDropdown[]>(() => [
    {
      id: 'jobType',
      label: 'Job Type',
      ariaLabel: 'Filter by job type',
      options: this.jobTypeOptions,
      selected: this.jobTypeFilter(),
      placeholder: 'All job types',
    },
    {
      id: 'driver',
      label: 'Driver',
      ariaLabel: 'Filter by driver',
      options: this.driverOptions(),
      selected: this.driverFilter(),
      placeholder: 'All drivers',
      searchable: true,
      searchPlaceholder: 'Search drivers',
    },
    {
      id: 'status',
      label: 'Status',
      ariaLabel: 'Filter by status',
      options: this.filterOptions,
      selected: this.filter(),
      placeholder: 'All statuses',
    },
  ]);

  constructor() {
    effect(() => {
      this.api.version();
      untracked(() => this.load());
    });
    inject(MaintenanceApiService)
      .vehicles()
      .pipe(catchError(() => of([])), takeUntilDestroyed())
      .subscribe((vehicles) => this.vehicleNames.set(new Map(vehicles.map((vehicle) => [String(vehicle.id), vehicle.name]))));
    inject(DriverApiService)
      .getActiveDrivers()
      .pipe(catchError(() => of(null)), takeUntilDestroyed())
      .subscribe((response) =>
        this.drivers.set((response?.data?.data ?? []).map((driver) => ({ id: String(driver.id), label: driver.name }))),
      );
  }

  protected selectFilter(event: FilterChangeEvent): void {
    if (event.id === 'status') this.filter.set(event.option.id);
    else if (event.id === 'jobType') this.jobTypeFilter.set(event.option.id);
    else if (event.id === 'driver') this.driverFilter.set(event.option.id);
  }
  protected resetFilters(): void {
    this.filter.set('all');
    this.jobTypeFilter.set('all');
    this.driverFilter.set('all');
    this.appliedStatusFilter.set('all');
    this.appliedJobTypeFilter.set('all');
    this.appliedDriverFilter.set('all');
    this.offset.set(0);
    this.closeJobDetails();
  }
  protected applyFilters(): void {
    this.appliedStatusFilter.set(this.filter());
    this.appliedJobTypeFilter.set(this.jobTypeFilter());
    this.appliedDriverFilter.set(this.driverFilter());
    this.offset.set(0);
    this.closeJobDetails();
  }
  protected tableSearchChanged(value: string): void { this.search.set(value); this.offset.set(0); }
  protected goToPage(page: number): void {
    this.offset.set((page - 1) * this.limit);
    this.closeJobDetails();
  }
  protected selectView(view: 'list' | 'dispatch'): void {
    this.activeView.set(view);
    if (view === 'dispatch') this.closeJobDetails();
  }
  protected openJobForm(): void { this.jobFormOpen.set(true); }
  protected closeJobForm(): void { this.jobFormOpen.set(false); }
  protected createJob(): void {
    this.closeJobForm();
    this.api.changed();
  }
  protected selectJob(row: TableRow): void {
    this.selectedJob.set(this.jobs().find((job) => job.id === String(row['id'])) ?? null);
  }
  protected selectDispatchJob(jobId: string): void {
    this.selectedJob.set(this.jobs().find((job) => job.id === jobId) ?? null);
  }
  protected closeJobDetails(): void { this.selectedJob.set(null); }
  protected openVehicle(row: TableRow): void {
    const job = this.jobs().find((item) => item.id === String(row['id']));
    if (job?.vehicleId) void this.router.navigate(['/fleetpoint/vehicles', job.vehicleId]);
  }

  private load(): void {
    this.request?.unsubscribe();
    this.request = this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.records.set(records);
          // Keep the drawer on the refreshed copy, or close it if the job is gone.
          const selected = this.selectedJob();
          if (selected) this.selectedJob.set(this.jobs().find((job) => job.id === selected.id) ?? null);
          this.loaded.set(true);
        },
        error: () => {
          this.records.set([]);
          this.loaded.set(true);
        },
      });
  }
  private countStatus(status: JobStatus): number { return this.jobs().filter((job) => job.status === status).length; }
  private matchesFilter(job: JobRecord): boolean {
    const status = this.appliedStatusFilter();
    const type = this.appliedJobTypeFilter();
    const driver = this.appliedDriverFilter();
    const statusMatches = status === 'all'
      || (status === 'high-priority' ? job.priority === 'High' : job.status.toLowerCase().replaceAll(' ', '-') === status);
    const typeMatches = type === 'all' || job.type.toLowerCase() === type;
    const driverMatches = driver === 'all' || job.driverId === driver;
    return statusMatches && typeMatches && driverMatches;
  }
}

function initials(name: string): string {
  if (name === NOT_AVAILABLE) return NOT_AVAILABLE;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}
