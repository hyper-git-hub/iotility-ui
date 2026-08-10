import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DataTable,
  DataTableSkeleton,
  DateTimePicker,
  Dropdown,
  DropdownOption,
  Skeleton,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { catchError, finalize, forkJoin, Observable, of } from 'rxjs';
import { DriverRecord } from '../../../shared/services/driver-api.service';
import { DashboardCard } from '../../../shared/services/fleet-dashboard-api.service';
import {
  DriverDetailApiService,
  DriverDetailGraphs,
  DriverIdlePoint,
  DriverViolationMetric,
  DriverViolationRecord,
} from '../../../shared/services/driver-detail-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { StatCard } from '../../../shared/stat-card/stat-card';

@Component({
  selector: 'app-driver-detail',
  imports: [
    DataTable,
    DataTableSkeleton,
    DateTimePicker,
    Dropdown,
    Skeleton,
    StatCard,
  ],
  templateUrl: './driver-detail.html',
  styleUrl: './driver-detail.css',
})
export class DriverDetail implements OnInit {
  protected readonly driverId: number;
  protected readonly loading = signal(true);
  protected readonly dataLoading = signal(false);
  protected readonly error = signal('');
  protected readonly driver = signal<DriverRecord | null>(null);
  protected readonly cards = signal<DashboardCard[]>([]);
  protected readonly cardPeriod = signal('all');
  protected readonly cardPeriodOptions: DropdownOption[] = [
    { id: 'all', label: 'Overall' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'six_m', label: 'Last 6 months' },
  ];
  protected readonly graphs = signal<DriverDetailGraphs>({
    violation_graph: [],
    total_distance_travelled: 0,
    idle_history: [],
  });
  protected readonly violations = signal<DriverViolationRecord[]>([]);
  protected readonly violationCount = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly reportPeriod = signal<'today' | 'yesterday' | 'week' | 'month' | 'custom'>(
    'month',
  );
  protected readonly totalViolations = computed(() =>
    this.graphs().violation_graph.reduce((total, item) => total + Number(item.value || 0), 0),
  );
  protected readonly totalIdle = computed(() =>
    this.graphs().idle_history.reduce((total, item) => total + Number(item.value || 0), 0),
  );
  protected readonly maxViolation = computed(() =>
    Math.max(1, ...this.graphs().violation_graph.map((item) => Number(item.value || 0))),
  );
  protected readonly maxIdle = computed(() =>
    Math.max(1, ...this.graphs().idle_history.map((item) => Number(item.value || 0))),
  );
  protected readonly pageStart = computed(() => (this.violationCount() ? this.offset() + 1 : 0));
  protected readonly pageEnd = computed(() =>
    Math.min(this.offset() + this.limit, this.violationCount()),
  );
  protected readonly alertColumns: TableColumn[] = [
    { key: 'violation', label: 'Violation' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'location', label: 'Location' },
    { key: 'date', label: 'Date and time' },
  ];
  protected readonly alertColumnLabels = this.alertColumns.map((column) => column.label);
  protected readonly alertRows = computed<TableRow[]>(() =>
    this.violations().map((row, index) => ({
      id: Number(row.id ?? index),
      violation: this.violationLabel(row),
      vehicle: this.violationVehicle(row),
      location: this.violationLocation(row),
      date: this.violationTime(row),
    })),
  );

  constructor(
    route: ActivatedRoute,
    private readonly api: DriverDetailApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly router: Router,
  ) {
    this.driverId = Number(route.snapshot.paramMap.get('id'));
    const end = new Date();
    const start = new Date(end);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    this.startDate.set(this.inputDate(start));
    this.endDate.set(this.inputDate(end));
  }

