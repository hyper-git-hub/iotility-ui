import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BlockingLoader,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  DropdownOption,
  Skeleton,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import {
  DriverApiService,
  DriverGroup,
  DriverRecord,
} from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { DriverForm } from '../driver-form/driver-form';

@Component({
  selector: 'app-driver-list',
  imports: [
    BlockingLoader,
    DataTable,
    DataTableSkeleton,
    DriverForm,
    Dropdown,
    Skeleton,
  ],
  templateUrl: './driver-list.html',
  styleUrl: '../drivers-page.css',
})
export class DriverList implements OnInit, OnDestroy {
  private searchTimer?: ReturnType<typeof setTimeout>;
  private gridObserver?: IntersectionObserver;
  @ViewChild('gridSentinel')
  set gridSentinel(element: ElementRef<HTMLElement> | undefined) {
    this.gridObserver?.disconnect();
    if (!element || typeof IntersectionObserver === 'undefined') return;
    this.gridObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) this.loadMoreDrivers(); },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    this.gridObserver.observe(element.nativeElement);
  }
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasLoaded = signal(false);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal('');
  protected readonly records = signal<DriverRecord[]>([]);
  protected readonly groups = signal<DriverGroup[]>([]);
  protected readonly selectedDriver = signal<DriverRecord | null>(null);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly search = signal('');
  protected readonly groupId = signal('');
  protected readonly driverId = signal('');
  protected readonly cardType = signal('');
  protected readonly viewMode = signal<'list' | 'grid'>('list');
  protected readonly limit = 10;
  protected readonly actions: TableAction[] = ['map', 'phone', 'edit'];
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Driver', type: 'user', secondaryKey: 'details', clickable: true },
    { key: 'fleet', label: 'Fleet', type: 'fleet' },
    { key: 'shift', label: 'Shift', type: 'status' },
    { key: 'vehicle', label: 'Vehicle', clickable: true, clickableWhenKey: 'vehicleAllocated' },
    { key: 'score', label: 'Score', type: 'score' },
    { key: 'trips', label: 'Trips' },
    { key: 'violations', label: 'Violations', type: 'violations' },
    { key: 'licence', label: 'Licence', type: 'mot' },
    { key: 'categories', label: 'Categories', type: 'categories' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly groupOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All groups' },
    ...this.groups().map((g) => ({ id: String(g.id), label: `${g.name} (${g.driver_count})` })),
  ]);
  protected readonly selectedGroup = computed(() =>
    this.groups().find((g) => String(g.id) === this.groupId()),
  );
  protected readonly visibleRecords = computed(() => {
    const source = this.selectedGroup()?.drivers ?? this.records();
    return this.driverId() ? source.filter((d) => String(d.id) === this.driverId()) : source;
  });
  protected readonly driverOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All drivers' },
    ...this.visibleRecords().map((d) => ({ id: String(d.id), label: d.name })),
  ]);
  protected readonly typeOptions: DropdownOption[] = [
    { id: '', label: 'All types' },
    { id: 'free-drivers', label: 'Free Drivers' },
  ];
  protected readonly rows = computed<TableRow[]>(() =>
    this.visibleRecords().map((d) => ({
      id: d.id,
      name: d.name || 'Unnamed driver',
      details: d.email || 'No email',
      fleet: d.group || 'Operations Fleet',
      fleetColor: this.driverColor(d),
      shift: this.shiftStatus(d),
      vehicle: this.staticVehicle(d),
      vehicleAllocated: this.staticVehicle(d) !== 'Unallocated',
      score: this.staticScore(d),
      trips: `${this.staticTrips(d)} today`,
      violations: this.staticViolations(d),
      fines: this.staticFines(d),
      licence: this.licenceStatus(d),
      categories: this.staticCategories(d),
      actions: '',
    })),
  );
  protected readonly displayedTotal = computed(() =>
    this.groupId() || this.driverId() ? this.visibleRecords().length : this.total(),
  );
  protected readonly hasMore = computed(() => this.records().length < this.total());
  protected readonly pageStart = computed(() =>
    this.displayedTotal() ? (this.groupId() || this.driverId() ? 1 : this.offset() + 1) : 0,
  );
  protected readonly pageEnd = computed(() =>
    this.groupId() || this.driverId()
      ? this.visibleRecords().length
      : Math.min(this.offset() + this.limit, this.total()),
  );
  constructor(
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly router: Router,
  ) {}
  ngOnInit(): void {
    this.refreshGroups();
    this.loadDrivers();
  }
  protected tableSearchChanged(v: string): void {
    this.search.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      this.loadDrivers();
    }, 400);
  }
  protected selectGroup(o: DropdownOption): void {
    this.groupId.set(o.id);
    this.driverId.set('');
  }
  protected selectDriver(o: DropdownOption): void {
    this.driverId.set(o.id);
  }
  protected selectType(o: DropdownOption): void {
    this.cardType.set(o.id);
    this.offset.set(0);
    this.loadDrivers();
  }
  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    this.gridObserver?.disconnect();
  }
  protected setViewMode(mode: 'list' | 'grid'): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.offset.set(0);
    this.loadDrivers();
  }
  protected resetFilters(): void {
    this.groupId.set('');
    this.driverId.set('');
    this.cardType.set('');
    this.offset.set(0);
    this.loadDrivers();
  }
  protected optionLabel(options: DropdownOption[], id: string, fallback: string): string {
    return options.find((o) => o.id === id)?.label || fallback;
  }
  protected openCreateForm(): void {
    this.selectedDriver.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.selectedDriver.set(null);
  }
  protected driverSaved(): void {
    this.closeForm();
    this.offset.set(0);
    this.refreshGroups();
    this.loadDrivers();
  }
  protected handleRowAction(e: { action: TableAction; row: TableRow }): void {
    if (e.action === 'phone') {
      const driver = this.visibleRecords().find((item) => item.id === Number(e.row['id']));
      if (driver?.phone) window.location.href = `tel:${driver.phone}`;
    } else if (e.action === 'map') {
      void this.router.navigateByUrl('/fleetpoint/live-tracking');
    } else if (e.action === 'edit') {
      const d = this.visibleRecords().find((x) => x.id === Number(e.row['id']));
      if (d) {
        this.selectedDriver.set(d);
        this.formOpen.set(true);
      }
    }
  }
  protected openDriver(row: TableRow): void {
    void this.router.navigate(['/fleetpoint/drivers', row['id']]);
  }
  protected handleCellSelected(event: { column: TableColumn; row: TableRow }): void {
    if (event.column.key === 'vehicle') {
      void this.router.navigateByUrl('/fleetpoint/vehicles');
      return;
    }
    this.openDriver(event.row);
  }
  protected previousPage(): void {
    this.offset.update((v) => Math.max(0, v - this.limit));
    this.loadDrivers();
  }
  protected nextPage(): void {
    if (this.offset() + this.limit < this.total()) {
      this.offset.update((v) => v + this.limit);
      this.loadDrivers();
    }
  }
  protected loadDrivers(append = false, requestOffset = this.offset()): void {
    if (append) this.loadingMore.set(true);
    else this.loading.set(true);
    this.error.set('');
    this.api
      .getDrivers({
        limit: this.limit,
        offset: requestOffset,
        searchText: this.search().trim(),
        cardType: this.cardType(),
      })
      .pipe(
        finalize(() => {
          if (append) this.loadingMore.set(false);
          else {
            this.loading.set(false);
            this.hasLoaded.set(true);
          }
        }),
      )
      .subscribe({
        next: (r) => {
          const records = r.data?.data ?? [];
          this.records.set(append ? [...this.records(), ...records] : records);
          this.offset.set(requestOffset);
          this.total.set(r.data?.count ?? 0);
        },
        error: (r) => {
          const message = r.error?.message || 'Drivers could not be loaded.';
          this.error.set(message);
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load drivers',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }
  protected loadMoreDrivers(): void {
    if (this.viewMode() === 'grid' && !this.loadingMore() && this.hasMore()) {
      this.loadDrivers(true, this.records().length);
    }
  }
  private refreshGroups(): void {
    this.api.getGroups().subscribe({ next: (r) => this.groups.set(r.data?.data ?? []) });
  }
  private date(v: string | null | undefined): string {
    return v ? v.slice(0, 10) : 'Not available';
  }
  protected initials(driver: DriverRecord): string {
    return driver.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
  protected staticScore(driver: DriverRecord): number { return 70 + ((driver.id * 7) % 30); }
  protected scoreTone(driver: DriverRecord): 'high' | 'medium' | 'low' {
    const score = this.staticScore(driver);
    return score >= 90 ? 'high' : score >= 75 ? 'medium' : 'low';
  }
  protected staticTrips(driver: DriverRecord): number { return 2 + ((driver.id * 3) % 11); }
  protected staticViolations(driver: DriverRecord): number { return driver.id % 19; }
  protected staticFines(driver: DriverRecord): number { return this.staticViolations(driver) > 7 ? 1 + (driver.id % 3) : 0; }
  protected staticVehicle(driver: DriverRecord): string { return driver.id % 5 === 0 ? 'Unallocated' : `DRV-${String(driver.id).padStart(4, '0')}`; }
  protected staticCategories(driver: DriverRecord): string {
    const options = ['B', 'B, C', 'B, C, C+E', 'B, C, C+E, CPC', 'B, C, CPC, ADR'];
    return options[driver.id % options.length];
  }
  protected licenceStatus(driver: DriverRecord): string {
    if (driver.licence_expiry_date) {
      const days = Math.ceil((new Date(driver.licence_expiry_date).getTime() - Date.now()) / 86400000);
      if (days < 0) return 'Expired';
      return `${days}d`;
    }
    return `${45 + ((driver.id * 13) % 300)}d`;
  }
  protected licenceTone(driver: DriverRecord): 'safe' | 'warning' | 'danger' {
    const licence = this.licenceStatus(driver);
    if (licence === 'Expired') return 'danger';
    const days = Number.parseInt(licence, 10);
    return days <= 30 ? 'danger' : days <= 90 ? 'warning' : 'safe';
  }
  protected driverColor(driver: DriverRecord): string {
    const colors = ['var(--color-brand-600)', 'var(--color-info)', 'var(--color-success)', 'var(--color-warning)'];
    return colors[driver.id % colors.length];
  }
  private shiftStatus(driver: DriverRecord): string {
    if (this.hasActiveShift(driver)) return 'On Shift';
    const shifts = Array.isArray(driver.shift_allocated) ? driver.shift_allocated : [];
    if (!shifts.length) return driver.id % 4 === 0 ? 'On Break' : 'Off Shift';
    return driver.id % 4 === 0 ? 'On Break' : 'Off Shift';
  }
  protected hasActiveShift(driver: DriverRecord): boolean {
    return (
      driver.driver_shift_status === true ||
      (Array.isArray(driver.shift_allocated) &&
        driver.shift_allocated.some(
          (shift) => shift.shift__status === 1 || shift.shift__status === '1',
        ))
    );
  }
  private async deleteDriver(row: TableRow): Promise<void> {
    const name = String(row['name'] || 'this driver');
    if (
      !(await this.feedback.open({
        type: 'warning',
        title: 'Delete driver?',
        message: `${name} will be permanently deleted.`,
        confirmText: 'Delete driver',
        cancelText: 'Keep driver',
        showCancel: true,
      }))
    )
      return;
    this.actionLoading.set(true);
    this.api.deleteDriver(String(row['id'])).subscribe({
      next: async () => {
        this.actionLoading.set(false);
        await this.feedback.open({
          type: 'success',
          title: 'Driver deleted',
          message: `${name} was deleted successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.refreshGroups();
        this.loadDrivers();
      },
      error: (r) => {
        this.actionLoading.set(false);
        const m = r.error?.message || 'Driver could not be deleted.';
        void this.feedback.open({
          type: 'error',
          title: 'Unable to delete driver',
          message: m,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
}
