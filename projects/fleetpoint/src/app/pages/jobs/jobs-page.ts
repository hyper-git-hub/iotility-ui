
import { ExportFormat, ExportMenu, Skeleton, lingerWhileClosing } from '@iotility/shared-ui';
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
import {
  JobApiRecord,
  JobListQuery,
  JobPriorityCode,
  JobStatusCode,
  JobTypeCode,
  JobsApiService,
  JobsSummary,
} from '../../shared/services/jobs-api.service';
import { ExportRunnerService } from '../../shared/services/export-runner.service';
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
/** Status filter → job_status code ("high-priority" filters on priority instead). */
const STATUS_FILTER: Record<string, JobStatusCode> = { pending: '1', 'in-progress': '2', completed: '3', failed: '4' };
const TYPE_FILTER: Record<string, JobTypeCode> = { 'ad-hoc': '1', scheduled: '2' };
const HIGH_PRIORITY: JobPriorityCode = 1;
/** Typing settles this long before the server is asked again. */
const SEARCH_DEBOUNCE_MS = 300;
/** The dispatch calendar asks for at most this many of today's jobs. */
const DISPATCH_LIMIT = 200;

/** "YYYY-MM-DD" for the viewer's today. */
function localDay(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

@Component({
  selector: 'app-jobs-page',
  imports: [DataTable, ExportMenu, DataTableSkeleton, FilterBar, JobForm, Skeleton, StatCard],
  templateUrl: './jobs-page.html',
  styleUrl: './jobs-page.css',
})
export class JobsPage {
  private readonly router = inject(Router);
  private readonly api = inject(JobsApiService);
  private readonly exporter = inject(ExportRunnerService);
  protected readonly exporting = signal<ExportFormat | null>(null);
  protected readonly hasJobs = computed(() => this.count() > 0);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private summaryRequest?: Subscription;
  private dispatchRequest?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly search = signal('');
  /** The search the server was last asked for (the box, once typing settles). */
  private readonly appliedSearch = signal('');
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

  /** The current page of jobs; `count` is every job matching the filters. */
  private readonly records = signal<JobApiRecord[]>([]);
  private readonly count = signal(0);
  /** Today's counts from jobs/summary; null until it answers (or if it fails). */
  private readonly summary = signal<JobsSummary | null>(null);
  /** Today's jobs, for the dispatch calendar. */
  private readonly dispatchRecords = signal<JobApiRecord[]>([]);
  // Each job carries its vehicle_name, so no fleet lookup is needed to name vehicles.
  private readonly jobs = computed(() => this.records().map(toJobRecord));
  private readonly dispatchJobs = computed(() => this.dispatchRecords().map(toJobRecord));
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

  // Today's figures from jobs/summary (jobs whose window overlaps today, in the viewer's time zone).
  private readonly todayCount = (key: keyof JobsSummary) =>
    computed<number | string>(() => this.summary()?.[key] ?? NOT_AVAILABLE);
  protected readonly total = this.todayCount('total');
  protected readonly pending = this.todayCount('pending');
  protected readonly inProgress = this.todayCount('in_progress');
  protected readonly completed = this.todayCount('completed');
  /** "Failed" is the UI's name for aborted jobs (including those an admin aborted). */
  protected readonly failed = this.todayCount('aborted');
  protected readonly highPriority = this.todayCount('high_priority');
  /** "12 jobs today · 3 in progress · 2 high priority", or dashes until the summary answers. */
  protected readonly headline = computed(() => {
    const summary = this.summary();
    if (!summary) return `${NOT_AVAILABLE} jobs today`;
    const jobs = `${summary.total} ${summary.total === 1 ? 'job' : 'jobs'} today`;
    return `${jobs} · ${summary.in_progress} in progress · ${summary.high_priority} high priority`;
  });

  /** The filters the server applies; changing any reloads the list. */
  private readonly query = computed<JobListQuery>(() => {
    const status = this.appliedStatusFilter();
    const type = this.appliedJobTypeFilter();
    const driver = this.appliedDriverFilter();
    return {
      limit: this.limit,
      offset: this.offset(),
      search: this.appliedSearch(),
      status: STATUS_FILTER[status] ? [STATUS_FILTER[status]] : undefined,
      priority: status === 'high-priority' ? [HIGH_PRIORITY] : undefined,
      type: TYPE_FILTER[type] ? [TYPE_FILTER[type]] : undefined,
      driverId: driver === 'all' ? undefined : driver,
    };
  });

  protected readonly filteredRows = computed<TableRow[]>(() =>
    this.jobs().map((job) => ({
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
      })),
  );
  protected readonly rows = computed(() => this.filteredRows());
  /** Every job matching the filters (the server pages them). */
  protected readonly filteredTotal = computed(() => this.count());

  /** Today's jobs (asked for by date), clipped to the calendar's window. */
  protected readonly dispatchRows = computed(() => {
    const dayStart = new Date();
    dayStart.setHours(DISPATCH_START_HOUR, 0, 0, 0);
    const windowEnd = dayStart.getTime() + DISPATCH_SLOTS * 30 * 60_000;
    const slot = (time: number) => Math.round((time - dayStart.getTime()) / (30 * 60_000));
    return this.dispatchJobs()
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
    // The list reloads whenever its filters, search, page or the data (after a create) change.
    effect(() => {
      const query = this.query();
      this.api.version();
      untracked(() => this.load(query));
    });
    // Today's counts and the calendar don't depend on the list's filters.
    effect(() => {
      this.api.version();
      untracked(() => this.loadSummary());
    });
    effect(() => {
      if (this.activeView() !== 'dispatch') return;
      this.api.version();
      untracked(() => this.loadDispatch());
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.searchTimer));
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
    clearTimeout(this.searchTimer);
    this.search.set('');
    this.appliedSearch.set('');
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
  protected tableSearchChanged(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      if (value.trim() === this.appliedSearch()) return;
      this.offset.set(0);
      this.appliedSearch.set(value.trim());
    }, SEARCH_DEBOUNCE_MS);
  }
  protected goToPage(page: number): void {
    this.offset.set((page - 1) * this.limit);
    this.closeJobDetails();
  }
  protected selectView(view: 'list' | 'dispatch'): void {
    this.activeView.set(view);
    if (view === 'dispatch') this.closeJobDetails();
  }
  protected openJobForm(): void { this.jobFormOpen.set(true); }

  protected export(format: ExportFormat): void {
    // Exports what the list shows: the same filters, every page.
    const { limit: _limit, offset: _offset, ...filters } = this.query();
    this.exporter.run(this.api.export(format, filters, Math.max(1000, this.count())), 'Jobs', format, this.exporting);
  }
  protected closeJobForm(): void { this.jobFormOpen.set(false); }
  protected createJob(): void {
    this.closeJobForm();
    this.api.changed();
  }
  protected selectJob(row: TableRow): void {
    this.selectedJob.set(this.jobs().find((job) => job.id === String(row['id'])) ?? null);
  }
  protected selectDispatchJob(jobId: string): void {
    this.selectedJob.set(this.dispatchJobs().find((job) => job.id === jobId) ?? null);
  }
  protected closeJobDetails(): void { this.selectedJob.set(null); }
  protected openVehicle(row: TableRow): void {
    const job = this.jobs().find((item) => item.id === String(row['id']));
    if (job?.vehicleId) void this.router.navigate(['/fleetpoint/vehicles', job.vehicleId]);
  }

  private load(query: JobListQuery): void {
    this.request?.unsubscribe();
    this.request = this.api
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ count, records }) => {
          this.records.set(records);
          this.count.set(count);
          // Keep the drawer on the refreshed copy when the job is still on this page.
          const selected = this.selectedJob();
          if (selected) this.selectedJob.set(this.jobs().find((job) => job.id === selected.id) ?? selected);
          this.loaded.set(true);
        },
        error: () => {
          this.records.set([]);
          this.count.set(0);
          this.loaded.set(true);
        },
      });
  }
  private loadSummary(): void {
    this.summaryRequest?.unsubscribe();
    this.summaryRequest = this.api
      .summary()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => this.summary.set(summary));
  }
  /** Jobs whose window overlaps today, for the calendar. */
  private loadDispatch(): void {
    const today = localDay();
    this.dispatchRequest?.unsubscribe();
    this.dispatchRequest = this.api
      .list({ limit: DISPATCH_LIMIT, offset: 0, startDate: today, endDate: today })
      .pipe(catchError(() => of({ count: 0, records: [] })), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ records }) => this.dispatchRecords.set(records));
  }
}

function initials(name: string): string {
  if (name === NOT_AVAILABLE) return NOT_AVAILABLE;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}