  ngOnInit(): void {
    if (!Number.isFinite(this.driverId)) {
      this.error.set('The driver ID is invalid.');
      this.loading.set(false);
      return;
    }
    forkJoin({
      driver: this.requestOrNull(
        this.api.getDriver(this.driverId),
        'Driver profile could not be loaded.',
      ),
      cards: this.requestOrNull(
        this.api.getCards(this.driverId),
        'Driver cards could not be loaded.',
      ),
      graphs: this.requestOrNull(
        this.api.getGraphs(
          this.driverId,
          this.apiDate(this.startDate()),
          this.apiDate(this.endDate()),
        ),
        'Driver graphs could not be loaded.',
      ),
      violations: this.requestOrNull(
        this.api.getViolations(
          this.driverId,
          this.apiDate(this.startDate()),
          this.apiDate(this.endDate()),
          this.limit,
          0,
        ),
        'Driver alerts could not be loaded.',
      ),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ driver, cards, graphs, violations }) => {
          this.driver.set(driver?.data?.data?.[0] ?? null);
          this.cards.set(cards?.data ?? []);
          this.graphs.set(graphs?.data ?? this.graphs());
          this.setViolations(violations?.data);
          if (driver && !this.driver()) this.error.set('Driver details were not found.');
        },
      });
  }

  protected applyPeriod(): void {
    if (!this.startDate() || !this.endDate() || this.startDate() >= this.endDate()) {
      this.error.set('Select a valid reporting period.');
      return;
    }
    this.offset.set(0);
    this.dataLoading.set(true);
    this.error.set('');
    forkJoin({
      graphs: this.requestOrNull(
        this.api.getGraphs(
          this.driverId,
          this.apiDate(this.startDate()),
          this.apiDate(this.endDate()),
        ),
        'Driver graphs could not be updated.',
      ),
      violations: this.requestOrNull(
        this.api.getViolations(
          this.driverId,
          this.apiDate(this.startDate()),
          this.apiDate(this.endDate()),
          this.limit,
          0,
        ),
        'Driver alerts could not be updated.',
      ),
    })
      .pipe(finalize(() => this.dataLoading.set(false)))
      .subscribe({
        next: ({ graphs, violations }) => {
          if (graphs) this.graphs.set(graphs.data ?? this.graphs());
          if (violations) this.setViolations(violations.data);
        },
      });
  }
  protected updateStart(value: string): void {
    this.startDate.set(value);
    this.reportPeriod.set('custom');
  }
  protected updateEnd(value: string): void {
    this.endDate.set(value);
    this.reportPeriod.set('custom');
  }
  protected applyPreset(period: 'today' | 'yesterday' | 'week' | 'month'): void {
    const end = new Date();
    const start = new Date(end);
    if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (period === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
    } else if (period === 'month') {
      start.setDate(1);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    this.startDate.set(this.inputDate(start));
    this.endDate.set(this.inputDate(end));
    this.reportPeriod.set(period);
    this.applyPeriod();
  }
  protected updateCardPeriod(option: DropdownOption): void {
    const period = option.id;
    this.cardPeriod.set(period);
    this.dataLoading.set(true);
    this.api
      .getCards(this.driverId, period)
      .pipe(finalize(() => this.dataLoading.set(false)))
      .subscribe({
        next: (response) => this.cards.set(response.data ?? []),
        error: (response) => this.showApiError(response, 'Driver cards could not be loaded.'),
      });
  }
  protected cardPeriodLabel(): string {
    return (
      this.cardPeriodOptions.find((option) => option.id === this.cardPeriod())?.label || 'Overall'
    );
  }
  protected previous(): void {
    if (this.offset() > 0) {
      this.offset.update((value) => Math.max(0, value - this.limit));
      this.loadViolationPage();
    }
  }
  protected next(): void {
    if (this.offset() + this.limit < this.violationCount()) {
      this.offset.update((value) => value + this.limit);
      this.loadViolationPage();
    }
  }
  protected back(): void {
    void this.router.navigateByUrl('/fleetpoint/drivers');
  }
  protected image(): string {
    const value = this.driver()?.image?.trim();
    return value && !['none', 'null'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/driver.svg';
  }
  protected useFallbackImage(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/fleetpoint/driver.svg';
  }
  protected text(value: unknown): string {
    return value === null || value === undefined || value === '' ? 'Not available' : String(value);
  }
  protected gender(value: string): string {
    return (
      ({ '1': 'Male', '2': 'Female', '3': 'Other' } as Record<string, string>)[value] ??
      this.text(value)
    );
  }
  protected maritalStatus(value: string): string {
    return (
      ({ '1': 'Single', '2': 'Married', '3': 'Divorced' } as Record<string, string>)[value] ??
      this.text(value)
    );
  }
  protected violationLabel(row: DriverViolationRecord): string {
    return this.text(row['violation_name'] ?? row['violation_type'] ?? row['name'] ?? row['type']);
  }
  protected violationVehicle(row: DriverViolationRecord): string {
    return this.text(row['vehicle_registration'] ?? row['vehicle'] ?? row['registration']);
  }
  protected violationLocation(row: DriverViolationRecord): string {
    return this.text(row['location'] ?? row['address'] ?? row['poi']);
  }
  protected violationTime(row: DriverViolationRecord): string {
    return this.formatDate(
      row['created_at'] ?? row['timestamp'] ?? row['violation_time'] ?? row['date'],
    );
  }
  protected barWidth(item: DriverViolationMetric): number {
    return Math.max(3, (Number(item.value || 0) / this.maxViolation()) * 100);
  }
  protected idleWidth(item: DriverIdlePoint): number {
    return Math.max(3, (Number(item.value || 0) / this.maxIdle()) * 100);
  }
  protected formatDate(value: unknown): string {
    if (!value) return 'Not available';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  private loadViolationPage(): void {
    this.dataLoading.set(true);
    this.api
      .getViolations(
        this.driverId,
        this.apiDate(this.startDate()),
        this.apiDate(this.endDate()),
        this.limit,
        this.offset(),
      )
      .pipe(finalize(() => this.dataLoading.set(false)))
      .subscribe({
        next: (response) => this.setViolations(response.data),
        error: (response) => this.showApiError(response, 'Driver alerts could not be loaded.'),
      });
  }
  private setViolations(data: { count: number; data: DriverViolationRecord[] } | undefined): void {
    this.violations.set(data?.data ?? []);
    this.violationCount.set(data?.count ?? 0);
  }
  private inputDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  private apiDate(value: string): string {
    return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
  }
  private requestOrNull<T>(request: Observable<T>, fallback: string): Observable<T | null> {
    return request.pipe(
      catchError((response) => {
        this.showApiError(response, fallback);
        return of(null);
      }),
    );
  }
  private showApiError(response: { error?: { message?: string } }, fallback: string): void {
    void this.feedback.open({
      type: 'error',
      title: 'Unable to load driver details',
      message: response.error?.message || fallback,
      confirmText: 'Close',
      showCancel: false,
    });
  }
}
